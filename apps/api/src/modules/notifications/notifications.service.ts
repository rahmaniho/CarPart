import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { NotificationChannel } from '@carpart/contract';
import { formatToman } from '@carpart/contract';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import { JobQueueService } from '../jobs/job-queue.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';
import { SmsGateway } from './sms.gateway';
import { getEvent, missingVarsOf, renderTemplate } from './notification-events';

export interface NotifyInput {
  userId: string;
  eventKey: string;
  /** متغیرهای الگو؛ مقادیر پولی به‌صورت عدد تومان داده شوند و اینجا قالب‌بندی می‌شوند */
  vars?: Record<string, unknown>;
  /** کلیدهایی در vars که مبلغ تومان هستند و باید قالب‌بندی شوند */
  moneyVars?: string[];
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  /** کلید یکتاسازی — اگر داده نشود از eventKey + subjectId ساخته می‌شود */
  dedupeKey?: string;
  subjectId?: string | number;
}

/** وصله مجاز برای به‌روزرسانی نتیجه ارسال یک اعلان برون‌سازمانی. */
export interface NotificationDeliveryPatch {
  status?: Notification['status'];
  sentAt?: Date | null;
  attempts?: number;
  isSimulated?: boolean;
  error?: string | null;
  data?: Record<string, unknown> | null;
}

export interface NotifyResult {
  created: number;
  duplicated: number;
  notifications: Notification[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    @InjectRepository(DeviceToken) private readonly deviceTokens: Repository<DeviceToken>,
    private readonly smsGateway: SmsGateway,
    @Inject(CONFIG_TOKEN) private readonly config: AppConfig,
    private readonly jobs: JobQueueService,
    private readonly settings: SystemSettingsService,
  ) {}

  /** ارسال اعلان برای یک کاربر روی کانال‌های مجاز (با جلوگیری از تکرار). */
  async notify(input: NotifyInput): Promise<NotifyResult> {
    const event = getEvent(input.eventKey);
    if (!event) {
      this.logger.warn(`رویداد اعلان ناشناخته: ${input.eventKey}`);
      return { created: 0, duplicated: 0, notifications: [] };
    }
    const enabledChannels = await this.settings.getJson<Record<string, boolean>>('notifications.channels', {
      inapp: true,
      sms: true,
      email: false,
      push: false,
    });
    const requested = input.channels ?? event.channels;
    const channels = requested.filter((channel) => enabledChannels[channel] !== false);

    const vars = this.prepareVars(input.vars ?? {}, input.moneyVars ?? []);
    const missing = missingVarsOf(event, vars);
    if (missing.length) {
      // هشدار توسعه‌دهنده: کاربر نباید متن/لینک با جای‌خالی «—» ببیند
      this.logger.warn(`رویداد اعلان ${event.key} با متغیرهای ناموجود فراخوانی شد: ${missing.join(', ')}`);
    }
    const title = renderTemplate(event.titleFa, vars);
    const body = renderTemplate(event.bodyFa, vars);
    const link = event.link ? renderTemplate(event.link, vars) : null;
    const subject = input.subjectId ?? '';

    const created: Notification[] = [];
    let duplicated = 0;

    // برای اعلان فشاری: فقط اگر کاربر دستگاه فعال (توکن FCM) داشته باشد رکورد ساخته می‌شود
    const activePushTokens = channels.includes('push') ? await this.deviceTokens.count({ where: { userId: input.userId, isActive: true } }) : 0;

    for (const channel of channels) {
      if (channel === 'push' && activePushTokens === 0) continue;
      const dedupeKey = input.dedupeKey
        ? `${input.dedupeKey}:${channel}`
        : `${input.userId}:${input.eventKey}:${subject}:${channel}`.slice(0, 190);

      if (channel === 'inapp') {
        const notification = await this.saveInApp({
          userId: input.userId,
          channel: 'inapp',
          eventKey: input.eventKey,
          titleFa: title,
          bodyFa: body,
          data: input.data ?? null,
          link,
          tone: event.tone,
          dedupeKey,
        });
        if (notification) created.push(notification);
        else duplicated += 1;
        continue;
      }

      // کانال‌های برون‌سازمانی: بررسی سریع از ثبت تکراری و نویز خطای Unique در
      // callbackهای idempotent جلوگیری می‌کند؛ قید Unique همچنان گارد نهایی Race است.
      if (await this.repo.exists({ where: { dedupeKey } })) {
        duplicated += 1;
        continue;
      }
      const pending = await this.repo.save(
        this.repo.create({
          userId: input.userId,
          channel,
          eventKey: input.eventKey,
          titleFa: title,
          bodyFa: body,
          data: input.data ?? null,
          link,
          tone: event.tone,
          dedupeKey,
          status: 'pending',
          isSimulated:
            channel === 'push'
              ? this.smsGateway.isPushSimulated
              : channel === 'sms'
                ? this.smsGateway.isSmsSimulated
                : this.config.messaging.emailProvider === 'mock',
        }),
      ).catch((error) => {
        if (String(error).includes('UNIQUE') || String(error).includes('duplicate')) return null;
        throw error;
      });
      if (!pending) {
        duplicated += 1;
        continue;
      }
      created.push(pending);
      const runAt = event.respectQuietHours === false ? null : await this.quietHoursDelay(channel);
      await this.jobs.enqueue(
        'notification.dispatch',
        { notificationId: pending.id },
        { dedupeKey: `dispatch:${pending.id}`, runAt, maxAttempts: Number(process.env.NOTIFICATION_MAX_RETRY ?? 3) },
      );
    }

    return { created: created.length, duplicated, notifications: created };
  }

  /* ------------------------- توکن دستگاه (اعلان فشاری) ------------------------- */

  async registerDeviceToken(
    userId: string,
    input: { token: string; platform: 'android' | 'ios' | 'web'; appFlavor?: 'mechanic' | 'courier' | 'seller' | 'admin' | 'web' | null },
  ): Promise<DeviceToken> {
    const existing = await this.deviceTokens.findOne({ where: { token: input.token } });
    const now = new Date();
    if (existing) {
      // توکن ممکن است به کاربر دیگری منتقل شده باشد (نصب جدید) — مالکیت به‌روز می‌شود
      existing.userId = userId;
      existing.platform = input.platform;
      existing.appFlavor = input.appFlavor ?? existing.appFlavor;
      existing.isActive = true;
      existing.lastSeenAt = now;
      return this.deviceTokens.save(existing);
    }
    return this.deviceTokens.save(
      this.deviceTokens.create({
        userId,
        token: input.token.slice(0, 512),
        platform: input.platform,
        appFlavor: input.appFlavor ?? null,
        isActive: true,
        lastSeenAt: now,
      }),
    );
  }

  async unregisterDeviceToken(userId: string, token: string): Promise<boolean> {
    const result = await this.deviceTokens.update({ userId, token }, { isActive: false });
    return (result.affected ?? 0) > 0;
  }

  async listDeviceTokens(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokens.find({ where: { userId, isActive: true }, order: { lastSeenAt: 'DESC' } });
  }

  async activeDeviceTokens(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokens.find({ where: { userId, isActive: true } });
  }

  private prepareVars(vars: Record<string, unknown>, moneyVars: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = { ...vars };
    for (const key of moneyVars) {
      if (out[key] !== undefined && out[key] !== null) out[key] = formatToman(Number(out[key]));
    }
    return out;
  }

  /** اگر در ساعات سکوت هستیم، ارسال پیامک/ایمیل تا پایان آن به تعویق می‌افتد. */
  private async quietHoursDelay(channel: NotificationChannel): Promise<Date | null> {
    if (channel !== 'sms' && channel !== 'email') return null;
    const start = await this.settings.getString('notifications.quiet_hours_start', '22:00');
    const end = await this.settings.getString('notifications.quiet_hours_end', '08:00');
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    if (!Number.isFinite(startH) || !Number.isFinite(endH)) return null;
    const now = new Date();
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 3 * 60 + 30; // Tehran = UTC+3:30
    const dayMinutes = minutes % 1440;
    const startMinutes = startH * 60 + (startM ?? 0);
    const endMinutes = endH * 60 + (endM ?? 0);
    const inQuiet = startMinutes <= endMinutes ? dayMinutes >= startMinutes && dayMinutes < endMinutes : dayMinutes >= startMinutes || dayMinutes < endMinutes;
    if (!inQuiet) return null;
    const deltaMinutes = (endMinutes - dayMinutes + 1440) % 1440 || 60;
    return new Date(Date.now() + deltaMinutes * 60_000);
  }

  private async saveInApp(input: Partial<Notification> & { dedupeKey: string }): Promise<Notification | null> {
    const existing = await this.repo.findOne({ where: { dedupeKey: input.dedupeKey } });
    if (existing) return null;
    try {
      return await this.repo.save(
        this.repo.create({
          ...input,
          channel: 'inapp',
          status: 'sent',
          sentAt: new Date(),
          isSimulated: false,
        }),
      );
    } catch (error) {
      if (String(error).includes('UNIQUE') || String(error).includes('duplicate')) return null;
      throw error;
    }
  }

  async listForUser(userId: string, options: { page?: number; pageSize?: number; unreadOnly?: boolean; channel?: NotificationChannel } = {}): Promise<PageResult<Notification>> {
    const { skip, take } = toSkipTake(options.page, options.pageSize);
    const qb = this.repo.createQueryBuilder('n').where('n.userId = :userId', { userId });
    if (options.unreadOnly) qb.andWhere('n.isRead = :false', { false: false });
    if (options.channel) qb.andWhere('n.channel = :channel', { channel: options.channel });
    else qb.andWhere('n.channel = :inapp', { inapp: 'inapp' });
    qb.orderBy('n.createdAt', 'DESC').skip(skip).take(take);
    const [items, total] = await qb.getManyAndCount();
    return buildPage(items, total, options.page ?? 1, options.pageSize ?? 20);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, isRead: false, channel: 'inapp' } });
  }

  async markRead(userId: string, notificationId: string): Promise<Notification | null> {
    const notification = await this.repo.findOne({ where: { id: notificationId, userId } });
    if (!notification) return null;
    notification.isRead = true;
    notification.readAt = new Date();
    return this.repo.save(notification);
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.repo.update({ userId, isRead: false, channel: 'inapp' }, { isRead: true, readAt: new Date() });
    return result.affected ?? 0;
  }

  /** صندوق خروجی اعلان‌های برون‌سازمانی — برای شفافیت درباره پیامک/ایمیل آزمایشی. */
  async listOutbox(options: { page?: number; pageSize?: number; channel?: NotificationChannel; status?: string } = {}): Promise<PageResult<Notification>> {
    const { skip, take } = toSkipTake(options.page, options.pageSize);
    const qb = this.repo.createQueryBuilder('n').where('n.channel != :inapp', { inapp: 'inapp' });
    if (options.channel) qb.andWhere('n.channel = :channel', { channel: options.channel });
    if (options.status) qb.andWhere('n.status = :status', { status: options.status });
    qb.orderBy('n.createdAt', 'DESC').skip(skip).take(take);
    const [items, total] = await qb.getManyAndCount();
    return buildPage(items, total, options.page ?? 1, options.pageSize ?? 20);
  }

  async findById(id: string): Promise<Notification | null> {
    return this.repo.findOne({ where: { id } });
  }

  async updateDeliveryResult(id: string, patch: NotificationDeliveryPatch): Promise<void> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) return;
    Object.assign(entity, patch);
    await this.repo.save(entity);
  }
}
