export interface SmsSendInput {
  mobile: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface SmsSendResult {
  provider: string;
  messageId: string | null;
  status: 'sent' | 'queued' | 'simulated' | 'failed';
  /** اگر true باشد، پیامکی واقعاً ارسال نشده و فقط ثبت شده است (حالت آزمایشی). */
  simulated: boolean;
  error?: string | null;
}

export interface ProviderHealth {
  name: string;
  configured: boolean;
  live: boolean;
  lastError: string | null;
  lastCheckedAt: string | null;
}

/** رابط سرویس پیامک — قابل جایگزینی بدون تغییر کد کسب‌وکاری. */
export interface SmsProvider {
  readonly name: string;
  readonly isLive: boolean;
  send(input: SmsSendInput): Promise<SmsSendResult>;
  health(): ProviderHealth;
}

export class SmsProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`سرویس پیامک «${provider}» پیکربندی نشده است (کلید API یا شماره ارسالکننده تنظیم نشده).`);
    this.name = 'SmsProviderNotConfiguredError';
  }
}
