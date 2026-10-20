import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdempotencyKey } from '../../common/decorators/idempotency.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import type { RequestUser } from '../../common/types/auth';
import { CouriersService } from '../couriers/couriers.service';
import { SellersService } from '../sellers/sellers.service';
import { CommissionService } from './commission.service';
import { CreatePayoutDto, ProcessPayoutDto, SetCommissionRateDto } from './dto/finance.dto';
import { PayoutsService } from './payouts.service';
import { PricingService } from './pricing.service';

function range(from?: string, to?: string, defaultDays = 30): { from: Date; to: Date } {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - defaultDays * 86_400_000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppException('بازه زمانی معتبر نیست.', ErrorCodes.VALIDATION_FAILED);
  }
  return { from: start, to: end };
}

@ApiTags('مالی (فروشنده)')
@ApiBearerAuth()
@Roles('seller')
@Controller('seller/finance')
export class SellerFinanceController {
  constructor(
    private readonly commissions: CommissionService,
    private readonly payouts: PayoutsService,
    private readonly sellers: SellersService,
    private readonly pricing: PricingService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'خلاصه مالی فروشگاه (فروش، کارمزد کسرشده، سهم خالص)' })
  async summary(@CurrentUser() user: RequestUser, @Query('from') from?: string, @Query('to') to?: string) {
    const seller = await this.sellers.requireSeller(user.id);
    const period = range(from, to);
    return this.commissions.summarize(seller.id, period.from, period.to);
  }

  @Get('commission-rate')
  @ApiOperation({ summary: 'نرخ کارمزد اعمال‌شده بر فروشگاه من' })
  async rate(@CurrentUser() user: RequestUser) {
    const seller = await this.sellers.requireSeller(user.id);
    return {
      effectiveRatePercent: await this.pricing.commissionRatePercent(seller.commissionPercent),
      isCustomRate: seller.commissionPercent !== null,
      note: 'کارمزد پلتفرم از سهم فروشنده کسر می‌شود و به مبلغ پرداختی مشتری اضافه نمی‌گردد.',
    };
  }

  @Get('commissions')
  @ApiOperation({ summary: 'ریز کارمزدهای سفارش‌ها' })
  async list(@CurrentUser() user: RequestUser, @Query('from') from?: string, @Query('to') to?: string) {
    const seller = await this.sellers.requireSeller(user.id);
    const period = range(from, to);
    return this.commissions.listForSeller(seller.id, period.from, period.to);
  }

  @Get('payouts')
  @ApiOperation({ summary: 'تسویه‌های فروشگاه من' })
  async payoutsList(@CurrentUser() user: RequestUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const seller = await this.sellers.requireSeller(user.id);
    return this.payouts.listForSeller(seller.id, { page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }
}

@ApiTags('مالی (پیک)')
@ApiBearerAuth()
@Roles('courier')
@Controller('courier/finance')
export class CourierFinanceController {
  constructor(
    private readonly payouts: PayoutsService,
    private readonly couriers: CouriersService,
  ) {}

  @Get('payouts')
  @ApiOperation({ summary: 'تسویه‌های پیک' })
  async list(@CurrentUser() user: RequestUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const courier = await this.couriers.requireCourier(user.id);
    return this.payouts.listForCourier(courier.id, { page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }
}

@ApiTags('مالی (مدیر)')
@ApiBearerAuth()
@Controller('admin/finance')
export class AdminFinanceController {
  constructor(
    private readonly commissions: CommissionService,
    private readonly payouts: PayoutsService,
  ) {}

  @Get('summary')
  @RequirePermissions('finance:read')
  @ApiOperation({ summary: 'خلاصه مالی پلتفرم — GMV و درآمد پلتفرم جدا از هم' })
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    const period = range(from, to);
    return this.payouts.settlementSummary(period.from, period.to);
  }

  @Get('commissions')
  @RequirePermissions('finance:read')
  @ApiOperation({ summary: 'فهرست کارمزدها' })
  list(
    @Query('sellerId') sellerId?: string,
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.commissions.listAll({ sellerId, orderId, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Get('reports/sellers')
  @RequirePermissions('report:read')
  @ApiOperation({ summary: 'گزارش درآمد پلتفرم به تفکیک فروشنده' })
  report(@Query('from') from?: string, @Query('to') to?: string) {
    const period = range(from, to);
    return this.commissions.bySeller(period.from, period.to);
  }

  @Get('payouts')
  @RequirePermissions('payout:manage:all')
  @ApiOperation({ summary: 'فهرست تسویه‌ها' })
  payoutsList(
    @Query('status') status?: string,
    @Query('recipientType') recipientType?: 'seller' | 'courier',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.payouts.listAll({
      status: status as never,
      recipientType,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('payouts/preview')
  @RequirePermissions('payout:manage:all')
  @ApiOperation({ summary: 'پیش‌نمایش مبلغ قابل تسویه یک فروشنده یا پیک' })
  async preview(
    @Query('recipientType') recipientType: 'seller' | 'courier',
    @Query('recipientId') recipientId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const period = range(from, to);
    if (recipientType === 'courier') return this.payouts.previewCourier(recipientId, period.from, period.to);
    return this.payouts.previewSeller(recipientId, period.from, period.to);
  }

  @Get('payouts/:id')
  @RequirePermissions('payout:manage:all')
  @ApiOperation({ summary: 'جزئیات و ردیف‌های یک تسویه' })
  async payoutDetail(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.payouts.detail(id);
    if (!result) throw new NotFoundException('تسویه');
    return result;
  }

  @Post('payouts')
  @RequirePermissions('payout:manage:all')
  @Audit({ action: 'payout.create', resource: 'payout', fa: 'ایجاد تسویه', recordBody: true })
  @ApiOperation({ summary: 'ایجاد تسویه برای فروشنده یا پیک (با کلید یکتاسازی)' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePayoutDto, @IdempotencyKey() idempotencyKey?: string) {
    const period = range(dto.periodFrom, dto.periodTo);
    if (dto.recipientType === 'courier') {
      return this.payouts.createForCourier(user.id, dto.recipientId, period.from, period.to, idempotencyKey ?? null);
    }
    return this.payouts.createForSeller(user.id, dto.recipientId, period.from, period.to, idempotencyKey ?? null);
  }

  @Post('payouts/:id/ready')
  @RequirePermissions('payout:manage:all')
  @Audit({ action: 'payout.ready', resource: 'payout', fa: 'آماده‌سازی تسویه برای پرداخت' })
  markReady(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payouts.markReady(user.id, id);
  }

  @Post('payouts/:id/paid')
  @RequirePermissions('payout:manage:all')
  @Audit({ action: 'payout.paid', resource: 'payout', fa: 'ثبت پرداخت تسویه', recordBody: true })
  markPaid(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProcessPayoutDto) {
    if (!dto.reference) {
      throw new AppException('شماره پیگیری پرداخت تسویه الزامی است.', ErrorCodes.VALIDATION_FAILED);
    }
    return this.payouts.markPaid(user.id, id, dto.reference, dto.method ?? 'bank_transfer');
  }

  @Post('payouts/:id/failed')
  @RequirePermissions('payout:manage:all')
  @Audit({ action: 'payout.failed', resource: 'payout', fa: 'ثبت ناموفق‌بودن تسویه', recordBody: true })
  markFailed(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProcessPayoutDto) {
    return this.payouts.markFailed(user.id, id, dto.note ?? 'پرداخت تسویه ناموفق بود');
  }

  @Post('payouts/:id/cancel')
  @RequirePermissions('payout:manage:all')
  @Audit({ action: 'payout.cancel', resource: 'payout', fa: 'لغو تسویه', recordBody: true })
  cancel(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProcessPayoutDto) {
    return this.payouts.cancel(user.id, id, dto.note ?? 'لغو تسویه');
  }

  @Put('sellers/:id/commission-rate')
  @RequirePermissions('commission:manage')
  @Audit({ action: 'commission.rate_change', resource: 'seller', fa: 'تغییر نرخ کارمزد فروشنده', recordBody: true })
  @ApiOperation({ summary: 'تعیین نرخ کارمزد اختصاصی فروشنده (پیش‌فرض از تنظیمات سامانه)' })
  setRate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetCommissionRateDto) {
    return this.commissions.setSellerRate(id, dto.ratePercent ?? null);
  }

  @Get('commission-rate')
  @RequirePermissions('finance:read')
  @ApiOperation({ summary: 'نرخ کارمزد پیش‌فرض سامانه' })
  async defaultRate() {
    return { ratePercent: await this.commissions.defaultRatePercent() };
  }
}
