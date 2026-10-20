import type { PaymentMode } from '@carpart/contract';

export interface PaymentInitInput {
  orderId: string;
  orderCode: string;
  amount: number;
  currency: string;
  userId: string;
  mobile: string;
  description: string;
  returnUrl: string;
  idempotencyKey?: string | null;
}

export interface PaymentInitResult {
  authority: string;
  paymentUrl: string;
  signature?: string;
  expiresAt: Date;
  raw: Record<string, unknown>;
}

export interface PaymentVerifyInput {
  orderId: string;
  amount: number;
  authority: string;
  signature?: string | null;
  /** نتیجه اعلامی درگاه (فقط در حالت آزمایشی کاربرد دارد) */
  gatewayStatus?: string | null;
  raw?: Record<string, unknown>;
}

export interface PaymentVerifyResult {
  success: boolean;
  referenceId?: string | null;
  trackingNumber?: string | null;
  cardPanMasked?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
  raw: Record<string, unknown>;
}

export interface RefundInput {
  paymentId: string;
  referenceId: string | null;
  amount: number;
  orderId: string;
  reason?: string | null;
}

export interface RefundResult {
  success: boolean;
  providerRef?: string | null;
  message?: string | null;
  manualRequired?: boolean;
  raw?: Record<string, unknown>;
}

export interface ProviderReadiness {
  configured: boolean;
  reason?: string;
  mode: PaymentMode;
}

/**
 * رابط فراهم‌کننده پرداخت.
 *
 * هر درگاه (آزمایشی یا واقعی) این رابط را پیاده‌سازی می‌کند و انتخاب آن از تنظیمات انجام می‌شود.
 * هیچ‌گاه به اعلام سمت کاربر اعتماد نمی‌شود: نتیجه پرداخت فقط از مسیر verify سمت سرور پذیرفته می‌شود.
 */
export interface PaymentProvider {
  readonly name: string;
  readonly mode: PaymentMode;
  readiness(): ProviderReadiness;
  createPayment(input: PaymentInitInput): Promise<PaymentInitResult>;
  verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}
