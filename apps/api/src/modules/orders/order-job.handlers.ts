import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobRegistry } from '../jobs/job-registry';
import { NotificationsService } from '../notifications/notifications.service';
import { Seller } from '../sellers/entities/seller.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdersService } from './orders.service';

/** پردازش‌گرهای صف کار مربوط به چرخه سفارش. */
@Injectable()
export class OrderJobHandlers implements OnModuleInit {
  private readonly logger = new Logger(OrderJobHandlers.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    private readonly registry: JobRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      type: 'order.payment_expire',
      handle: async (payload) => {
        const orderId = String(payload.orderId ?? '');
        if (orderId) await this.orders.expireOrderIfUnpaid(orderId);
      },
    });

    this.registry.register({
      type: 'order.auto_complete',
      handle: async (payload) => {
        const orderId = String(payload.orderId ?? '');
        if (orderId) await this.orders.autoCompleteOrder(orderId);
      },
    });

    this.registry.register({
      type: 'order.seller_timeout',
      handle: async (payload) => {
        const orderId = String(payload.orderId ?? '');
        if (!orderId) return;
        const order = await this.orders.loadOrder(orderId);
        if (!['PAID', 'SELLER_CONFIRMED'].includes(order.status) || !order.sellerId) return;
        const seller = await this.sellers.findOne({ where: { id: order.sellerId } });
        if (!seller) return;
        this.logger.warn(`سفارش ${order.code} بیش از مهلت مقرر در وضعیت ${order.status} مانده است.`);
        await this.notifications
          .notify({
            userId: seller.userId,
            eventKey: 'order.created',
            subjectId: order.id,
            vars: { code: order.code, orderId: order.id, total: order.payableTotal },
            moneyVars: ['total'],
            dedupeKey: `order.seller-timeout:${order.id}`,
          })
          .catch(() => undefined);
      },
    });
  }
}
