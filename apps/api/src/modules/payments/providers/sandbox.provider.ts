import { randomUUID } from 'node:crypto';
import type { PaymentMode } from '@carpart/contract';
import { hmac, safeEqual } from '../../../common/utils/crypto';
import type {
  PaymentInitInput,
  PaymentInitResult,
  PaymentProvider,
  PaymentVerifyInput,
  PaymentVerifyResult,
  ProviderReadiness,
  RefundInput,
  RefundResult,
} from '../payment-provider.interface';

export interface SandboxProviderOptions {
  secret: string;
  webUrl: string;
  isProduction: boolean;
  expireMinutes: number;
}

/**
 * درگاه پرداخت آزمایشی (شبیه‌ساز).
 *
 * این فراهم‌کننده هیچ پولی جابه‌جا نمی‌کند و فقط برای توسعه و تست جریان سفارش است.
 * با این حال «تأیید سمت سرور» را به‌صورت واقعی پیاده می‌کند: امضای HMAC با کلید مخفی
 * ساخته می‌شود و بدون آن هیچ پاسخی به‌عنوان پرداخت موفق پذیرفته نمی‌شود.
 * در محیط production این درگاه غیرفعال است.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = 'sandbox';
  readonly mode: PaymentMode = 'sandbox';

  constructor(private readonly options: () => SandboxProviderOptions) {}

  readiness(): ProviderReadiness {
    const { isProduction, secret } = this.options();
    if (isProduction) {
      return { configured: false, mode: this.mode, reason: 'درگاه آزمایشی در محیط production غیرفعال است.' };
    }
    if (!secret) return { configured: false, mode: this.mode, reason: 'کلید امضای درگاه آزمایشی تنظیم نشده است.' };
    return { configured: true, mode: this.mode };
  }

  private sign(orderId: string, amount: number, authority: string): string {
    return hmac(this.options().secret, `carpart-pay:${orderId}:${amount}:${authority}`);
  }

  async createPayment(input: PaymentInitInput): Promise<PaymentInitResult> {
    const authority = `sbx-${randomUUID()}`;
    const signature = this.sign(input.orderId, input.amount, authority);
    const { webUrl, expireMinutes } = this.options();
    const params = new URLSearchParams({
      authority,
      orderId: input.orderId,
      amount: String(input.amount),
      signature,
      orderCode: input.orderCode,
    });
    return {
      authority,
      signature,
      paymentUrl: `${webUrl.replace(/\/$/, '')}/payment/sandbox?${params.toString()}`,
      expiresAt: new Date(Date.now() + expireMinutes * 60_000),
      raw: {
        simulated: true,
        provider: this.name,
        notice: 'این یک درگاه آزمایشی است و هیچ تراکنش واقعی انجام نمی‌شود.',
      },
    };
  }

  async verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
    const expected = this.sign(input.orderId, input.amount, input.authority);
    if (!input.signature || !safeEqual(expected, input.signature)) {
      return {
        success: false,
        failureCode: 'SIGNATURE_INVALID',
        failureReason: 'امضای تراکنش معتبر نیست.',
        raw: { ...input.raw },
      };
    }
    const decision = (input.gatewayStatus ?? 'paid').toLowerCase();
    if (decision === 'failed' || decision === 'cancel' || decision === 'cancelled') {
      return {
        success: false,
        failureCode: 'USER_CANCELLED',
        failureReason: 'پرداخت توسط کاربر یا درگاه ناموفق اعلام شد.',
        raw: { ...input.raw, decision },
      };
    }
    return {
      success: true,
      referenceId: `sbx-ref-${randomUUID().slice(0, 12)}`,
      trackingNumber: String(Math.floor(Date.now() / 1000)),
      cardPanMasked: '****-****-****-1234',
      raw: { ...input.raw, simulated: true, decision },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      success: true,
      providerRef: `sbx-refund-${randomUUID().slice(0, 12)}`,
      message: 'بازپرداخت در درگاه آزمایشی به‌صورت شبیه‌سازی‌شده ثبت شد.',
      raw: { simulated: true, amount: input.amount, paymentId: input.paymentId },
    };
  }
}
