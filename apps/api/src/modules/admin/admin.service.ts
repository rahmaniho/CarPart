import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { formatJalali } from '@carpart/contract';
import { AuditService } from '../audit/audit.service';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { Delivery } from '../delivery/entities/delivery.entity';
import { PayoutsService } from '../finance/payouts.service';
import { Commission } from '../finance/entities/commission.entity';
import { Part } from '../catalog/entities/part.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { PartRequest } from '../requests/entities/part-request.entity';
import { SellerProduct } from '../sellers/entities/seller-product.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { SupportService } from '../support/support.service';
import { User } from '../users/entities/user.entity';
import { Workshop } from '../workshops/entities/workshop.entity';
import { VerificationsService } from './verifications.service';

export interface AdminDashboard {
  generatedAt: string;
  users: { total: number; byRole: Record<string, number>; newToday: number; active: number; inactive: number };
  verifications: { seller: number; courier: number; workshop: number };
  catalog: { parts: number; activeOffers: number; outOfStockOffers: number; sellers: number; couriers: number; workshops: number };
  requests: { open: number; quoted: number; converted: number; expiredToday: number };
  orders: { total: number; byStatus: Record<string, number>; today: number; awaitingPayment: number; inProgress: number };
  money: {
    gmv: number;
    platformRevenue: number;
    sellerNet: number;
    courierShare: number;
    paidOut: number;
    pendingPayout: number;
    note: string;
  };
  payments: { count: number; success: number; failed: number; amountSuccess: number; sandboxActive: boolean };
  delivery: { total: number; delivered: number; failed: number; avgMinutes: number | null; waitingForCourier: number };
  support: { openTickets: number; openReturns: number };
  topSellers: Array<{ id: string; storeName: string; orders: number; revenue: number; platformRevenue: number }>;
  recentAudit: Array<{ at: string; action: string; fa: string; actor: string | null }>;
}

/** داشبورد و گزارش‌های مدیر — همه اعداد از داده واقعی پایگاه‌داده محاسبه می‌شوند. */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
    @InjectRepository(Workshop) private readonly workshops: Repository<Workshop>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(SellerProduct) private readonly products: Repository<SellerProduct>,
    @InjectRepository(PartRequest) private readonly requests: Repository<PartRequest>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Commission) private readonly commissions: Repository<Commission>,
    @InjectRepository(Delivery) private readonly deliveries: Repository<Delivery>,
    private readonly verifications: VerificationsService,
    private readonly ordersService: OrdersService,
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutsService,
    private readonly support: SupportService,
    private readonly audit: AuditService,
  ) {}

  async dashboard(rangeDays = 30): Promise<AdminDashboard> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const since = new Date(now.getTime() - rangeDays * 86_400_000);

    const [
      userRows,
      newUserCount,
      activeUsers,
      verificationCounts,
      partCount,
      offerRows,
      sellerCount,
      courierCount,
      workshopCount,
      requestRows,
      expiredToday,
      orderStats,
      deliveryRows,
      waitingForCourier,
      paymentStats,
      settlement,
      openTickets,
      openReturns,
      recentAudit,
    ] = await Promise.all([
      this.users
        .createQueryBuilder('user')
        .select('COUNT(*)', 'total')
        .getRawOne<{ total: string }>(),
      this.users.count({ where: { createdAt: MoreThanOrEqual(startOfDay) } }),
      this.users.count({ where: { isActive: true } }),
      this.verifications.counts(),
      this.parts.count(),
      this.products
        .createQueryBuilder('sp')
        .select('COUNT(*)', 'total')
        .addSelect('SUM(CASE WHEN sp.isActive THEN 1 ELSE 0 END)', 'active')
        .addSelect('SUM(CASE WHEN sp.stock - sp.reservedStock <= 0 THEN 1 ELSE 0 END)', 'outOfStock')
        .where('sp.isActive = :active', { active: true })
        .getRawOne<{ total: string; active: string | null; outOfStock: string | null }>(),
      this.sellers.count({ where: { verificationStatus: 'APPROVED', isActive: true } }),
      this.couriers.count({ where: { verificationStatus: 'APPROVED', isActive: true } }),
      this.workshops.count({ where: { verificationStatus: 'APPROVED' } }),
      this.requests
        .createQueryBuilder('request')
        .select('request.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('request.status')
        .getRawMany<{ status: string; count: string }>(),
      this.requests.count({ where: { closedAt: MoreThanOrEqual(startOfDay), status: 'EXPIRED' } }),
      this.ordersService.statistics(rangeDays),
      this.deliveries
        .createQueryBuilder('delivery')
        .select('delivery.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('delivery.status')
        .getRawMany<{ status: string; count: string }>(),
      this.orders.count({ where: { status: 'WAITING_FOR_COURIER' } }),
      this.payments.totals(rangeDays),
      this.payouts.settlementSummary(since, now),
      this.support.openTicketCount(),
      this.support.openReturnCount(),
      this.audit.query({ page: 1, pageSize: 10 }),
    ]);

    const byRole: Record<string, number> = {};
    const roleRows = await this.users.find({ select: { id: true, roles: true }, take: 2000 });
    for (const row of roleRows) {
      for (const role of row.roles ?? []) byRole[role] = (byRole[role] ?? 0) + 1;
    }

    const requestByStatus: Record<string, number> = {};
    for (const row of requestRows) requestByStatus[row.status] = Number(row.count);

    const deliveryByStatus: Record<string, number> = {};
    for (const row of deliveryRows) deliveryByStatus[row.status] = Number(row.count);

    const readiness = await this.payments.readiness();
    const activeProvider = readiness.find((item) => item.active);

    const orderTotals = await this.orders
      .createQueryBuilder('order')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN order.createdAt >= :startOfDay THEN 1 ELSE 0 END)', 'today')
      .addSelect('SUM(CASE WHEN order.status = :waiting THEN 1 ELSE 0 END)', 'awaitingPayment')
      .setParameters({ startOfDay, waiting: 'WAITING_FOR_PAYMENT' })
      .getRawOne<{ total: string; today: string | null; awaitingPayment: string | null }>();

    return {
      generatedAt: now.toISOString(),
      users: {
        total: Number(userRows?.total ?? 0),
        byRole,
        newToday: newUserCount,
        active: activeUsers,
        inactive: Math.max(0, Number(userRows?.total ?? 0) - activeUsers),
      },
      verifications: verificationCounts,
      catalog: {
        parts: partCount,
        activeOffers: Number(offerRows?.active ?? 0),
        outOfStockOffers: Number(offerRows?.outOfStock ?? 0),
        sellers: sellerCount,
        couriers: courierCount,
        workshops: workshopCount,
      },
      requests: {
        open: requestByStatus.OPEN ?? 0,
        quoted: requestByStatus.QUOTED ?? 0,
        converted: requestByStatus.CONVERTED ?? 0,
        expiredToday,
      },
      orders: {
        total: Number(orderTotals?.total ?? 0),
        byStatus: orderStats.byStatus,
        today: Number(orderTotals?.today ?? 0),
        awaitingPayment: Number(orderTotals?.awaitingPayment ?? 0),
        inProgress: Object.entries(orderStats.byStatus)
          .filter(([status]) => !['CANCELLED', 'REFUNDED', 'COMPLETED', 'DRAFT'].includes(status))
          .reduce((acc, [, count]) => acc + count, 0),
      },
      money: {
        gmv: settlement.gmv,
        platformRevenue: settlement.platformCommission + settlement.deliveryPlatformShare,
        sellerNet: settlement.sellerNet,
        courierShare: settlement.courierShare,
        paidOut: settlement.paidOut,
        pendingPayout: settlement.pendingPayout,
        note: 'GMV مجموع مبلغ سفارش‌های تکمیل‌شده و درآمد پلتفرم فقط کارمزد و سهم پلتفرم از ارسال است؛ این دو با هم اشتباه گرفته نمی‌شوند.',
      },
      payments: {
        count: paymentStats.count,
        success: paymentStats.success,
        failed: paymentStats.failed,
        amountSuccess: paymentStats.amountSuccess,
        sandboxActive: activeProvider?.mode === 'sandbox',
      },
      delivery: {
        total: Object.values(deliveryByStatus).reduce((acc, count) => acc + count, 0),
        delivered: deliveryByStatus.DELIVERED ?? 0,
        failed: (deliveryByStatus.FAILED ?? 0) + (deliveryByStatus.CANCELLED ?? 0),
        avgMinutes: await this.averageDeliveryMinutes(since),
        waitingForCourier,
      },
      support: { openTickets, openReturns },
      topSellers: await this.topSellers(since),
      recentAudit: recentAudit.items.map((log) => ({
        at: log.createdAt.toISOString(),
        action: log.action,
        fa: log.faDescription,
        actor: log.actorName ?? log.actorMobile ?? null,
      })),
    };
  }

  private async averageDeliveryMinutes(since: Date): Promise<number | null> {
    const rows = await this.deliveries.find({
      where: { status: 'DELIVERED', createdAt: MoreThanOrEqual(since) },
      select: { id: true, pickedUpAt: true, deliveredAt: true },
      take: 500,
    });
    const durations = rows
      .filter((row) => row.pickedUpAt && row.deliveredAt)
      .map((row) => (row.deliveredAt!.getTime() - row.pickedUpAt!.getTime()) / 60_000);
    if (!durations.length) return null;
    return Math.round(durations.reduce((acc, value) => acc + value, 0) / durations.length);
  }

  async topSellers(since: Date): Promise<Array<{ id: string; storeName: string; orders: number; revenue: number; platformRevenue: number }>> {
    const rows = await this.commissions
      .createQueryBuilder('commission')
      .innerJoin(Order, 'order', 'order.id = commission.orderId')
      .select('commission.sellerId', 'sellerId')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(order.payableTotal), 0)', 'revenue')
      .addSelect('COALESCE(SUM(commission.platformAmount), 0)', 'platformRevenue')
      .where('order.completedAt >= :since', { since })
      .groupBy('commission.sellerId')
      .orderBy('revenue', 'DESC')
      .limit(10)
      .getRawMany<{ sellerId: string; orders: string; revenue: string; platformRevenue: string }>();
    const ids = [...new Set(rows.map((row) => row.sellerId))];
    const sellers = ids.length ? await this.sellers.find({ where: { id: In(ids) } }) : [];
    const nameById = new Map(sellers.map((seller) => [seller.id, seller.storeName]));
    return rows.map((row) => ({
      id: row.sellerId,
      storeName: nameById.get(row.sellerId) ?? '—',
      orders: Number(row.orders),
      revenue: Number(row.revenue),
      platformRevenue: Number(row.platformRevenue),
    }));
  }

  /** سری زمانی روزانه برای نمودارها (داده واقعی، بر پایه تاریخ شمسی). */
  async dailySeries(days = 14): Promise<Array<{ date: string; jalali: string; orders: number; gmv: number; platformRevenue: number; requests: number }>> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const [orders, requests] = await Promise.all([
      this.orders.find({ where: { createdAt: MoreThanOrEqual(since) }, select: { id: true, createdAt: true, payableTotal: true, platformFee: true, status: true }, take: 5000 }),
      this.requests.find({ where: { createdAt: MoreThanOrEqual(since) }, select: { id: true, createdAt: true }, take: 5000 }),
    ]);

    const buckets = new Map<string, { orders: number; gmv: number; platformRevenue: number; requests: number }>();
    for (let index = 0; index < days; index += 1) {
      const day = new Date(since);
      day.setDate(since.getDate() + index);
      buckets.set(day.toISOString().slice(0, 10), { orders: 0, gmv: 0, platformRevenue: 0, requests: 0 });
    }
    const paidStatuses = ['PAID', 'SELLER_CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'WAITING_FOR_COURIER', 'COURIER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];
    for (const order of orders) {
      const bucket = buckets.get(order.createdAt.toISOString().slice(0, 10));
      if (!bucket) continue;
      bucket.orders += 1;
      if (paidStatuses.includes(order.status)) {
        bucket.gmv += order.payableTotal;
        bucket.platformRevenue += order.platformFee;
      }
    }
    for (const request of requests) {
      const bucket = buckets.get(request.createdAt.toISOString().slice(0, 10));
      if (bucket) bucket.requests += 1;
    }

    return [...buckets.entries()].map(([date, value]) => ({
      date,
      jalali: formatJalali(new Date(`${date}T00:00:00Z`)),
      ...value,
    }));
  }
}
