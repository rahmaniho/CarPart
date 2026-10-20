import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RefundStatus } from '@carpart/contract';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdempotencyKey } from '../../common/decorators/idempotency.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import type { RequestUser } from '../../common/types/auth';
import {
  CreatePaymentDto,
  ExecuteRefundDto,
  RequestRefundDto,
  ResolveRefundDto,
  SandboxConfirmDto,
  VerifyPaymentDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';
import { RefundsService } from './refunds.service';

@ApiTags('پرداخت')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
  ) {}

  @Get('readiness')
  @ApiOperation({ summary: 'وضعیت فراهم‌کننده‌های پرداخت (آزمایشی/واقعی)' })
  readiness() {
    return this.payments.readiness();
  }

  @Post()
  @ApiOperation({ summary: 'ایجاد تراکنش پرداخت برای سفارش (با کلید یکتاسازی)' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePaymentDto, @IdempotencyKey() idempotencyKey?: string) {
    return this.payments.createForOrder(user.id, dto, idempotencyKey ?? null);
  }

  @Post('verify')
  @ApiOperation({ summary: 'تأیید سمت سرور تراکنش — تنها مسیر پذیرش موفقیت پرداخت' })
  async verify(@CurrentUser() user: RequestUser, @Body() dto: VerifyPaymentDto) {
    const result = await this.payments.verify(dto, user.id);
    return {
      status: result.payment.status,
      alreadyProcessed: result.alreadyProcessed,
      orderStatus: result.orderStatus,
      mode: result.payment.mode,
      referenceId: result.payment.referenceId || null,
      failureReason: result.payment.failureReason ?? null,
    };
  }

  @Post('sandbox/confirm')
  @ApiOperation({ summary: 'شبیه‌سازی تأیید کاربر در درگاه آزمایشی (فقط حالت sandbox)' })
  async sandboxConfirm(@CurrentUser() user: RequestUser, @Body() dto: SandboxConfirmDto) {
    const result = await this.payments.sandboxConfirm(user.id, dto.orderId, dto.decision ?? 'paid');
    return {
      simulated: true,
      status: result.payment.status,
      orderStatus: result.orderStatus,
      notice: 'درگاه آزمایشی است و هیچ تراکنش واقعی انجام نشده است.',
    };
  }

  @Get()
  @ApiOperation({ summary: 'تراکنش‌های پرداخت من' })
  list(@CurrentUser() user: RequestUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.payments.listMine(user.id, { page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات یک تراکنش' })
  detail(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.getMine(user.id, id);
  }

  @Post('refunds')
  @ApiOperation({ summary: 'ثبت درخواست بازپرداخت برای سفارش تحویل‌شده' })
  requestRefund(@CurrentUser() user: RequestUser, @Body() dto: RequestRefundDto) {
    return this.refunds.request(user, dto.orderId, dto.reason);
  }

  @Get('refunds/mine')
  @ApiOperation({ summary: 'درخواست‌های بازپرداخت من' })
  myRefunds(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: RefundStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.refunds.listMine(user.id, { status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }
}

@ApiTags('پرداخت (مدیر)')
@ApiBearerAuth()
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
  ) {}

  @Get()
  @RequirePermissions('payment:read:all')
  @ApiOperation({ summary: 'فهرست همه تراکنش‌ها' })
  list(@Query('status') status?: string, @Query('provider') provider?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.payments.listAll({
      status: status as never,
      provider,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('statistics')
  @RequirePermissions('finance:read')
  @ApiOperation({ summary: 'آمار تراکنش‌های پرداخت' })
  statistics(@Query('days') days?: string) {
    return this.payments.totals(days ? Number(days) : 30);
  }

  @Get('refunds')
  @RequirePermissions('refund:manage:all')
  @ApiOperation({ summary: 'فهرست درخواست‌های بازپرداخت' })
  listRefunds(@Query('status') status?: RefundStatus, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.refunds.listAll({ status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Post('refunds/:id/approve')
  @RequirePermissions('refund:manage:all')
  @Audit({ action: 'refund.approve', resource: 'refund', fa: 'تأیید بازپرداخت', recordBody: true })
  approve(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveRefundDto) {
    return this.refunds.approve(user, id, dto.note);
  }

  @Post('refunds/:id/reject')
  @RequirePermissions('refund:manage:all')
  @Audit({ action: 'refund.reject', resource: 'refund', fa: 'رد بازپرداخت', recordBody: true })
  reject(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveRefundDto) {
    return this.refunds.reject(user, id, dto.note);
  }

  @Post('refunds/:id/execute')
  @RequirePermissions('refund:manage:all')
  @Audit({ action: 'refund.execute', resource: 'refund', fa: 'اجرای بازپرداخت', recordBody: true })
  execute(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecuteRefundDto,
    @IdempotencyKey() idempotencyKey?: string,
  ) {
    return this.refunds.execute(user, id, dto.amount, idempotencyKey ?? null);
  }
}
