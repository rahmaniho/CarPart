import { Logger } from '@nestjs/common';
import type { EmailProvider, EmailSendInput, EmailSendResult } from './email-provider.interface';
import type { ProviderHealth } from './sms-provider.interface';

/** فراهم‌کننده آزمایشی ایمیل — ارسال واقعی انجام نمی‌دهد، فقط ثبت می‌کند. */
export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  readonly isLive = false;
  private readonly logger = new Logger('Email(mock)');
  private lastCheckedAt: string | null = null;

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    this.lastCheckedAt = new Date().toISOString();
    this.logger.warn(`[آزمایشی] ایمیل به ${input.to} با موضوع «${input.subject}»`);
    return { provider: this.name, messageId: `mock-email-${Date.now()}`, status: 'simulated', simulated: true, error: null };
  }

  health(): ProviderHealth {
    return { name: this.name, configured: true, live: false, lastError: null, lastCheckedAt: this.lastCheckedAt };
  }
}
