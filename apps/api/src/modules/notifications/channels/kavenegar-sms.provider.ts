import { Logger } from '@nestjs/common';
import {
  SmsProviderNotConfiguredError,
  type ProviderHealth,
  type SmsProvider,
  type SmsSendInput,
  type SmsSendResult,
} from './sms-provider.interface';

/**
 * آداپتر سرویس پیامک کاوه‌نگار.
 * فعال‌سازی: SMS_PROVIDER=kavenegar + SMS_API_KEY + SMS_SENDER
 * بدون کلید، خطای پیکربندی واضح برمی‌گرداند (هرگز پیامک آزمایشی را واقعی جا نمی‌زند).
 */
export class KavenegarSmsProvider implements SmsProvider {
  readonly name = 'kavenegar';
  readonly isLive = true;
  private readonly logger = new Logger('SMS(kavenegar)');
  private lastError: string | null = null;
  private lastCheckedAt: string | null = null;

  constructor(
    private readonly apiKey: () => string,
    private readonly sender: () => string,
    private readonly timeoutMs = 8000,
  ) {}

  private get configured(): boolean {
    return Boolean(this.apiKey() && this.sender());
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    this.lastCheckedAt = new Date().toISOString();
    if (!this.configured) throw new SmsProviderNotConfiguredError(this.name);
    const url = `https://api.kavenegar.com/v1/${this.apiKey()}/sms/send.json`;
    const body = new URLSearchParams({ sender: this.sender(), receptor: input.mobile, message: input.message });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body,
      });
      clearTimeout(timer);
      const data = (await response.json()) as { return: { status: number; message: string }; entries?: { messageid: number }[] };
      if (!response.ok || data?.return?.status !== 200) {
        throw new Error(data?.return?.message ?? `پاسخ ${response.status} از کاوه‌نگار`);
      }
      this.lastError = null;
      return {
        provider: this.name,
        messageId: String(data.entries?.[0]?.messageid ?? ''),
        status: 'sent',
        simulated: false,
        error: null,
      };
    } catch (error) {
      this.lastError = (error as Error).message;
      this.logger.error(`ارسال پیامک ناموفق بود: ${this.lastError}`);
      return { provider: this.name, messageId: null, status: 'failed', simulated: false, error: this.lastError };
    }
  }

  health(): ProviderHealth {
    return { name: this.name, configured: this.configured, live: this.configured && !this.lastError, lastError: this.lastError, lastCheckedAt: this.lastCheckedAt };
  }
}
