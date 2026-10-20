import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CouriersService } from '../modules/couriers/couriers.service';
import { IdempotencyService } from '../modules/idempotency/idempotency.service';
import { OrdersService } from '../modules/orders/orders.service';
import { PaymentsService } from '../modules/payments/payments.service';
import { QuotesService } from '../modules/requests/quotes.service';
import { RequestsService } from '../modules/requests/requests.service';
import { SystemSettingsService } from '../modules/settings/system-settings.service';

/**
 * فرایندهای زمان‌بندی‌شده نگهداری.
 *
 * صف کارها (JobQueue) زمان‌بندی دقیق هر رویداد را بر عهده دارد؛ این زمان‌بند
 * به‌عنوان لایه اطمینان، جاروب‌های دوره‌ای را اجرا می‌کند تا اگر کاری
 * به هر دلیل اجرا نشد، وضعیت سامانه ناسازگار نماند.
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  private running = false;

  constructor(
    private readonly requests: RequestsService,
    private readonly quotes: QuotesService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly couriers: CouriersService,
    private readonly idempotency: IdempotencyService,
    private readonly settings: SystemSettingsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const requests = await this.requests
        .expireDue()
        .catch((error) => this.failed('انقضای درخواست‌ها', error, { expired: 0, unfulfilled: 0, quotesExpired: 0 }));
      const quotes = await this.quotes.expireQuotes().catch((error) => this.failed('انقضای پیشنهادها', error, 0));
      const orders = await this.orders.expireUnpaidPayments().catch((error) => this.failed('لغو سفارش‌های پرداخت‌نشده', error, 0));
      const payments = await this.payments.expireStale().catch((error) => this.failed('انقضای تراکنش‌ها', error, 0));

      const activity = requests.expired + requests.unfulfilled + quotes + orders + payments;
      if (activity > 0) this.logger.log(`جاروب دوره‌ای: ${activity} مورد بسته یا منقضی شد.`);
    } finally {
      this.running = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async hourly(): Promise<void> {
    const retentionHours = await this.settings.getNumber('courier.location.retention_hours', 24);
    const removedLocations = await this.couriers.cleanupLocations(retentionHours).catch((error) => this.failed('پاک‌سازی موقعیت پیک‌ها', error, 0));
    const cleanedKeys = await this.idempotency.cleanup().catch((error) => this.failed('پاک‌سازی کلیدهای یکتاسازی', error, 0));
    await this.quotes.refreshSellerResponseTimes().catch((error) => this.failed('به‌روزرسانی زمان پاسخ فروشندگان', error, 0));
    const delivered = await this.orders.autoCompleteDelivered().catch((error) => this.failed('تکمیل خودکار سفارش‌ها', error, 0));
    if (removedLocations || cleanedKeys || delivered) {
      this.logger.log(`نگهداری ساعتی: ${removedLocations} نمونه موقعیت، ${cleanedKeys} کلید و ${delivered} سفارش پردازش شد.`);
    }
  }

  private failed<T>(context: string, error: unknown, fallback: T): T {
    this.logger.warn(`${context} ناموفق بود: ${(error as Error).message}`);
    return fallback;
  }
}
