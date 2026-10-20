import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { JobContext, JobHandler } from '../jobs/job-registry';
import { JobRegistry } from '../jobs/job-registry';
import { UsersRepository } from '../users/users.repository';
import { SmsProviderNotConfiguredError } from './channels/sms-provider.interface';
import { NotificationsService } from './notifications.service';
import { SmsGateway } from './sms.gateway';

/** پردازش‌گر ارسال اعلان‌های برون‌سازمانی (پیامک/ایمیل) از صف کارها. */
@Injectable()
export class NotificationDispatchHandler implements JobHandler, OnModuleInit {
  readonly type = 'notification.dispatch';
  private readonly logger = new Logger(NotificationDispatchHandler.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly users: UsersRepository,
    private readonly registry: JobRegistry,
    private readonly gateway: SmsGateway,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(payload: Record<string, unknown>, _context: JobContext): Promise<void> {
    const notificationId = String(payload.notificationId ?? '');
    if (!notificationId) return;
    const notification = await this.notifications.findById(notificationId);
    if (!notification || notification.status === 'sent') return;

    const user = await this.users.findById(notification.userId);
    if (!user) {
      await this.notifications.updateDeliveryResult(notification.id, { status: 'failed', error: 'کاربر یافت نشد.' });
      return;
    }

    const attempts = (notification.attempts ?? 0) + 1;
    try {
      if (notification.channel === 'sms') {
        if (!user.mobile) throw new Error('شماره موبایل کاربر ثبت نشده است.');
        const result = await this.gateway.sendSms(user.mobile, `${notification.titleFa}\n${notification.bodyFa ?? ''}`.trim(), {
          eventKey: notification.eventKey,
          notificationId: notification.id,
        });
        if (result.status === 'failed') throw new Error(result.error ?? 'ارسال پیامک ناموفق بود.');
        await this.notifications.updateDeliveryResult(notification.id, {
          status: 'sent',
          sentAt: new Date(),
          attempts,
          isSimulated: result.simulated,
          error: null,
          data: { ...(notification.data ?? {}), provider: result.provider, messageId: result.messageId },
        });
        return;
      }

      if (notification.channel === 'email') {
        if (!user.email) {
          await this.notifications.updateDeliveryResult(notification.id, {
            status: 'failed',
            error: 'آدرس ایمیل کاربر ثبت نشده است.',
            attempts,
          });
          return;
        }
        const result = await this.gateway.sendEmail(user.email, notification.titleFa, notification.bodyFa ?? '');
        if (result.status === 'failed') throw new Error(result.error ?? 'ارسال ایمیل ناموفق بود.');
        await this.notifications.updateDeliveryResult(notification.id, {
          status: 'sent',
          sentAt: new Date(),
          attempts,
          isSimulated: result.simulated,
          error: null,
        });
        return;
      }

      if (notification.channel === 'push') {
        const tokens = await this.notifications.activeDeviceTokens(notification.userId);
        if (!tokens.length) {
          await this.notifications.updateDeliveryResult(notification.id, {
            status: 'failed',
            error: 'دستگاه فعالی برای دریافت اعلان فشاری ثبت نشده است.',
            attempts,
          });
          return;
        }
        const result = await this.gateway.sendPush({
          tokens: tokens.map((entry) => entry.token),
          title: notification.titleFa,
          body: notification.bodyFa ?? '',
          link: notification.link,
          data: notification.data,
        });
        if (result.status === 'failed') throw new Error(result.error ?? 'ارسال اعلان فشاری ناموفق بود.');
        await this.notifications.updateDeliveryResult(notification.id, {
          status: 'sent',
          sentAt: new Date(),
          attempts,
          isSimulated: result.simulated,
          error: null,
          data: { ...(notification.data ?? {}), provider: result.provider, deliveredTokens: result.deliveredTokens.length },
        });
        return;
      }

      await this.notifications.updateDeliveryResult(notification.id, { status: 'failed', error: `کانال پشتیبانی‌نشده: ${notification.channel}`, attempts });
    } catch (error) {
      const message = (error as Error).message;
      const nonRetryable = error instanceof SmsProviderNotConfiguredError;
      await this.notifications.updateDeliveryResult(notification.id, {
        status: 'failed',
        error: message.slice(0, 480),
        attempts,
      });
      this.logger.warn(`ارسال اعلان ${notification.channel} ناموفق بود: ${message}`);
      if (nonRetryable) return; // خطای پیکربندی با تلاش مجدد حل نمی‌شود
      throw error; // صف کارها تلاش مجدد با پس‌رفت نمایی انجام می‌دهد
    }
  }

  health() {
    return this.gateway.health();
  }
}
