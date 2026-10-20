import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import type { RequestUser } from '../../common/types/auth';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, ValidateCouponDto } from './dto/coupon.dto';

@ApiTags('کوپن تخفیف')
@ApiBearerAuth()
@Controller()
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post('coupons/validate')
  @ApiOperation({ summary: 'اعتبارسنجی کد تخفیف و محاسبه مبلغ تخفیف' })
  async validate(@CurrentUser() user: RequestUser, @Body() dto: ValidateCouponDto) {
    const result = await this.coupons.validate(dto.code, user.id, dto.itemsSubtotal, {
      roles: user.roles,
      city: dto.city ?? user.city,
    });
    return {
      valid: true,
      code: result.coupon.code,
      discount: result.discount,
      message: result.message,
      type: result.coupon.type,
    };
  }

  @Get('admin/coupons')
  @RequirePermissions('coupon:manage')
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('isActive') isActive?: string) {
    return this.coupons.list({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      isActive: isActive === undefined ? undefined : isActive === 'true' || isActive === '1',
    });
  }

  @Post('admin/coupons')
  @RequirePermissions('coupon:manage')
  @Audit({ action: 'coupon.create', resource: 'coupon', fa: 'ایجاد کوپن تخفیف', recordBody: true })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCouponDto) {
    return this.coupons.create(dto, user.id);
  }

  @Patch('admin/coupons/:id')
  @RequirePermissions('coupon:manage')
  @Audit({ action: 'coupon.update', resource: 'coupon', fa: 'ویرایش کوپن تخفیف', recordBody: true })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateCouponDto>) {
    return this.coupons.update(id, dto);
  }

  @Delete('admin/coupons/:id')
  @RequirePermissions('coupon:manage')
  @Audit({ action: 'coupon.deactivate', resource: 'coupon', fa: 'غیرفعال‌سازی کوپن تخفیف' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.deactivate(id);
  }
}
