import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { JobContext } from '../jobs/job-registry';
import { JobRegistry } from '../jobs/job-registry';
import { DeliveryService } from './delivery.service';

/** پردازش‌گرهای صف کار برای مأموریت‌های ارسال. */
@Injectable()
export class DeliveryJobHandlers implements OnModuleInit {
  private readonly logger = new Logger(DeliveryJobHandlers.name);

  constructor(
    private readonly delivery: DeliveryService,
    private readonly registry: JobRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      type: 'delivery.create_from_order',
      handle: async (payload: Record<string, unknown>, _context: JobContext) => {
        const orderId = String(payload.orderId ?? '');
        if (orderId) await this.delivery.createFromOrder(orderId);
      },
    });
    this.registry.register({
      type: 'delivery.assign',
      handle: async (payload: Record<string, unknown>) => {
        const deliveryId = String(payload.deliveryId ?? '');
        const orderId = String(payload.orderId ?? '');
        if (deliveryId) {
          await this.delivery.assign(deliveryId);
          return;
        }
        if (orderId) {
          const mission = await this.delivery.createFromOrder(orderId);
          await this.delivery.assign(mission.id);
        }
      },
    });
    this.registry.register({
      type: 'delivery.offer_timeout',
      handle: async (payload: Record<string, unknown>) => {
        const deliveryId = String(payload.deliveryId ?? '');
        if (deliveryId) await this.delivery.handleOfferTimeout(deliveryId);
      },
    });
    this.registry.register({
      type: 'delivery.cancel_for_order',
      handle: async (payload: Record<string, unknown>) => {
        const orderId = String(payload.orderId ?? '');
        if (!orderId) return;
        const mission = await this.delivery.forOrder(orderId);
        if (mission) await this.delivery.cancel(mission.id, String(payload.reason ?? 'لغو سفارش'), 'system');
      },
    });
    this.registry.register({
      type: 'delivery.retry_reminder',
      handle: async (payload: Record<string, unknown>) => {
        const deliveryId = String(payload.deliveryId ?? '');
        if (!deliveryId) return;
        const mission = await this.delivery.requireDelivery(deliveryId);
        if (mission.status === 'DELIVERY_ATTEMPTED') {
          this.logger.log(`یادآوری تلاش مجدد تحویل برای مأموریت ${mission.code}`);
        }
      },
    });
  }
}
