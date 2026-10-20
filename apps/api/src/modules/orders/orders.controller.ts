import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdempotencyKey } from '../../common/decorators/idempotency.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { AccountStatusGuard } from '../../common/guards/account-status.guard';
import type { RequestUser } from '../../common/types/auth';
import { CancelOrderDto, CreateOrderDto, TransitionOrderDto } from './dto/order.dto';
import { OrdersService, type ListOrderFilter } from './orders.service';

function parseFilter(query: { page?: string; pageSize?: string; status?: string; search?: string; from?: string; to?: string }): ListOrderFilter {
  return {
    page: query.page ? Number(query.page) : 1,
    pageSize: query.pageSize ? Number(query.pageSize) : 20,
    status: (query.status as ListOrderFilter['status']) ?? 'all',
    search: query.search,
    from: query.from,
    to: query.to,
  };
}

@ApiTags('سفارش (مکانیک)')
@ApiBearerAuth()
@Roles('mechanic')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @UseGuards(AccountStatusGuard)
  @ApiOperation({ summary: 'ثبت سفارش خرید مستقیم از کاتالوگ' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateOrderDto, @IdempotencyKey() idempotencyKey?: string) {
    return this.orders.createDirect(user.id, dto, idempotencyKey ?? null);
  }

  @Post(':id/checkout')
  @UseGuards(AccountStatusGuard)
  @ApiOperation({ summary: 'ثبت نهایی پیش‌نویس سفارش' })
  checkout(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @IdempotencyKey() idempotencyKey?: string) {
    return this.orders.checkout(user.id, id, idempotencyKey ?? null);
  }

  @Get()
  @ApiOperation({ summary: 'فهرست سفارش‌های من' })
  list(@CurrentUser() user: RequestUser, @Query() query: Record<string, string | undefined>) {
    return this.orders.listMine(user.id, parseFilter(query));
  }

  @Get('statuses')
  @ApiOperation({ summary: 'فهرست وضعیت‌های مجاز سفارش' })
  statuses() {
    return this.orders.statuses();
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات سفارش همراه با اقلام، تجزیه مبلغ و عملیات مجاز' })
  detail(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id, user);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'تاریخچه رویدادهای سفارش' })
  events(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.orderEvents(id, user);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'تغییر وضعیت سفارش (با بررسی ماشین وضعیت سمت سرور)' })
  transition(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionOrderDto) {
    return this.orders.transition(id, dto.to, user, dto.reason);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'لغو سفارش با ذکر دلیل' })
  cancel(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelOrderDto) {
    return this.orders.transition(id, 'CANCELLED', user, dto.reason);
  }
}

@ApiTags('سفارش (فروشنده)')
@ApiBearerAuth()
@Roles('seller')
@Controller('seller/orders')
export class SellerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'سفارش‌های فروشگاه من' })
  list(@CurrentUser() user: RequestUser, @Query() query: Record<string, string | undefined>) {
    return this.orders.listForSeller(user.profileId as string, parseFilter(query));
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات سفارش از دید فروشنده' })
  detail(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id, user);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'تاریخچه سفارش' })
  events(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.orderEvents(id, user);
  }

  @Post(':id/transition')
  @UseGuards(AccountStatusGuard)
  @ApiOperation({ summary: 'تأیید، شروع آماده‌سازی یا اعلام آمادگی تحویل' })
  transition(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionOrderDto) {
    return this.orders.transition(id, dto.to, user, dto.reason);
  }
}

@ApiTags('سفارش (مدیر)')
@ApiBearerAuth()
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermissions('order:read:all')
  @ApiOperation({ summary: 'فهرست همه سفارش‌ها با فیلتر' })
  list(@Query() query: Record<string, string | undefined>) {
    return this.orders.listAll({ ...parseFilter(query), sellerId: query.sellerId });
  }

  @Get('statistics')
  @RequirePermissions('order:read:all')
  @ApiOperation({ summary: 'آمار سفارش‌ها (GMV و درآمد پلتفرم جدا از هم)' })
  statistics(@Query('days') days?: string) {
    return this.orders.statistics(days ? Number(days) : 30);
  }

  @Get(':id')
  @RequirePermissions('order:read:all')
  @ApiOperation({ summary: 'جزئیات سفارش از دید مدیر' })
  detail(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id, user);
  }

  @Get(':id/events')
  @RequirePermissions('order:read:all')
  @ApiOperation({ summary: 'تاریخچه کامل سفارش' })
  events(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.orderEvents(id, user);
  }

  @Post(':id/transition')
  @RequirePermissions('order:manage:all')
  @Audit({ action: 'order.transition', resource: 'order', fa: 'تغییر وضعیت سفارش توسط مدیر', recordBody: true })
  @ApiOperation({ summary: 'تغییر وضعیت سفارش توسط مدیر (ثبت در گزارش ممیزی)' })
  transition(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionOrderDto) {
    return this.orders.transition(id, dto.to, user, dto.reason);
  }
}
