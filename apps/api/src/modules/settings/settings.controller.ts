import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import type { RequestUser } from '../../common/types/auth';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto, UpdateSettingDto } from './dto/settings.dto';
import { SystemSettingsService } from './system-settings.service';

@ApiTags('تنظیمات سامانه')
@Controller()
export class SettingsController {
  constructor(
    private readonly settings: SystemSettingsService,
    private readonly announcements: AnnouncementService,
  ) {}

  @Public()
  @Get('public/settings')
  @ApiOperation({ summary: 'تنظیمات عمومی (بدون داده حساس) برای نمایش در رابط کاربری' })
  publicSettings() {
    return this.settings.listPublic();
  }

  @Public()
  @Get('public/announcements')
  @ApiOperation({ summary: 'اعلانات فعال' })
  activeAnnouncements(@CurrentUser() user?: RequestUser) {
    return this.announcements.findActiveForRoles(user?.roles ?? []);
  }

  @Get('admin/settings')
  @ApiBearerAuth()
  @RequirePermissions('setting:manage')
  @ApiOperation({ summary: 'فهرست همه تنظیمات (پارامترهای درآمدی قابل تغییرند)' })
  list(@Query('group') group?: string) {
    return this.settings.listAll(group);
  }

  @Patch('admin/settings/:key')
  @ApiBearerAuth()
  @RequirePermissions('setting:manage')
  @Audit({ action: 'setting.update', resource: 'setting', fa: 'تغییر تنظیم سامانه', recordBody: true })
  @ApiOperation({ summary: 'تغییر یک تنظیم (با اعتبارسنجی محدوده مجاز)' })
  update(@CurrentUser() user: RequestUser, @Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settings.set(key, dto.value, user.id);
  }

  @Get('admin/announcements')
  @ApiBearerAuth()
  @RequirePermissions('announcement:manage')
  listAnnouncements() {
    return this.announcements.list();
  }

  @Post('admin/announcements')
  @ApiBearerAuth()
  @RequirePermissions('announcement:manage')
  @Audit({ action: 'announcement.create', resource: 'announcement', fa: 'ایجاد اعلان سراسری', recordBody: true })
  createAnnouncement(@CurrentUser() user: RequestUser, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(
      {
        title: dto.title,
        body: dto.body,
        audienceRoles: (dto.audienceRoles as never) ?? null,
        tone: dto.tone ?? 'info',
        isActive: dto.isActive ?? true,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      user.id,
    );
  }

  @Patch('admin/announcements/:id')
  @ApiBearerAuth()
  @RequirePermissions('announcement:manage')
  @Audit({ action: 'announcement.update', resource: 'announcement', fa: 'ویرایش اعلان سراسری', recordBody: true })
  updateAnnouncement(@Param('id') id: string, @Body() dto: Partial<CreateAnnouncementDto>) {
    return this.announcements.update(id, {
      title: dto.title,
      body: dto.body,
      audienceRoles: (dto.audienceRoles as never) ?? undefined,
      tone: dto.tone ?? undefined,
      isActive: dto.isActive,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
  }

  @Delete('admin/announcements/:id')
  @ApiBearerAuth()
  @RequirePermissions('announcement:manage')
  @Audit({ action: 'announcement.deactivate', resource: 'announcement', fa: 'غیرفعال‌سازی اعلان سراسری' })
  deactivateAnnouncement(@Param('id') id: string) {
    return this.announcements.deactivate(id);
  }
}
