import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotFoundException } from '../../common/errors/app-error';
import type { RequestUser } from '../../common/types/auth';
import { CouriersService } from './couriers.service';
import { CourierPayoutInfoDto, UpdateAvailabilityDto, UpdateLocationDto, UpsertCourierDto } from './dto/courier.dto';

@ApiTags('پیک')
@ApiBearerAuth()
@Roles('courier')
@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriers: CouriersService) {}

  @Get('me')
  @ApiOperation({ summary: 'پروفایل پیک کاربر جاری' })
  async me(@CurrentUser() user: RequestUser) {
    const courier = await this.couriers.findByUserId(user.id);
    if (!courier) throw new NotFoundException('پروفایل پیک');
    return { ...courier, payoutInfoEncrypted: undefined, payoutInfo: this.couriers.payoutInfo(courier) };
  }

  @Put('me')
  @ApiOperation({ summary: 'ثبت یا ویرایش اطلاعات پیک و وسیله نقلیه' })
  async upsert(@CurrentUser() user: RequestUser, @Body() dto: UpsertCourierDto) {
    const courier = await this.couriers.upsert(user.id, dto);
    return { ...courier, payoutInfoEncrypted: undefined };
  }

  @Post('me/submit-review')
  @ApiOperation({ summary: 'ارسال مدارک برای تأیید مدیر' })
  async submit(@CurrentUser() user: RequestUser) {
    const courier = await this.couriers.submitForReview(user.id);
    return { ...courier, payoutInfoEncrypted: undefined };
  }

  @Get('me/dashboard')
  @ApiOperation({ summary: 'داشبورد پیک' })
  dashboard(@CurrentUser() user: RequestUser) {
    return this.couriers.dashboard(user.id);
  }

  @Post('me/availability')
  @ApiOperation({ summary: 'تغییر وضعیت فعالیت (آنلاین/آفلاین)' })
  async availability(@CurrentUser() user: RequestUser, @Body() dto: UpdateAvailabilityDto) {
    const courier = await this.couriers.setAvailability(user.id, dto.availability);
    return { availability: courier.availability };
  }

  @Post('me/location')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'به‌روزرسانی موقعیت (فقط در چارچوب مأموریت فعال ذخیره می‌شود)' })
  updateLocation(@CurrentUser() user: RequestUser, @Body() dto: UpdateLocationDto) {
    return this.couriers.updateLocation(user.id, dto);
  }

  @Put('me/payout-info')
  @ApiOperation({ summary: 'ثبت اطلاعات تسویه (رمزنگاری‌شده)' })
  updatePayoutInfo(@CurrentUser() user: RequestUser, @Body() dto: CourierPayoutInfoDto) {
    return this.couriers.updatePayoutInfo(user.id, dto);
  }
}
