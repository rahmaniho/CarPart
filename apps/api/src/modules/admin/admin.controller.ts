import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { can, type Permission } from '@carpart/contract';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import type { RequestUser } from '../../common/types/auth';
import { ListUsersQueryDto, AdminUpdateUserDto } from '../users/dto';
import { UsersService } from '../users/users.service';
import { AdminService } from './admin.service';
import { VerificationsService, type VerificationKind } from './verifications.service';

const VERIFICATION_PERMISSIONS: Record<VerificationKind, Permission> = {
  seller: 'seller:verify',
  courier: 'courier:verify',
  workshop: 'workshop:manage',
};

function assertCan(user: RequestUser, permission: Permission): void {
  if (!can(user.roles, permission)) {
    throw new AppException(
      'نقش شما اجازه این عملیات را ندارد (دسترسی‌های مدیریتی تفکیک‌شده است).',
      ErrorCodes.PERMISSION_DENIED,
      { statusCode: 403, details: { requiredPermission: permission } },
    );
  }
}

function parseKind(value: string): VerificationKind {
  if (value === 'seller' || value === 'courier' || value === 'workshop') return value;
  throw new NotFoundException('صف تأیید');
}

@ApiTags('پنل مدیریت')
@ApiBearerAuth()
@Roles('admin', 'operator')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly verifications: VerificationsService,
    private readonly users: UsersService,
  ) {}

  @Get('dashboard')
  @RequirePermissions('report:read')
  @ApiOperation({ summary: 'داشبورد مدیر — همه اعداد از داده واقعی پایگاه‌داده' })
  dashboard(@Query('days') days?: string) {
    return this.admin.dashboard(days ? Number(days) : 30);
  }

  @Get('reports/daily')
  @RequirePermissions('report:read')
  @ApiOperation({ summary: 'سری زمانی روزانه سفارش، GMV و درآمد پلتفرم' })
  daily(@Query('days') days?: string) {
    return this.admin.dailySeries(days ? Math.min(Number(days), 90) : 14);
  }

  @Get('reports/top-sellers')
  @RequirePermissions('report:read')
  @ApiOperation({ summary: 'فروشندگان برتر بر پایه درآمد واقعی' })
  async topSellers(@Query('days') days?: string) {
    const rangeDays = days ? Number(days) : 30;
    const since = new Date(Date.now() - rangeDays * 86_400_000);
    return this.admin.topSellers(since);
  }

  @Get('verifications/counts')
  @ApiOperation({ summary: 'شمار موارد در انتظار تأیید' })
  verificationCounts() {
    return this.verifications.counts();
  }

  @Get('verifications/:kind')
  @ApiOperation({ summary: 'صف تأیید هویت (فروشگاه، پیک یا تعمیرگاه)' })
  verificationQueue(@Param('kind') kind: string, @Query('status') status?: string) {
    return this.verifications.queue(parseKind(kind), (status as never) ?? 'PENDING_REVIEW');
  }

  @Post('verifications/:kind/:id/approve')
  @Audit({ action: 'verification.approve', resource: 'verification', fa: 'تأیید هویت', recordBody: true })
  @ApiOperation({ summary: 'تأیید هویت (نیازمند دسترسی seller:verify / courier:verify / workshop:manage)' })
  approve(@CurrentUser() user: RequestUser, @Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string, @Body('note') note?: string) {
    const verificationKind = parseKind(kind);
    assertCan(user, VERIFICATION_PERMISSIONS[verificationKind]);
    return this.verifications.approve(user, verificationKind, id, note);
  }

  @Post('verifications/:kind/:id/reject')
  @Audit({ action: 'verification.reject', resource: 'verification', fa: 'رد تأیید هویت', recordBody: true })
  @ApiOperation({ summary: 'رد تأیید هویت با ذکر دلیل' })
  reject(@CurrentUser() user: RequestUser, @Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string, @Body('reason') reason: string) {
    const verificationKind = parseKind(kind);
    assertCan(user, VERIFICATION_PERMISSIONS[verificationKind]);
    return this.verifications.reject(user, verificationKind, id, reason);
  }

  @Post('verifications/:kind/:id/suspend')
  @Audit({ action: 'verification.suspend', resource: 'verification', fa: 'تعلیق حساب', recordBody: true })
  @ApiOperation({ summary: 'تعلیق حساب تأییدشده' })
  suspend(@CurrentUser() user: RequestUser, @Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string, @Body('reason') reason: string) {
    const verificationKind = parseKind(kind);
    assertCan(user, VERIFICATION_PERMISSIONS[verificationKind]);
    return this.verifications.suspend(user, verificationKind, id, reason);
  }

  @Get('users')
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'فهرست کاربران با فیلتر نقش و وضعیت' })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get('users/:id')
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'جزئیات یک کاربر' })
  user(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getMe(id);
  }

  @Patch('users/:id')
  @RequirePermissions('user:manage')
  @Audit({ action: 'user.admin_update', resource: 'user', fa: 'تغییر وضعیت یا نقش کاربر', recordBody: true })
  @ApiOperation({ summary: 'تغییر نقش/وضعیت کاربر توسط مدیر (ثبت در ممیزی)' })
  updateUser(@CurrentUser() actor: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateUserDto) {
    if (id === actor.id && dto.isActive === false) {
      throw new AppException('نمی‌توانید حساب خود را غیرفعال کنید.', ErrorCodes.VALIDATION_FAILED, { statusCode: 409 });
    }
    return this.users.adminUpdate(id, dto, actor.id);
  }
}
