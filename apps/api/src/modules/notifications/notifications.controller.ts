import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { NotificationChannel } from '@carpart/contract';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import type { RequestUser } from '../../common/types/auth';
import { NotFoundException } from '../../common/errors/app-error';
import { NotificationsService } from './notifications.service';

@ApiTags('اعلان‌ها')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست اعلان‌های کاربر جاری' })
  async list(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notifications.listForUser(user.id, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'تعداد اعلان‌های خوانده‌نشده' })
  async unreadCount(@CurrentUser() user: RequestUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Get('device-tokens')
  @ApiOperation({ summary: 'فهرست توکن‌های دستگاه فعال برای اعلان فشاری' })
  async deviceTokens(@CurrentUser() user: RequestUser) {
    const tokens = await this.notifications.listDeviceTokens(user.id);
    return tokens.map((entry) => ({ id: entry.id, platform: entry.platform, appFlavor: entry.appFlavor, lastSeenAt: entry.lastSeenAt }));
  }

  @Post('device-tokens')
  @ApiOperation({ summary: 'ثبت/به‌روزرسانی توکن دستگاه برای اعلان فشاری (FCM)' })
  async registerDevice(
    @CurrentUser() user: RequestUser,
    @Body() dto: { token: string; platform: 'android' | 'ios' | 'web'; appFlavor?: 'mechanic' | 'courier' | 'seller' | 'admin' | 'web' },
  ) {
    const entry = await this.notifications.registerDeviceToken(user.id, {
      token: String(dto.token ?? ''),
      platform: dto.platform,
      appFlavor: dto.appFlavor ?? null,
    });
    return { id: entry.id, platform: entry.platform, appFlavor: entry.appFlavor };
  }

  @Delete('device-tokens/:token')
  @ApiOperation({ summary: 'حذف توکن دستگاه (مثلاً هنگام خروج از حساب)' })
  async unregisterDevice(@CurrentUser() user: RequestUser, @Param('token') token: string) {
    const removed = await this.notifications.unregisterDeviceToken(user.id, decodeURIComponent(token));
    return { removed };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'خوانده‌شده علامت‌زدن یک اعلان' })
  async markRead(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.notifications.markRead(user.id, id);
    if (!result) throw new NotFoundException('اعلان');
    return { ok: true };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'خوانده‌شده علامت‌زدن همه اعلان‌ها' })
  async markAllRead(@CurrentUser() user: RequestUser) {
    return { updated: await this.notifications.markAllRead(user.id) };
  }

  @Get('outbox/list')
  @RequirePermissions('report:read')
  @Audit({ action: 'notification.outbox_viewed', resource: 'notification', fa: 'مشاهده صندوق خروجی اعلان‌ها' })
  @ApiOperation({ summary: 'صندوق خروجی پیامک/ایمیل (مدیریت) — شامل مشخص‌سازی حالت آزمایشی' })
  async outbox(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('channel') channel?: NotificationChannel,
    @Query('status') status?: string,
  ) {
    return this.notifications.listOutbox({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 25,
      channel,
      status,
    });
  }
}
