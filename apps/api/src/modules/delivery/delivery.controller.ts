import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DeliveryStatus } from '@carpart/contract';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { AccountStatusGuard } from '../../common/guards/account-status.guard';
import type { RequestUser } from '../../common/types/auth';
import { DeliveryService } from './delivery.service';
import { AcceptMissionDto, DeliverDto, FailAttemptDto, PickupDto, RejectMissionDto } from './dto/delivery.dto';

@ApiTags('ارسال (پیک)')
@ApiBearerAuth()
@Roles('courier')
@UseGuards(AccountStatusGuard)
@Controller('courier/deliveries')
export class CourierDeliveriesController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  @ApiOperation({ summary: 'مأموریت‌های من (پیشنهادها، فعال، تاریخچه)' })
  list(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: 'offers' | 'active' | 'history' | 'all',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.delivery.listForCourier(user, {
      status: status ?? 'all',
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات مأموریت (با محدودسازی حریم خصوصی پیش از پذیرش)' })
  detail(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.delivery.detailForCourier(user, id);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'رویدادهای مأموریت' })
  events(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.delivery.eventsFor(user, id);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'پذیرش مأموریت' })
  accept(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.delivery.accept(user, id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'رد مأموریت و بازگشت آن به صف تخصیص' })
  reject(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectMissionDto) {
    return this.delivery.reject(user, dto.deliveryId ?? id, dto.reason);
  }

  @Post(':id/pickup')
  @ApiOperation({ summary: 'ثبت دریافت مرسوله از فروشگاه با کد تحویل' })
  pickup(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PickupDto) {
    return this.delivery.pickup(user, id, dto.pickupCode, dto.note);
  }

  @Post(':id/transit')
  @ApiOperation({ summary: 'شروع ارسال به سمت مقصد' })
  transit(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.delivery.startTransit(user, id);
  }

  @Post(':id/deliver')
  @ApiOperation({ summary: 'ثبت تحویل با کد تأیید یکبارمصرف گیرنده' })
  deliver(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DeliverDto) {
    return this.delivery.deliver(user, id, dto.otp, { proofImageUrl: dto.proofImageUrl, note: dto.note });
  }

  @Post(':id/fail')
  @ApiOperation({ summary: 'ثبت تلاش ناموفق یا لغو تحویل' })
  fail(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FailAttemptDto) {
    return this.delivery.failAttempt(user, id, dto.reason, dto.nextAction ?? 'retry');
  }
}

@ApiTags('ردیابی ارسال')
@ApiBearerAuth()
@Controller()
export class DeliveryTrackingController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get('orders/:orderId/tracking')
  @ApiOperation({ summary: 'نمای ردیابی سفارش (داده محدود برای حریم خصوصی)' })
  tracking(@CurrentUser() user: RequestUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.delivery.tracking(orderId, user);
  }

  @Get('orders/:orderId/tracking/location')
  @ApiOperation({ summary: 'آخرین موقعیت مجاز پیک برای مالک سفارش، فروشنده همان سفارش یا مدیر' })
  async location(@CurrentUser() user: RequestUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    const tracking = await this.delivery.tracking(orderId, user);
    return { deliveryId: tracking.deliveryId || null, location: tracking.location };
  }

  @Get('seller/deliveries/:orderId')
  @Roles('seller')
  @ApiOperation({ summary: 'وضعیت مأموریت و کد تحویل از دید فروشنده' })
  async sellerView(@CurrentUser() user: RequestUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.delivery.tracking(orderId, user);
  }
}

@ApiTags('ارسال (مدیر)')
@ApiBearerAuth()
@Controller('admin/deliveries')
export class AdminDeliveriesController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  @RequirePermissions('delivery:read:all')
  @ApiOperation({ summary: 'فهرست مأموریت‌ها' })
  list(@Query('status') status?: DeliveryStatus, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.delivery.listAll({ status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Get('statistics')
  @RequirePermissions('report:read')
  @ApiOperation({ summary: 'آمار مأموریت‌های ارسال' })
  statistics(@Query('days') days?: string) {
    return this.delivery.statistics(days ? Number(days) : 30);
  }

  @Post(':id/assign')
  @RequirePermissions('delivery:assign')
  @Audit({ action: 'delivery.assign', resource: 'delivery', fa: 'تخصیص دستی مأموریت به پیک' })
  @ApiOperation({ summary: 'تخصیص/تلاش مجدد برای تخصیص پیک' })
  assign(@Param('id', ParseUUIDPipe) id: string) {
    return this.delivery.assign(id);
  }

  @Post(':id/cancel')
  @RequirePermissions('delivery:assign')
  @Audit({ action: 'delivery.cancel', resource: 'delivery', fa: 'لغو مأموریت ارسال', recordBody: true })
  @ApiOperation({ summary: 'لغو مأموریت ارسال' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body('reason') reason: string) {
    return this.delivery.cancel(id, reason ?? 'لغو توسط مدیر', 'admin');
  }
}
