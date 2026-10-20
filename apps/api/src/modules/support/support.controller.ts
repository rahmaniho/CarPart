import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ReturnStatus, TicketStatus } from '@carpart/contract';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import type { RequestUser } from '../../common/types/auth';
import {
  AssignTicketDto,
  CreateReturnDto,
  CreateTicketDto,
  RateTicketDto,
  ReplyTicketDto,
  ResolveReturnDto,
  RespondReturnDto,
} from './dto/support.dto';
import { SupportService } from './support.service';

@ApiTags('پشتیبانی')
@ApiBearerAuth()
@Controller()
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'ثبت تیکت پشتیبانی' })
  createTicket(@CurrentUser() user: RequestUser, @Body() dto: CreateTicketDto) {
    return this.support.createTicket(user, dto);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'تیکت‌های من' })
  myTickets(@CurrentUser() user: RequestUser, @Query('status') status?: TicketStatus, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.support.listMyTickets(user.id, { status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'جزئیات تیکت و گفت‌وگوها (بدون یادداشت‌های داخلی)' })
  ticket(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.ticketDetail(id, user);
  }

  @Post('tickets/:id/replies')
  @ApiOperation({ summary: 'پاسخ به تیکت' })
  reply(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyTicketDto) {
    return this.support.replyTicket(id, user, dto);
  }

  @Post('tickets/:id/rate')
  @ApiOperation({ summary: 'ثبت امتیاز رضایت از پشتیبانی' })
  rate(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RateTicketDto) {
    return this.support.rateTicket(id, user, dto.satisfactionRating);
  }

  @Post('returns')
  @ApiOperation({ summary: 'ثبت درخواست مرجوعی یا مغایرت قطعه' })
  createReturn(@CurrentUser() user: RequestUser, @Body() dto: CreateReturnDto) {
    return this.support.createReturn(user, dto);
  }

  @Get('returns')
  @ApiOperation({ summary: 'درخواست‌های مرجوعی من' })
  myReturns(@CurrentUser() user: RequestUser, @Query('status') status?: ReturnStatus, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.support.listMyReturns(user.id, { status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Get('returns/:id')
  @ApiOperation({ summary: 'جزئیات درخواست مرجوعی' })
  returnDetail(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.returnDetail(id, user);
  }
}

@ApiTags('مرجوعی (فروشنده)')
@ApiBearerAuth()
@Roles('seller')
@Controller('seller/returns')
export class SellerReturnsController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'درخواست‌های مرجوعی مربوط به فروشگاه من' })
  list(@CurrentUser() user: RequestUser, @Query('status') status?: ReturnStatus, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.support.listSellerReturns(user.profileId as string, {
      status,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Post(':id/respond')
  @ApiOperation({ summary: 'تأیید یا رد درخواست مرجوعی توسط فروشنده' })
  respond(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondReturnDto) {
    return this.support.respondReturn(user, id, dto);
  }
}

@ApiTags('پشتیبانی (مدیر/اپراتور)')
@ApiBearerAuth()
@Controller('admin')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  @RequirePermissions('ticket:manage:all')
  @ApiOperation({ summary: 'فهرست همه تیکت‌ها' })
  tickets(@Query('status') status?: TicketStatus, @Query('category') category?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.support.listAllTickets({ status, category, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Get('tickets/:id')
  @RequirePermissions('ticket:manage:all')
  @ApiOperation({ summary: 'جزئیات تیکت با یادداشت‌های داخلی' })
  ticket(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.support.ticketDetail(id, user);
  }

  @Post('tickets/:id/replies')
  @RequirePermissions('ticket:manage:all')
  @ApiOperation({ summary: 'پاسخ کارشناس یا یادداشت داخلی' })
  reply(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyTicketDto) {
    return this.support.replyTicket(id, user, dto);
  }

  @Post('tickets/:id/assign')
  @RequirePermissions('ticket:manage:all')
  @Audit({ action: 'ticket.assign', resource: 'ticket', fa: 'تخصیص یا تغییر وضعیت تیکت', recordBody: true })
  @ApiOperation({ summary: 'تخصیص تیکت به کارشناس و تغییر وضعیت' })
  assign(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignTicketDto) {
    return this.support.assignTicket(id, dto, user.id);
  }

  @Get('returns')
  @RequirePermissions('return:manage:all')
  @ApiOperation({ summary: 'فهرست همه درخواست‌های مرجوعی' })
  returns(@Query('status') status?: ReturnStatus, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.support.listAllReturns({ status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Post('returns/:id/resolve')
  @RequirePermissions('return:manage:all')
  @Audit({ action: 'return.resolve', resource: 'return', fa: 'رسیدگی به درخواست مرجوعی', recordBody: true })
  @ApiOperation({ summary: 'ثبت دریافت کالا، بازپرداخت یا بستن پرونده' })
  resolve(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveReturnDto) {
    return this.support.resolveReturn(user, id, dto);
  }
}
