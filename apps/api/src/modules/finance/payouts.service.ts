import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';
import type { PayoutRecipientType, PayoutStatus } from '@carpart/contract';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { shortCode } from '../../common/utils/id';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { Delivery } from '../delivery/entities/delivery.entity';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/entities/order.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { Commission } from './entities/commission.entity';
import { PayoutLine } from './entities/payout-line.entity';
import { Payout } from './entities/payout.entity';

export interface PayoutPreview {
  recipientType: PayoutRecipientType;
  recipientId: string;
  recipientName: string;
  periodFrom: string;
  periodTo: string;
  grossAmount: number;
  deductions: number;
  netAmount: number;
  lines: Array<{ kind: PayoutLine['kind']; orderId: string | null; deliveryId: string | null; amount: number; faDescription: string }>;
  payoutInfo: Record<string, string> | null;
}

/**
 * تسویه حساب با فروشندگان و پیک‌ها.
 *
 * مبنای تسویه، داده واقعی تراکنش‌هاست: برای فروشنده سهم خالص پس از کسر کارمزد در سفارش‌های
 * «تکمیل‌شده» و برای پیک سهم او از مأموریت‌های «تحویل‌شده». هر ردیف تسویه به سفارش/مأموریت
 * مشخص ارجاع می‌شود تا قابل حسابرسی باشد و دوباره تسویه نشود.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectRepository(Payout) private readonly payouts: Repository<Payout>,
    @InjectRepository(PayoutLine) private readonly lines: Repository<PayoutLine>,
    @InjectRepository(Commission) private readonly commissions: Repository<Commission>,
    @InjectRepository(Delivery) private readonly deliveries: Repository<Delivery>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
    private readonly idempotency: IdempotencyService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ----------------------------- پیش‌نمایش ----------------------------- */

  async previewSeller(sellerId: string, from: Date, to: Date): Promise<PayoutPreview> {
    const seller = await this.sellers.findOne({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('فروشگاه');
    const commissions = await this.commissions
      .createQueryBuilder('commission')
      .innerJoin(Order, 'order', 'order.id = commission.orderId')
      .where('commission.sellerId = :sellerId', { sellerId })
      .andWhere('commission.status = :status', { status: 'recorded' })
      .andWhere('commission.payoutId IS NULL')
      .andWhere('order.status = :orderStatus', { orderStatus: 'COMPLETED' })
      .andWhere('order.completedAt BETWEEN :from AND :to', { from, to })
      .getMany();

    const gross = commissions.reduce((acc, row) => acc + row.sellerNetAmount, 0);
    return {
      recipientType: 'seller',
      recipientId: sellerId,
      recipientName: seller.storeName,
      periodFrom: from.toISOString(),
      periodTo: to.toISOString(),
      grossAmount: gross,
      deductions: 0,
      netAmount: Math.max(0, gross),
      lines: commissions.map((row) => ({
        kind: 'sale' as const,
        orderId: row.orderId,
        deliveryId: null,
        amount: row.sellerNetAmount,
        faDescription: `سهم فروشنده از سفارش (کارمزد ${row.ratePercent}٪ کسر شد)`,
      })),
      payoutInfo: this.maskPayoutInfo(seller.payoutInfoEncrypted),
    };
  }

  async previewCourier(courierId: string, from: Date, to: Date): Promise<PayoutPreview> {
    const courier = await this.couriers.findOne({ where: { id: courierId } });
    if (!courier) throw new NotFoundException('پیک');
    const delivered = await this.deliveries.find({
      where: { courierId, status: 'DELIVERED', deliveredAt: Between(from, to) },
      take: 500,
    });
    const settledIds = delivered.length
      ? (await this.lines.find({ where: { deliveryId: In(delivered.map((row) => row.id)) } })).map((row) => row.deliveryId)
      : [];
    const settled = new Set(settledIds.filter((id): id is string => Boolean(id)));
    const pending = delivered.filter((row) => !settled.has(row.id));
    const gross = pending.reduce((acc, row) => acc + row.courierShare, 0);

    return {
      recipientType: 'courier',
      recipientId: courierId,
      recipientName: courier.userId,
      periodFrom: from.toISOString(),
      periodTo: to.toISOString(),
      grossAmount: gross,
      deductions: 0,
      netAmount: Math.max(0, gross),
      lines: pending.map((row) => ({
        kind: 'delivery' as const,
        orderId: row.orderId,
        deliveryId: row.id,
        amount: row.courierShare,
        faDescription: `سهم پیک از مأموریت ${row.code}`,
      })),
      payoutInfo: this.maskPayoutInfo(courier.payoutInfoEncrypted),
    };
  }

  private maskPayoutInfo(encrypted: string | null): Record<string, string> | null {
    if (!encrypted) return null;
    // اطلاعات حساب فقط به‌صورت پوشیده در پیش‌نمایش تسویه نمایش داده می‌شود
    return { stored: 'true', note: 'اطلاعات حساب بانکی رمزنگاری‌شده نگهداری می‌شود.' };
  }

  /* ------------------------------- ساخت ------------------------------- */

  async create(actorId: string, preview: PayoutPreview, idempotencyKey?: string | null): Promise<Payout> {
    if (!preview.lines.length) {
      throw new AppException('موردی برای تسویه در این بازه وجود ندارد.', ErrorCodes.VALIDATION_FAILED, { statusCode: 409 });
    }
    if (preview.netAmount <= 0) {
      throw new AppException('مبلغ خالص تسویه صفر است.', ErrorCodes.VALIDATION_FAILED, { statusCode: 409 });
    }

    const { result } = await this.idempotency.run<Payout>(
      'payout.create',
      idempotencyKey,
      { userId: actorId, requestHash: IdempotencyService.hash({ recipient: preview.recipientId, from: preview.periodFrom, to: preview.periodTo }) },
      async () => {
        const payout = await this.payouts.save(
          this.payouts.create({
            code: shortCode(8, 'PAY'),
            recipientType: preview.recipientType,
            recipientId: preview.recipientId,
            recipientName: preview.recipientName,
            periodFrom: new Date(preview.periodFrom),
            periodTo: new Date(preview.periodTo),
            grossAmount: preview.grossAmount,
            deductions: preview.deductions,
            netAmount: preview.netAmount,
            status: 'PENDING',
            method: null,
            reference: null,
            note: null,
            createdBy: actorId,
            idempotencyKey: idempotencyKey ?? null,
          }),
        );
        await this.lines.save(
          preview.lines.map((line) =>
            this.lines.create({
              payoutId: payout.id,
              kind: line.kind,
              orderId: line.orderId,
              deliveryId: line.deliveryId,
              amount: line.amount,
              faDescription: line.faDescription,
            }),
          ),
        );

        if (preview.recipientType === 'seller') {
          const orderIds = preview.lines.map((line) => line.orderId).filter((id): id is string => Boolean(id));
          if (orderIds.length) {
            await this.commissions.update(
              { orderId: In(orderIds), sellerId: preview.recipientId, status: 'recorded', payoutId: IsNull() },
              { payoutId: payout.id },
            );
          }
        }
        return payout;
      },
    );
    return result;
  }

  async createForSeller(actorId: string, sellerId: string, from: Date, to: Date, idempotencyKey?: string | null): Promise<Payout> {
    const preview = await this.previewSeller(sellerId, from, to);
    return this.create(actorId, preview, idempotencyKey);
  }

  async createForCourier(actorId: string, courierId: string, from: Date, to: Date, idempotencyKey?: string | null): Promise<Payout> {
    const preview = await this.previewCourier(courierId, from, to);
    return this.create(actorId, preview, idempotencyKey);
  }

  /* ------------------------------ خواندن ------------------------------ */

  async listAll(query: { status?: PayoutStatus; recipientType?: PayoutRecipientType; page?: number; pageSize?: number } = {}): Promise<PageResult<Payout>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.recipientType) where.recipientType = query.recipientType;
    const [items, total] = await this.payouts.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async listForSeller(sellerId: string, query: { page?: number; pageSize?: number } = {}): Promise<PageResult<Payout>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const [items, total] = await this.payouts.findAndCount({
      where: { recipientType: 'seller', recipientId: sellerId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async listForCourier(courierId: string, query: { page?: number; pageSize?: number } = {}): Promise<PageResult<Payout>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const [items, total] = await this.payouts.findAndCount({
      where: { recipientType: 'courier', recipientId: courierId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async detail(payoutId: string): Promise<{ payout: Payout; lines: PayoutLine[] }> {
    const payout = await this.payouts.findOne({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('تسویه');
    const lines = await this.lines.find({ where: { payoutId } });
    return { payout, lines };
  }

  /* ---------------------------- تغییر وضعیت ---------------------------- */

  private async requirePayout(payoutId: string): Promise<Payout> {
    const payout = await this.payouts.findOne({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('تسویه');
    return payout;
  }

  async markReady(actorId: string, payoutId: string): Promise<Payout> {
    const payout = await this.requirePayout(payoutId);
    this.assertStatus(payout, ['PENDING']);
    payout.status = 'READY';
    payout.processedBy = actorId;
    return this.payouts.save(payout);
  }

  /** ثبت اجرای تسویه (پرداخت واقعی خارج از سامانه یا از طریق سرویس بانکی). */
  async markPaid(actorId: string, payoutId: string, reference: string, method = 'bank_transfer'): Promise<Payout> {
    const payout = await this.requirePayout(payoutId);
    this.assertStatus(payout, ['PENDING', 'READY', 'PROCESSING']);
    payout.status = 'PAID';
    payout.reference = reference;
    payout.method = method;
    payout.processedBy = actorId;
    payout.processedAt = new Date();
    const saved = await this.payouts.save(payout);
    await this.notifyRecipient(saved);
    return saved;
  }

  async markFailed(actorId: string, payoutId: string, note: string): Promise<Payout> {
    const payout = await this.requirePayout(payoutId);
    this.assertStatus(payout, ['PENDING', 'READY', 'PROCESSING']);
    payout.status = 'FAILED';
    payout.note = note;
    payout.processedBy = actorId;
    payout.processedAt = new Date();
    // ردیف‌های کارمزد آزاد می‌شوند تا در تسویه بعدی لحاظ گردند
    await this.releaseCommissions(payout.id);
    return this.payouts.save(payout);
  }

  async cancel(actorId: string, payoutId: string, note: string): Promise<Payout> {
    const payout = await this.requirePayout(payoutId);
    this.assertStatus(payout, ['PENDING', 'READY']);
    payout.status = 'CANCELLED';
    payout.note = note;
    payout.processedBy = actorId;
    await this.releaseCommissions(payout.id);
    await this.lines.delete({ payoutId });
    return this.payouts.save(payout);
  }

  private async releaseCommissions(payoutId: string): Promise<void> {
    await this.commissions.update({ payoutId }, { payoutId: null });
  }

  private assertStatus(payout: Payout, allowed: PayoutStatus[]): void {
    if (!allowed.includes(payout.status)) {
      throw new AppException(`تسویه در وضعیت «${payout.status}» اجازه این تغییر را ندارد.`, ErrorCodes.CONFLICT, { statusCode: 409 });
    }
  }

  private async notifyRecipient(payout: Payout): Promise<void> {
    const userId =
      payout.recipientType === 'seller'
        ? (await this.sellers.findOne({ where: { id: payout.recipientId } }))?.userId
        : (await this.couriers.findOne({ where: { id: payout.recipientId } }))?.userId;
    if (!userId) return;
    await this.notifications
      .notify({
        userId,
        eventKey: 'payout.created',
        subjectId: payout.id,
        vars: { code: payout.code, amount: payout.netAmount, payoutId: payout.id },
        moneyVars: ['amount'],
        data: { payoutId: payout.id },
      })
      .catch((error) => this.logger.warn(`اعلان تسویه ناموفق بود: ${(error as Error).message}`));
  }

  /** خلاصه مالی برای داشبورد مدیر — درآمد پلتفرم از GMV جدا می‌شود. */
  async settlementSummary(from: Date, to: Date): Promise<{
    gmv: number;
    platformCommission: number;
    sellerNet: number;
    courierShare: number;
    deliveryPlatformShare: number;
    paidOut: number;
    pendingPayout: number;
    orderCount: number;
  }> {
    const commissionRows = await this.commissions
      .createQueryBuilder('commission')
      .innerJoin(Order, 'order', 'order.id = commission.orderId')
      .select('COALESCE(SUM(order.payableTotal), 0)', 'gmv')
      .addSelect('COALESCE(SUM(commission.platformAmount), 0)', 'platformCommission')
      .addSelect('COALESCE(SUM(commission.sellerNetAmount), 0)', 'sellerNet')
      .addSelect('COALESCE(SUM(commission.courierAmount), 0)', 'courierShare')
      .addSelect('COALESCE(SUM(commission.deliveryPlatformAmount), 0)', 'deliveryPlatformShare')
      .addSelect('COUNT(DISTINCT order.id)', 'orderCount')
      .where('order.completedAt BETWEEN :from AND :to', { from, to })
      .getRawOne<Record<string, string | null>>();

    const payoutRows = await this.payouts
      .createQueryBuilder('payout')
      .select('COALESCE(SUM(CASE WHEN payout.status = :paid THEN payout.netAmount ELSE 0 END), 0)', 'paidOut')
      .addSelect('COALESCE(SUM(CASE WHEN payout.status IN (:...pending) THEN payout.netAmount ELSE 0 END), 0)', 'pending')
      .setParameters({ paid: 'PAID', pending: ['PENDING', 'READY', 'PROCESSING'] })
      .where('payout.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne<Record<string, string | null>>();

    return {
      gmv: Number(commissionRows?.gmv ?? 0),
      platformCommission: Number(commissionRows?.platformCommission ?? 0),
      sellerNet: Number(commissionRows?.sellerNet ?? 0),
      courierShare: Number(commissionRows?.courierShare ?? 0),
      deliveryPlatformShare: Number(commissionRows?.deliveryPlatformShare ?? 0),
      paidOut: Number(payoutRows?.paidOut ?? 0),
      pendingPayout: Number(payoutRows?.pending ?? 0),
      orderCount: Number(commissionRows?.orderCount ?? 0),
    };
  }
}
