import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { Seller } from '../sellers/entities/seller.entity';
import { Commission } from './entities/commission.entity';
import { PricingService } from './pricing.service';

export interface CommissionSummary {
  from: string;
  to: string;
  orderCount: number;
  itemsTotal: number;
  commissionBase: number;
  platformAmount: number;
  sellerNetAmount: number;
  courierAmount: number;
  deliveryPlatformAmount: number;
  averageRatePercent: number | null;
}

/** گزارش و مدیریت کارمزد پلتفرم — نرخ کارمزد از تنظیمات یا نرخ اختصاصی فروشنده خوانده می‌شود. */
@Injectable()
export class CommissionService {
  constructor(
    @InjectRepository(Commission) private readonly commissions: Repository<Commission>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    private readonly pricing: PricingService,
  ) {}

  async defaultRatePercent(): Promise<number> {
    return this.pricing.commissionRatePercent(null);
  }

  async listAll(
    query: { sellerId?: string; orderId?: string; status?: string; page?: number; pageSize?: number } = {},
  ): Promise<PageResult<Commission>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = {};
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.orderId) where.orderId = query.orderId;
    if (query.status) where.status = query.status;
    const [items, total] = await this.commissions.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async forOrder(orderId: string): Promise<Commission | null> {
    return this.commissions.findOne({ where: { orderId } });
  }

  async summarize(sellerId: string | null, from: Date, to: Date): Promise<CommissionSummary> {
    const qb = this.commissions
      .createQueryBuilder('commission')
      .innerJoin('commission.order', 'order')
      .select('COUNT(*)', 'orderCount')
      .addSelect('COALESCE(SUM(commission.itemsTotal), 0)', 'itemsTotal')
      .addSelect('COALESCE(SUM(commission.commissionBase), 0)', 'commissionBase')
      .addSelect('COALESCE(SUM(commission.platformAmount), 0)', 'platformAmount')
      .addSelect('COALESCE(SUM(commission.sellerNetAmount), 0)', 'sellerNetAmount')
      .addSelect('COALESCE(SUM(commission.courierAmount), 0)', 'courierAmount')
      .addSelect('COALESCE(SUM(commission.deliveryPlatformAmount), 0)', 'deliveryPlatformAmount')
      .addSelect('AVG(commission.ratePercent)', 'averageRatePercent')
      .where('order.completedAt BETWEEN :from AND :to', { from, to });
    if (sellerId) qb.andWhere('commission.sellerId = :sellerId', { sellerId });
    const row = await qb.getRawOne<Record<string, string | null>>();
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      orderCount: Number(row?.orderCount ?? 0),
      itemsTotal: Number(row?.itemsTotal ?? 0),
      commissionBase: Number(row?.commissionBase ?? 0),
      platformAmount: Number(row?.platformAmount ?? 0),
      sellerNetAmount: Number(row?.sellerNetAmount ?? 0),
      courierAmount: Number(row?.courierAmount ?? 0),
      deliveryPlatformAmount: Number(row?.deliveryPlatformAmount ?? 0),
      averageRatePercent: row?.averageRatePercent === null || row?.averageRatePercent === undefined ? null : Math.round(Number(row.averageRatePercent) * 100) / 100,
    };
  }

  /** درآمد پلتفرم به تفکیک فروشنده برای گزارش‌گیری. */
  async bySeller(from: Date, to: Date): Promise<Array<{ sellerId: string; storeName: string; orders: number; platformAmount: number; sellerNet: number }>> {
    const rows = await this.commissions
      .createQueryBuilder('commission')
      .innerJoin('commission.order', 'order')
      .select('commission.sellerId', 'sellerId')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(commission.platformAmount), 0)', 'platformAmount')
      .addSelect('COALESCE(SUM(commission.sellerNetAmount), 0)', 'sellerNet')
      .where('order.completedAt BETWEEN :from AND :to', { from, to })
      .groupBy('commission.sellerId')
      .getRawMany<{ sellerId: string; orders: string; platformAmount: string; sellerNet: string }>();
    const ids = [...new Set(rows.map((row) => row.sellerId))];
    const sellers = ids.length ? await this.sellers.find({ where: { id: In(ids) } }) : [];
    const nameById = new Map(sellers.map((seller) => [seller.id, seller.storeName]));
    return rows
      .map((row) => ({
        sellerId: row.sellerId,
        storeName: nameById.get(row.sellerId) ?? '—',
        orders: Number(row.orders),
        platformAmount: Number(row.platformAmount),
        sellerNet: Number(row.sellerNet),
      }))
      .sort((a, b) => b.platformAmount - a.platformAmount);
  }

  /** تعیین یا حذف نرخ کارمزد اختصاصی یک فروشنده. */
  async setSellerRate(sellerId: string, ratePercent: number | null): Promise<{ sellerId: string; ratePercent: number | null; effectiveRate: number }> {
    const seller = await this.sellers.findOne({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('فروشگاه');
    if (ratePercent !== null && (ratePercent < 0 || ratePercent > 50)) {
      throw new AppException('نرخ کارمزد باید بین ۰ تا ۵۰ درصد باشد.', ErrorCodes.VALIDATION_FAILED);
    }
    seller.commissionPercent = ratePercent;
    await this.sellers.save(seller);
    return { sellerId, ratePercent, effectiveRate: await this.pricing.commissionRatePercent(ratePercent) };
  }

  /** کارمزدهای ثبت‌شده یک فروشنده در بازه زمانی. */
  async listForSeller(sellerId: string, from: Date, to: Date): Promise<Commission[]> {
    return this.commissions
      .createQueryBuilder('commission')
      .innerJoin('commission.order', 'order')
      .where('commission.sellerId = :sellerId', { sellerId })
      .andWhere('order.createdAt BETWEEN :from AND :to', { from, to })
      .orderBy('order.createdAt', 'DESC')
      .take(200)
      .getMany();
  }
}
