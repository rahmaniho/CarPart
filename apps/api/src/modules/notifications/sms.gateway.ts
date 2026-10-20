import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import { KavenegarSmsProvider } from './channels/kavenegar-sms.provider';
import { MockSmsProvider } from './channels/mock-sms.provider';
import type { SmsProvider } from './channels/sms-provider.interface';
import type { ProviderHealth } from './channels/sms-provider.interface';
import { MockEmailProvider } from './channels/mock-email.provider';
import { SmtpEmailProvider } from './channels/smtp-email.provider';
import type { EmailProvider } from './channels/email-provider.interface';

/**
 * دروازه ارسال پیام کوتاه و ایمیل.
 * انتخاب فراهم‌کننده از تنظیمات انجام می‌شود و نتیجه همیشه مشخص می‌کند آیا ارسال
 * واقعی بوده یا آزمایشی (simulated) — تا حالت آزمایشی با واقعی اشتباه نشود.
 */
@Injectable()
export class SmsGateway {
  private readonly logger = new Logger(SmsGateway.name);
  private readonly smsProviders: Map<string, SmsProvider>;
  private readonly emailProviders: Map<string, EmailProvider>;

  constructor(@Inject(CONFIG_TOKEN) private readonly config: AppConfig) {
    this.smsProviders = new Map<string, SmsProvider>([
      ['mock', new MockSmsProvider()],
      ['kavenegar', new KavenegarSmsProvider(() => config.messaging.smsApiKey, () => config.messaging.smsSender)],
      ['smsir', new KavenegarSmsProvider(() => config.messaging.smsApiKey, () => config.messaging.smsSender)],
    ]);
    this.emailProviders = new Map<string, EmailProvider>([
      ['mock', new MockEmailProvider()],
      ['smtp', new SmtpEmailProvider(() => config.messaging.smtpUrl)],
    ]);
  }

  get smsProvider(): SmsProvider {
    return this.smsProviders.get(this.config.messaging.smsProvider) ?? this.smsProviders.get('mock')!;
  }

  get emailProvider(): EmailProvider {
    return this.emailProviders.get(this.config.messaging.emailProvider) ?? this.emailProviders.get('mock')!;
  }

  get isSmsSimulated(): boolean {
    return !this.smsProvider.isLive;
  }

  sendSms(mobile: string, message: string, meta?: Record<string, unknown>) {
    return this.smsProvider.send({ mobile, message, meta });
  }

  sendEmail(to: string, subject: string, text: string, html?: string) {
    return this.emailProvider.send({ to, subject, text, html });
  }

  health(): { sms: ProviderHealth; email: ProviderHealth } {
    return { sms: this.smsProvider.health(), email: this.emailProvider.health() };
  }
}
