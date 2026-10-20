import type { EmailProvider, EmailSendInput, EmailSendResult } from './email-provider.interface';
import type { ProviderHealth } from './sms-provider.interface';

/**
 * آداپتر SMTP.
 *
 * وضعیت فعلی: پیاده‌سازی نشده. برای فعال‌سازی ارسال واقعی ایمیل باید یک کتابخانه SMTP
 * (مانند nodemailer) به وابستگی‌ها اضافه و این کلاس تکمیل شود. تا آن زمان health()
 * مقدار configured=false برمی‌گرداند و سامانه از ایمیل استفاده نمی‌کند.
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  readonly isLive = false;

  constructor(private readonly smtpUrl: () => string) {}

  private get configured(): boolean {
    return Boolean(this.smtpUrl());
  }

  async send(_input: EmailSendInput): Promise<EmailSendResult> {
    return {
      provider: this.name,
      messageId: null,
      status: 'failed',
      simulated: false,
      error: 'ارسال واقعی ایمیل در این نسخه پیاده‌سازی نشده است. EMAIL_PROVIDER=mock را نگه دارید یا آداپتر SMTP را تکمیل کنید.',
    };
  }

  health(): ProviderHealth {
    return {
      name: this.name,
      configured: false,
      live: false,
      lastError: 'پیاده‌سازی نشده',
      lastCheckedAt: new Date().toISOString(),
    };
  }
}
