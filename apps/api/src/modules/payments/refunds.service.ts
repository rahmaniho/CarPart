import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { RefundStatus } from '@carpart/contract';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import type { RequestUser } from '../../common/types/auth';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { Payment } from './entities/payment.entity';
import { Refund } from './entities/refund.entity';
import { PaymentsService } from './payments.service';

/**
 * مدیریت بازپرداخت.
 *
 * جریان: درخواست کاربر (در مهلت مقرر) ← تأیید مدیر ← اجرای بازپرداخت از طریق درگاه ←
 * ثبت وضعیت سفارش به «بازپرداخت شد». اجرای بازپرداخت با کلید یکتاسازی محافظت می‌شود.
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @InjectRepository(Refund) private readonly refunds: Repository<Refund>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly orders: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly idempotency: IdempotencyService,
    private readonly notifications: NotificationsService,
  ) {}

  async request(user: RequestUser, orderId: string, reason: string): Promise<Refund> {
    const order = await this.orders.loadOrder(orderId);
    this.orders.assertReadAccess(order, user.id, user);
    if (order.orderKind === 'child') {
      throw new AppException('بازپرداخت بسته باید از سفارش تجمیعی آن درخواست شود.', ErrorCodes.VALIDATION_FAILED, { statusCode: 409 });
    }
    const payment = await this.payments.findOne({ where: { orderId, status: 'SUCCESS' }, order: { paidAt: 'DESC' } });
    if (!payment) {
      throw new AppException('پرداخت موفقی برای این سفارش یافت نشد.', ErrorCodes.PAYMENT_ALREADY_PROCESSED, { statusCode: 409 });
    }
    const existing = await this.refunds.findOne({ where: { orderId, status: In(['REQUESTED', 'APPROVED', 'PROCESSING', 'DONE']) } });
    if (existing) {
      throw new AppException('برای این سفارش پیش‌تر درخواست بازپرداخت ثبت شده است.', ErrorCodes.CONFLICT, { statusCode: 409 });
    }

    // تغییر وضعیت سفارش با گارد «مهلت بازپرداخت» انجام می‌شود
    await this.orders.transition(orderId, 'REFUND_REQUESTED', user, reason);

    return this.refunds.save(
      this.refunds.create({
        paymentId: payment.id,
        orderId,
        userId: order.userId,
        amount: payment.amount,
        status: 'REQUESTED',
        reason,
        note: null,
        requestedBy: user.id,
        requestedAt: new Date(),
      }),
    );
  }

  async get(refundId: string): Promise<Refund> {
    const refund = await this.refunds.findOne({ where: { id: refundId } });
    if (!refund) throw new NotFoundException('درخواست بازپرداخت');
    return refund;
  }

  async listMine(userId: string, query: { page?: number; pageSize?: number; status?: RefundStatus } = {}): Promise<PageResult<Refund>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = { userId };
    if (query.status) where.status = query.status;
    const [items, total] = await this.refunds.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async listAll(query: { page?: number; pageSize?: number; status?: RefundStatus } = {}): Promise<PageResult<Refund>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await this.refunds.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async approve(user: RequestUser, refundId: string, note?: string): Promise<Refund> {
    const refund = await this.get(refundId);
    if (!['REQUESTED'].includes(refund.status)) {
      throw new AppException('فقط درخواست بازپرداختِ در انتظار بررسی قابل تأیید است.', ErrorCodes.CONFLICT, { statusCode: 409 });
    }
    refund.status = 'APPROVED';
    refund.approvedBy = user.id;
    refund.note = note ?? refund.note;
    return this.refunds.save(refund);
  }

  async reject(user: RequestUser, refundId: string, note?: string): Promise<Refund> {
    const refund = await this.get(refundId);
    if (!['REQUESTED', 'APPROVED'].includes(refund.status)) {
      throw new AppException('این درخواست بازپرداخت قابل رد کردن نیست.', ErrorCodes.CONFLICT, { statusCode: 409 });
    }
    refund.status = 'REJECTED';
    refund.approvedBy = user.id;
    refund.resolvedAt = new Date();
    refund.note = note ?? 'درخواست بازپرداخت رد شد';
    const saved = await this.refunds.save(refund);
    await this.orders.transition(refund.orderId, 'COMPLETED', user, note ?? 'رد درخواست بازپرداخت');
    await this.notifyOwner(refund, 'بازپرداخت درخواست‌شده رد شد');
    return saved;
  }

  /** اجرای بازپرداخت از طریق درگاه (با کلید یکتاسازی). */
  async execute(user: RequestUser, refundId: string, amount?: number, idempotencyKey?: string | null): Promise<Refund> {
    const { result } = await this.idempotency.run<Refund>(
      'refund.execute',
      idempotencyKey,
      { userId: user.id, requestHash: IdempotencyService.hash({ refundId, amount }) },
      async () => {
        const refund = await this.get(refundId);
        if (!['REQUESTED', 'APPROVED', 'FAILED'].includes(refund.status)) {
          throw new AppException('وضعیت این بازپرداخت اجازه اجرا ندارد.', ErrorCodes.CONFLICT, { statusCode: 409 });
        }
        const payment = await this.payments.findOne({ where: { id: refund.paymentId } });
        if (!payment) throw new NotFoundException('تراکنش پرداخت');
        const refundAmount = amount ?? refund.amount;
        if (refundAmount !== refund.amount) {
          throw new AppException(
            'بازپرداخت جزئی تا زمان ثبت تخصیص قلم/فروشنده و برگشت متناسب کمیسیون قابل اجرا نیست.',
            ErrorCodes.VALIDATION_FAILED,
            { statusCode: 409 },
          );
        }
        if (refundAmount > payment.amount - payment.refundedAmount) {
          throw new AppException(
            'مبلغ بازپرداخت از باقیمانده تراکنش بیشتر است.',
            ErrorCodes.REFUND_EXCEEDS_PAYMENT,
            { statusCode: 409 },
          );
        }

        refund.status = 'PROCESSING';
        refund.amount = refundAmount;
        refund.approvedBy = refund.approvedBy ?? user.id;
        await this.refunds.save(refund);

        const provider = await this.paymentsService.activeProvider();
        const outcome = await provider.refund({
          paymentId: payment.id,
          referenceId: payment.referenceId || null,
          amount: refundAmount,
          orderId: payment.orderId,
          reason: refund.reason ?? null,
        });
        await this.paymentsService.recordEvent(
          payment.id,
          outcome.success ? 'refund_success' : 'refund_failed',
          'gateway',
          outcome.raw ?? { message: outcome.message },
        );

        if (!outcome.success) {
          refund.status = 'FAILED';
          refund.note = outcome.message ?? 'اجرای بازپرداخت ناموفق بود.';
          refund.resolvedAt = new Date();
          const failed = await this.refunds.save(refund);
          await this.notifyOwner(failed, 'اجرای بازپرداخت ناموفق بود');
          return failed;
        }

        refund.status = 'DONE';
        refund.providerRef = outcome.providerRef ?? null;
        refund.resolvedAt = new Date();
        refund.note = outcome.message ?? refund.note;
        const done = await this.refunds.save(refund);

        payment.refundedAmount += refundAmount;
        payment.status = payment.refundedAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
        await this.payments.save(payment);

        if (payment.refundedAmount >= payment.amount) {
          await this.orders.transition(done.orderId, 'REFUNDED', user, 'بازپرداخت کامل انجام شد');
        }
        await this.notifyOwner(done, 'بازپرداخت با موفقیت انجام شد');
        return done;
      },
    );
    return result;
  }

  private async notifyOwner(refund: Refund, message: string): Promise<void> {
    if (!refund.userId) return;
    await this.notifications
      .notify({
        userId: refund.userId,
        eventKey: 'order.cancelled',
        subjectId: refund.orderId,
        vars: { code: refund.orderId.slice(0, 8), orderId: refund.orderId, reason: message },
        data: { refundId: refund.id },
      })
      .catch((error) => this.logger.warn(`اعلان بازپرداخت ناموفق بود: ${(error as Error).message}`));
  }

  async pendingCount(): Promise<number> {
    return this.refunds.count({ where: { status: In(['REQUESTED', 'APPROVED', 'PROCESSING']) } });
  }
}
