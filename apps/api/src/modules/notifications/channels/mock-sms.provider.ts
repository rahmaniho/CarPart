import { Logger } from '@nestjs/common';
import { maskMobile } from '@carpart/contract';
import type { ProviderHealth, SmsProvider, SmsSendInput, SmsSendResult } from './sms-provider.interface';

/**
 * فراهم‌کننده آزمایشی پیامک.
 * پیام واقعاً ارسال نمی‌شود؛ فقط ثبت و در پنل مدیریت قابل مشاهده است تا
 * هرگز با پیامک واقعی اشتباه گرفته نشود (simulated=true).
 */
export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock';
  readonly isLive = false;
  private readonly logger = new Logger('SMS(mock)');
  private lastCheckedAt: string | null = null;

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    this.lastCheckedAt = new Date().toISOString();
    this.logger.warn(`[آزمایشی] پیامک به ${maskMobile(input.mobile)}: ${input.message.slice(0, 140)}`);
    return {
      provider: this.name,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'simulated',
      simulated: true,
      error: null,
    };
  }

  health(): ProviderHealth {
    return { name: this.name, configured: true, live: false, lastError: null, lastCheckedAt: this.lastCheckedAt };
  }
}
