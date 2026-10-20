import type { PaymentMode } from '@carpart/contract';
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

export interface ZarinpalProviderOptions {
  merchantId: string;
  apiUrl: string;
  callbackUrl: string;
  isProduction: boolean;
  expireMinutes: number;
}

interface ZarinpalResponse<T> {
  data?: T & { code?: number; message?: string };
  errors?: { code?: number; message?: string; validations?: Record<string, unknown> };
}

/**
 * آداپتر درگاه زرین‌پال (ساختار واقعی API).
 *
 * این آداپتر فقط زمانی فعال است که شناسه پذیرنده (merchant id) در تنظیمات محیطی وارد شده باشد؛
 * در غیر این صورت با خطای شفاف «درگاه واقعی پیکربندی نشده» رد می‌شود و هرگز به‌صورت خاموش
 * به درگاه آزمایشی سقوط نمی‌کند.
 *
 * وضعیت در این محیط توسعه: پیاده‌سازی‌شده اما «آزمایش‌نشده با اعتبارنامه واقعی» (بدون کلید معتبر).
 */
export class ZarinpalPaymentProvider implements PaymentProvider {
  readonly name = 'zarinpal';
  readonly mode: PaymentMode = 'live';

  constructor(private readonly options: () => ZarinpalProviderOptions) {}

  readiness(): ProviderReadiness {
    const { merchantId } = this.options();
    if (!merchantId) {
      return { configured: false, mode: this.mode, reason: 'شناسه پذیرنده زرین‌پال (ZARINPAL_MERCHANT_ID) تنظیم نشده است.' };
    }
    return { configured: true, mode: this.mode };
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<ZarinpalResponse<T>> {
    const { apiUrl } = this.options();
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`پاسخ نامعتبر درگاه (${response.status})`);
    }
    return (await response.json()) as ZarinpalResponse<T>;
  }

  async createPayment(input: PaymentInitInput): Promise<PaymentInitResult> {
    const { merchantId, expireMinutes } = this.options();
    const result = await this.post<{ authority: string; fee_type: string }>('/request.json', {
      merchant_id: merchantId,
      amount: input.amount,
      callback_url: input.returnUrl,
      description: input.description,
      metadata: { order_id: input.orderId, order_code: input.orderCode, mobile: input.mobile, user_id: input.userId },
    });
    const code = result.data?.code;
    if (code !== 100 || !result.data?.authority) {
      throw new Error(`درگاه درخواست پرداخت را نپذیرفت (کد ${code ?? 'نامشخص'}: ${result.data?.message ?? result.errors?.message ?? 'خطای نامشخص'})`);
    }
    return {
      authority: result.data.authority,
      paymentUrl: `https://www.zarinpal.com/pg/StartPay/${result.data.authority}`,
      expiresAt: new Date(Date.now() + expireMinutes * 60_000),
      raw: { provider: this.name, code, fee_type: result.data.fee_type },
    };
  }

  async verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
    const { merchantId } = this.options();
    const status = String(input.gatewayStatus ?? '');
    if (status && status !== 'OK') {
      return {
        success: false,
        failureCode: `GATEWAY_${status}`,
        failureReason: 'درگاه، بازگشت کاربر را ناموفق اعلام کرد.',
        raw: { ...input.raw, status },
      };
    }
    const result = await this.post<{ ref_id: number; card_pan?: string }>('/verify.json', {
      merchant_id: merchantId,
      amount: input.amount,
      authority: input.authority,
    });
    const code = result.data?.code;
    if ((code === 100 || code === 101) && result.data?.ref_id) {
      return {
        success: true,
        referenceId: String(result.data.ref_id),
        trackingNumber: String(result.data.ref_id),
        cardPanMasked: result.data.card_pan ?? null,
        raw: { ...input.raw, code },
      };
    }
    return {
      success: false,
      failureCode: `ZARINPAL_${code ?? 'UNKNOWN'}`,
      failureReason: result.data?.message ?? result.errors?.message ?? 'تأیید تراکنش ناموفق بود.',
      raw: { ...input.raw, code },
    };
  }

  async refund(_input: RefundInput): Promise<RefundResult> {
    return {
      success: false,
      manualRequired: true,
      message: 'بازپرداخت در زرین‌پال از طریق API عمومی انجام نمی‌شود؛ باید دستی در پنل پذیرنده اجرا و سپس اینجا ثبت شود.',
    };
  }
}
