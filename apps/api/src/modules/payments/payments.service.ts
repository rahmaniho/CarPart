import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import type { PaymentMode, PaymentStatus } from '@carpart/contract';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { PaymentEvent } from './entities/payment-event.entity';
import { Payment } from './entities/payment.entity';
import type { PaymentProvider, PaymentVerifyResult, ProviderReadiness } from './payment-provider.interface';
import { SandboxPaymentProvider } from './providers/sandbox.provider';
import { ZarinpalPaymentProvider } from './providers/zarinpal.provider';
import { CreatePaymentDto, VerifyPaymentDto } from './dto/payment.dto';

export interface PaymentInitiation {
  paymentId: string;
  orderId: string;
  orderCode: string;
  amount: number;
  currency: string;
  provider: string;
  mode: PaymentMode;
  paymentUrl: string;
  expiresAt: string;
  /** هشدار شفاف درباره آزمایشی بودن درگاه */
  sandboxNotice: string | null;
}

/**
 * سرویس پرداخت.
 *
 * قواعد کلیدی:
 * - مبلغ پرداخت همیشه از سفارشِ سمت سرور خوانده می‌شود؛ مقدار ارسالی کاربر نادیده گرفته می‌شود.
 * - نتیجه پرداخت فقط از مسیر تأیید سمت سرور (verify) پذیرفته می‌شود.
 * - کلید یکتاسازی از ثبت تراکنش تکراری برای یک سفارش جلوگیری می‌کند.
 * - حالت درگاه (آزمایشی/واقعی) در پاسخ‌ها به‌صورت شفاف اعلام می‌شود.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly providers: Map<string, PaymentProvider>;

  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(PaymentEvent) private readonly events: Repository<PaymentEvent>,
    @Inject(CONFIG_TOKEN) private readonly config: AppConfig,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
    private readonly settings: SystemSettingsService,
  ) {
    const sandbox = new SandboxPaymentProvider(() => ({
      secret: this.config.payment.sandboxSecret,
      webUrl: this.config.app.webUrl,
      isProduction: this.config.app.isProduction,
      expireMinutes: this.config.payment.expireMinutes,
    }));
    const zarinpal = new ZarinpalPaymentProvider(() => ({
      merchantId: this.config.payment.zarinpalMerchantId,
      apiUrl: this.config.payment.zarinpalApiUrl,
      callbackUrl: `${this.config.app.webUrl.replace(/\/$/, '')}/payment/callback`,
      isProduction: this.config.app.isProduction,
      expireMinutes: this.config.payment.expireMinutes,
    }));
    this.providers = new Map<string, PaymentProvider>([
      [sandbox.name, sandbox],
      [zarinpal.name, zarinpal],
    ]);
  }

  /** فراهم‌کننده فعال (از تنظیمات سامانه با مقدار پیش‌فرض env). */
  async activeProvider(): Promise<PaymentProvider> {
    const name = await this.settings.getString('payment.provider', this.config.payment.provider);
    const provider = this.providers.get(name);
    if (!provider) {
      throw new AppException(`فراهم‌کننده پرداخت «${name}» پشتیبانی نمی‌شود.`, ErrorCodes.PAYMENT_PROVIDER_UNAVAILABLE, {
        statusCode: 503,
      });
    }
    return provider;
  }

  private assertReady(provider: PaymentProvider): ProviderReadiness {
    const readiness = provider.readiness();
    if (!readiness.configured) {
      throw new AppException(
        readiness.mode === 'live'
          ? `درگاه پرداخت واقعی پیکربندی نشده است: ${readiness.reason}`
          : `درگاه پرداخت در دسترس نیست: ${readiness.reason}`,
        readiness.mode === 'live' ? ErrorCodes.PAYMENT_NOT_LIVE_CONFIGURED : ErrorCodes.PAYMENT_PROVIDER_UNAVAILABLE,
        { statusCode: 503, details: { provider: provider.name } },
      );
    }
    return readiness;
  }

  async readiness(): Promise<Array<{ name: string; mode: PaymentMode; configured: boolean; reason?: string; active: boolean }>> {
    const active = await this.activeProvider();
    return [...this.providers.values()].map((provider) => {
      const readiness = provider.readiness();
      return {
        name: provider.name,
        mode: provider.mode,
        configured: readiness.configured,
        reason: readiness.reason,
        active: provider.name === active.name,
      };
    });
  }

  /** ساخت تراکنش پرداخت برای یک سفارش (با بازاستفاده از تراکنش معتبر قبلی). */
  async createForOrder(userId: string, dto: CreatePaymentDto, idempotencyKey?: string | null): Promise<PaymentInitiation> {
    const order = await this.orders.loadOrder(dto.orderId);
    this.orders.assertReadAccess(order, userId, null);

    if (order.paymentStatus === 'SUCCESS' || order.paidAt) {
      throw new AppException('این سفارش پیش‌تر پرداخت شده است.', ErrorCodes.PAYMENT_ALREADY_PROCESSED, { statusCode: 409 });
    }
    if (!['WAITING_FOR_PAYMENT', 'PAYMENT_FAILED'].includes(order.status)) {
      throw new AppException('وضعیت سفارش اجازه پرداخت ندارد.', ErrorCodes.ORDER_TRANSITION_FORBIDDEN, { statusCode: 409 });
    }
    if (!order.payableTotal || order.payableTotal <= 0) {
      throw new AppException('مبلغ قابل پرداخت سفارش معتبر نیست.', ErrorCodes.ORDER_NOT_EDITABLE, { statusCode: 409 });
    }

    const provider = await this.activeProvider();
    this.assertReady(provider);

    // تراکنش معتبر و درجریان قبلی دوباره استفاده می‌شود (جلوگیری از تراکنش تکراری)
    const reusable = await this.payments.findOne({
      where: { orderId: order.id, status: In(['CREATED', 'PENDING']), provider: provider.name },
      order: { createdAt: 'DESC' },
    });
    if (reusable && (!reusable.expiresAt || reusable.expiresAt > new Date())) {
      const storedUrl = (reusable.requestPayload?.paymentUrl as string | undefined) ?? null;
      if (storedUrl) return this.toInitiation(order.id, order.code, reusable, storedUrl);
    }

    const amount = order.payableTotal;
    const initiation = await provider.createPayment({
      orderId: order.id,
      orderCode: order.code,
      amount,
      currency: order.currency,
      userId,
      mobile: '',
      description: `سفارش ${order.code} — کارپارت`,
      returnUrl: dto.returnUrl ?? `${this.config.app.webUrl.replace(/\/$/, '')}/payment/callback`,
      idempotencyKey: idempotencyKey ?? null,
    });

    const payment = await this.payments.save(
      this.payments.create({
        orderId: order.id,
        userId,
        provider: provider.name,
        mode: provider.mode,
        amount,
        status: 'PENDING',
        referenceId: null,
        gatewayAuthority: initiation.authority,
        idempotencyKey: idempotencyKey ?? null,
        requestPayload: { ...initiation.raw, paymentUrl: initiation.paymentUrl, signature: initiation.signature ?? null },
        expiresAt: initiation.expiresAt,
      }),
    );
    await this.recordEvent(payment.id, 'created', 'internal', { authority: initiation.authority, provider: provider.name });

    if (order.status === 'PAYMENT_FAILED') {
      await this.orders.systemTransition(order.id, 'WAITING_FOR_PAYMENT', 'تلاش مجدد پرداخت');
    }

    return this.toInitiation(order.id, order.code, payment, initiation.paymentUrl);
  }

  private toInitiation(orderId: string, orderCode: string, payment: Payment, paymentUrl: string): PaymentInitiation {
    return {
      paymentId: payment.id,
      orderId,
      orderCode,
      amount: payment.amount,
      currency: 'IRT',
      provider: payment.provider,
      mode: payment.mode,
      paymentUrl,
      expiresAt: (payment.expiresAt ?? new Date()).toISOString(),
      sandboxNotice:
        payment.mode === 'sandbox'
          ? 'درگاه آزمایشی است؛ هیچ تراکنش واقعی انجام نمی‌شود و نتیجه فقط برای تست جریان سفارش است.'
          : null,
    };
  }

  /** تأیید سمت سرور تراکنش — تنها مسیر پذیرش موفقیت پرداخت. */
  async verify(dto: VerifyPaymentDto, userId?: string | null): Promise<{ payment: Payment; orderStatus: string; alreadyProcessed: boolean }> {
    const payment = await this.findPayment(dto);
    if (userId && payment.userId !== userId) {
      throw new AppException('این تراکنش متعلق به شما نیست.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    if (payment.status === 'SUCCESS') {
      const order = await this.orders.loadOrder(payment.orderId);
      if (order.paymentStatus !== 'SUCCESS') {
        const lockSeconds = await this.settings.getNumber('payment.verification_lock_seconds', 120);
        const isRecent = Date.now() - payment.updatedAt.getTime() <= lockSeconds * 1_000;
        if (isRecent) {
          throw new AppException('قطعی‌سازی این پرداخت هم‌اکنون در حال انجام است؛ چند لحظه دیگر دوباره بررسی کنید.', ErrorCodes.PAYMENT_VERIFICATION_IN_PROGRESS, {
            statusCode: 409,
            retryable: true,
          });
        }
        // بازیابی پس از توقف پردازش قبلی: markPaid ذاتاً تکرارپذیر است.
        await this.orders.markPaid(payment.orderId, payment);
      }
      const updatedOrder = await this.orders.loadOrder(payment.orderId);
      return { payment, orderStatus: updatedOrder.status, alreadyProcessed: true };
    }
    if (payment.expiresAt && payment.expiresAt < new Date() && payment.status !== 'FAILED') {
      payment.status = 'EXPIRED';
      await this.payments.save(payment);
      await this.recordEvent(payment.id, 'expired', 'internal', null);
    }

    const provider = this.providers.get(payment.provider);
    if (!provider) {
      throw new AppException(`فراهم‌کننده «${payment.provider}» در دسترس نیست.`, ErrorCodes.PAYMENT_PROVIDER_UNAVAILABLE, {
        statusCode: 503,
      });
    }
    this.assertReady(provider);

    // قفل توزیع‌شده با UPDATE شرطی: فقط یک پردازش در تمام instanceها اجازه تماس با
    // درگاه و اعمال اثر مالی را دارد. قفل رهاشده پس از timeout قابل بازیابی است.
    const lockSeconds = await this.settings.getNumber('payment.verification_lock_seconds', 120);
    const staleBefore = new Date(Date.now() - lockSeconds * 1_000);
    const claim = await this.payments
      .createQueryBuilder()
      .update(Payment)
      .set({ status: 'VERIFYING' })
      .where('"id" = :id', { id: payment.id })
      .andWhere('(status IN (:...claimable) OR (status = :verifying AND "updatedAt" < :staleBefore))', {
        claimable: ['CREATED', 'PENDING', 'FAILED', 'EXPIRED'],
        verifying: 'VERIFYING',
        staleBefore,
      })
      .execute();
    if (!claim.affected) {
      const current = await this.payments.findOne({ where: { id: payment.id } });
      if (current?.status === 'SUCCESS') {
        await this.orders.markPaid(current.orderId, current);
        const currentOrder = await this.orders.loadOrder(current.orderId);
        return { payment: current, orderStatus: currentOrder.status, alreadyProcessed: true };
      }
      if (current?.status === 'VERIFYING') {
        throw new AppException('تأیید این تراکنش هم‌اکنون در حال انجام است؛ چند لحظه دیگر دوباره بررسی کنید.', ErrorCodes.PAYMENT_VERIFICATION_IN_PROGRESS, {
          statusCode: 409,
          retryable: true,
        });
      }
      throw new AppException('این تراکنش قبلاً تعیین تکلیف شده است.', ErrorCodes.PAYMENT_ALREADY_PROCESSED, { statusCode: 409 });
    }
    payment.status = 'VERIFYING';

    const order = await this.orders.loadOrder(payment.orderId);
    let result: PaymentVerifyResult;
    try {
      result = await provider.verifyPayment({
        orderId: payment.orderId,
        amount: payment.amount,
        authority: dto.authority ?? payment.gatewayAuthority ?? '',
        signature: dto.signature ?? ((payment.requestPayload?.signature as string | null) ?? null),
        gatewayStatus: dto.gatewayStatus ?? null,
      });
    } catch (error) {
      await this.payments.update({ id: payment.id, status: 'VERIFYING' }, { status: 'PENDING' });
      await this.recordEvent(payment.id, 'verify_error', 'internal', { message: (error as Error).message }).catch(() => undefined);
      throw error;
    }
    await this.recordEvent(payment.id, result.success ? 'verify_success' : 'verify_failed', 'gateway', result.raw);

    if (result.success) {
      payment.status = 'SUCCESS';
      payment.referenceId = result.referenceId ?? null;
      payment.gatewayTrackingNumber = result.trackingNumber ?? null;
      payment.cardPanMasked = result.cardPanMasked ?? null;
      payment.paidAt = new Date();
      payment.verifyPayload = result.raw;
      // ثبت SUCCESS پیش از گذار سفارش برای عبور گارد paymentConfirmed لازم است.
      // درخواست‌های هم‌زمان تا پایان lock window وارد مسیر بازیابی نمی‌شوند.
      await this.payments.save(payment);
      await this.orders.markPaid(payment.orderId, payment);
      const updatedOrder = await this.orders.loadOrder(payment.orderId);
      if (updatedOrder.payableTotal !== payment.amount) {
        this.logger.warn(`مبلغ تراکنش ${payment.referenceId} با مبلغ سفارش ${updatedOrder.code} مطابقت ندارد.`);
      }
      await this.notifications
        .notify({
          userId: order.userId,
          eventKey: 'order.paid',
          subjectId: order.id,
          vars: { code: order.code, orderId: order.id, mode: payment.mode === 'sandbox' ? 'درگاه آزمایشی' : 'درگاه واقعی' },
          data: { orderId: order.id, paymentId: payment.id },
          dedupeKey: `order.paid.user:${order.id}`,
        })
        .catch(() => undefined);
      return { payment, orderStatus: updatedOrder.status, alreadyProcessed: false };
    }

    payment.status = 'FAILED';
    payment.failureCode = result.failureCode ?? 'UNKNOWN';
    payment.failureReason = result.failureReason ?? 'تأیید تراکنش ناموفق بود.';
    payment.verifyPayload = result.raw;
    await this.payments.save(payment);
    if (order.status === 'WAITING_FOR_PAYMENT') {
      await this.orders.systemTransition(order.id, 'PAYMENT_FAILED', 'ثبت شکست پرداخت');
    }
    await this.notifications
      .notify({
        userId: order.userId,
        eventKey: 'order.payment_failed',
        subjectId: order.id,
        vars: { code: order.code, orderId: order.id },
        data: { orderId: order.id, paymentId: payment.id },
      })
      .catch(() => undefined);
    return { payment, orderStatus: (await this.orders.loadOrder(payment.orderId)).status, alreadyProcessed: false };
  }

  private async findPayment(dto: VerifyPaymentDto): Promise<Payment> {
    if (dto.paymentId) {
      const payment = await this.payments.findOne({ where: { id: dto.paymentId } });
      if (!payment) throw new NotFoundException('تراکنش پرداخت');
      return payment;
    }
    if (dto.authority) {
      const payment = await this.payments.findOne({ where: { gatewayAuthority: dto.authority }, order: { createdAt: 'DESC' } });
      if (!payment) throw new NotFoundException('تراکنش پرداخت');
      return payment;
    }
    throw new AppException('شناسه تراکنش یا authority لازم است.', ErrorCodes.VALIDATION_FAILED);
  }

  /**
   * شبیه‌سازی تأیید کاربر در صفحه درگاه آزمایشی.
   * فقط وقتی فعال است که فراهم‌کننده فعال «sandbox» باشد و محیط production نباشد.
   */
  async sandboxConfirm(userId: string, orderId: string, decision: 'paid' | 'failed'): Promise<{ payment: Payment; orderStatus: string }> {
    const provider = await this.activeProvider();
    if (provider.name !== 'sandbox' || this.config.app.isProduction) {
      throw new AppException('این مسیر فقط در حالت درگاه آزمایشی و خارج از محیط production فعال است.', ErrorCodes.PAYMENT_PROVIDER_UNAVAILABLE, {
        statusCode: 403,
      });
    }
    const order = await this.orders.loadOrder(orderId);
    this.orders.assertReadAccess(order, userId, null);
    const payment = await this.payments.findOne({
      where: { orderId, provider: 'sandbox', status: In(['CREATED', 'PENDING', 'VERIFYING', 'SUCCESS']) },
      order: { createdAt: 'DESC' },
    });
    if (!payment) throw new NotFoundException('تراکنش پرداخت آزمایشی');
    const result = await this.verify({
      paymentId: payment.id,
      authority: payment.gatewayAuthority ?? undefined,
      gatewayStatus: decision,
    }, userId);
    return { payment: result.payment, orderStatus: result.orderStatus };
  }

  async listMine(userId: string, query: { page?: number; pageSize?: number; status?: PaymentStatus } = {}): Promise<PageResult<Payment>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = { userId };
    if (query.status) where.status = query.status;
    const [items, total] = await this.payments.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items.map((item) => this.publicView(item)), total, query.page ?? 1, query.pageSize ?? 20);
  }

  async getMine(userId: string, paymentId: string): Promise<Payment> {
    const payment = await this.payments.findOne({ where: { id: paymentId, userId } });
    if (!payment) throw new NotFoundException('تراکنش پرداخت');
    return this.publicView(payment);
  }

  async listAll(query: { page?: number; pageSize?: number; status?: PaymentStatus; provider?: string } = {}): Promise<PageResult<Payment>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.provider) where.provider = query.provider;
    const [items, total] = await this.payments.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  /** حذف داده‌های خام درگاه از پاسخ کاربر. */
  private publicView(payment: Payment): Payment {
    return { ...payment, requestPayload: null, verifyPayload: null } as Payment;
  }

  async findByOrder(orderId: string): Promise<Payment[]> {
    return this.payments.find({ where: { orderId }, order: { createdAt: 'DESC' } });
  }

  /** انقضای تراکنش‌های بی‌پاسخ. */
  async expireStale(now = new Date()): Promise<number> {
    const stale = await this.payments.find({ where: { status: In(['CREATED', 'PENDING']), expiresAt: LessThan(now) }, take: 200 });
    for (const payment of stale) {
      payment.status = 'EXPIRED';
      await this.payments.save(payment);
      await this.recordEvent(payment.id, 'expired', 'internal', null);
    }
    return stale.length;
  }

  async recordEvent(paymentId: string, event: string, source: 'gateway' | 'internal' | 'webhook', payload: Record<string, unknown> | null): Promise<void> {
    await this.events.save(this.events.create({ paymentId, event, source, payload, note: null }));
  }

  async totals(rangeDays = 30): Promise<{ count: number; success: number; failed: number; amountSuccess: number; amountFailed: number }> {
    const since = new Date(Date.now() - rangeDays * 86_400_000);
    const rows = await this.payments
      .createQueryBuilder('payment')
      .select('payment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'amount')
      .where('payment.createdAt >= :since', { since })
      .groupBy('payment.status')
      .getRawMany<{ status: string; count: string; amount: string }>();
    const summary = { count: 0, success: 0, failed: 0, amountSuccess: 0, amountFailed: 0 };
    for (const row of rows) {
      summary.count += Number(row.count);
      if (row.status === 'SUCCESS') {
        summary.success += Number(row.count);
        summary.amountSuccess += Number(row.amount);
      }
      if (row.status === 'FAILED') {
        summary.failed += Number(row.count);
        summary.amountFailed += Number(row.amount);
      }
    }
    return summary;
  }
}
