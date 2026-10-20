import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestStatus } from '@carpart/contract';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdempotencyKey } from '../../common/decorators/idempotency.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountStatusGuard } from '../../common/guards/account-status.guard';
import { NotFoundException } from '../../common/errors/app-error';
import type { RequestUser } from '../../common/types/auth';
import { OrdersService } from '../orders/orders.service';
import { SellersService } from '../sellers/sellers.service';
import { CreatePartRequestDto, CreateQuoteDto } from './dto/request.dto';
import { QuotesService } from './quotes.service';
import { RequestsService } from './requests.service';

@ApiTags('درخواست تأمین قطعه')
@ApiBearerAuth()
@Roles('mechanic')
@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly quotes: QuotesService,
    private readonly orders: OrdersService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'ثبت درخواست تأمین قطعه و ارسال به فروشندگان مرتبط' })
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreatePartRequestDto) {
    const { request, targets } = await this.requests.create(user.id, dto);
    return {
      ...request,
      targetedSellerCount: new Set(targets.map((target) => target.sellerId)).size,
      targets: targets.map((target) => ({ storeName: target.storeName, city: target.city, distanceKm: target.distanceKm, isOpenNow: target.isOpenNow })),
    };
  }

  @Get()
  @ApiOperation({ summary: 'فهرست درخواست‌های من' })
  list(@CurrentUser() user: RequestUser, @Query('status') status?: RequestStatus, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.requests.listMine(user.id, { status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات یک درخواست' })
  async detail(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    const request = await this.requests.getMine(user.id, id);
    const quotes = await this.requests.quotesOf(id);
    return {
      ...request,
      quotesSummary: quotes.map((quote) => ({ id: quote.id, status: quote.status, total: quote.total, submittedAt: quote.submittedAt })),
    };
  }

  @Get(':id/quotes')
  @ApiOperation({ summary: 'نمای مقایسه پیشنهادها با رتبه‌بندی شفاف' })
  compare(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.compareQuotes(user.id, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'لغو درخواست' })
  cancel(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body('reason') reason?: string) {
    return this.requests.cancel(user.id, id, reason);
  }

  @Post('quotes/:quoteId/accept')
  @ApiOperation({ summary: 'پذیرش پیشنهاد و ایجاد سفارش (با کلید یکتاسازی)' })
  async acceptQuote(
    @CurrentUser() user: RequestUser,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @IdempotencyKey() idempotencyKey?: string,
    @Body() body?: { deliveryAddressId?: string; couponCode?: string; notes?: string },
  ) {
    return this.orders.createFromQuote(user.id, quoteId, body ?? {}, idempotencyKey ?? null);
  }
}

@ApiTags('پیشنهاد قیمت (فروشنده)')
@ApiBearerAuth()
@Roles('seller')
@Controller('seller')
export class SellerRequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly quotes: QuotesService,
    private readonly sellers: SellersService,
  ) {}

  @Get('requests')
  @ApiOperation({ summary: 'درخواست‌های مرتبط با فروشگاه من' })
  async list(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: 'open' | 'closed' | 'all',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const seller = await this.sellers.requireSeller(user.id);
    return this.requests.listForSeller(seller.id, {
      status: status ?? 'open',
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'جزئیات یک درخواست برای فروشگاه' })
  async detail(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    const seller = await this.sellers.requireSeller(user.id);
    const request = await this.requests.findById(id);
    if (!request) throw new NotFoundException('درخواست تأمین');
    if (!(await this.requests.isTargeted(request, seller.id))) throw new NotFoundException('درخواست تأمین');
    const myQuote = (await this.requests.quotesOf(id)).find((quote) => quote.sellerId === seller.id) ?? null;
    return { ...request, myQuote };
  }

  @Post('requests/:id/quotes')
  @UseGuards(AccountStatusGuard)
  @ApiOperation({ summary: 'ثبت پیشنهاد قیمت برای یک درخواست' })
  async submitQuote(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateQuoteDto) {
    return this.quotes.submitQuote(user.id, id, dto);
  }

  @Get('quotes')
  @ApiOperation({ summary: 'پیشنهادهای ثبت‌شده فروشگاه من' })
  listQuotes(@CurrentUser() user: RequestUser, @Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.quotes.listForSeller(user.id, {
      status,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('quotes/stats')
  @ApiOperation({ summary: 'آمار پیشنهادها' })
  quoteStats(@CurrentUser() user: RequestUser) {
    return this.quotes.statsForSeller(user.id);
  }

  @Post('quotes/:id/withdraw')
  @ApiOperation({ summary: 'برداشتن پیشنهاد' })
  withdraw(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.withdrawQuote(user.id, id);
  }
}
