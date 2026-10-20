export interface PushSendInput {
  /** توکن‌های دستگاه گیرنده (FCM) */
  tokens: string[];
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, unknown> | null;
  meta?: Record<string, unknown>;
}

export interface PushSendResult {
  provider: string;
  /** توکن‌هایی که ارسال موفق داشتند */
  deliveredTokens: string[];
  status: 'sent' | 'simulated' | 'failed';
  /** اگر true باشد، اعلانی واقعاً ارسال نشده و فقط ثبت شده است (حالت آزمایشی). */
  simulated: boolean;
  error?: string | null;
}

/** رابط سرویس اعلان فشاری (Push) — قابل جایگزینی (FCM، mock) بدون تغییر کد کسب‌وکاری. */
export interface PushProvider {
  readonly name: string;
  readonly isLive: boolean;
  send(input: PushSendInput): Promise<PushSendResult>;
}

export class PushProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`سرویس اعلان فشاری «${provider}» پیکربندی نشده است (کلید سرور FCM تنظیم نشده).`);
    this.name = 'PushProviderNotConfiguredError';
  }
}
