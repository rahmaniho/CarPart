import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditService } from './audit.service';

@ApiTags('گزارش ممیزی')
@ApiBearerAuth()
@RequirePermissions('audit:read')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'جست‌وجوی گزارش عملیات حساس (فقط مدیر)' })
  query(
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: 'success' | 'failure',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.audit.query({
      action,
      resource,
      actorId,
      from,
      to,
      status,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'خلاصه عملیات حساس در روزهای اخیر' })
  summary(@Query('days') days?: string) {
    return this.audit.summarize(days ? Number(days) : 7);
  }
}
