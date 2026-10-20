import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import type { RequestUser } from '../../common/types/auth';
import { CreateReviewDto, ModerateReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('بازخورد')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('reviews')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ثبت بازخورد برای فروشنده یا پیک یک سفارش تحویل‌شده' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user, dto);
  }

  @Get('reviews/mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'بازخوردهای من' })
  mine(@CurrentUser() user: RequestUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.reviews.listMine(user.id, { page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Public()
  @Get('public/reviews')
  @ApiOperation({ summary: 'بازخوردهای منتشرشده یک فروشنده یا پیک' })
  forTarget(
    @Query('targetType') targetType: 'seller' | 'courier',
    @Query('targetId') targetId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reviews.listForTarget(targetType === 'courier' ? 'courier' : 'seller', targetId, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Public()
  @Get('public/reviews/stats')
  @ApiOperation({ summary: 'خلاصه امتیازها و نرخ گزارش مشکل' })
  stats(@Query('targetType') targetType: 'seller' | 'courier', @Query('targetId') targetId: string) {
    return this.reviews.stats(targetType === 'courier' ? 'courier' : 'seller', targetId);
  }

  @Get('admin/reviews')
  @ApiBearerAuth()
  @RequirePermissions('review:manage:all')
  @ApiOperation({ summary: 'فهرست همه بازخوردها' })
  all(@Query('published') published?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.reviews.listAll({
      published: published === undefined ? undefined : published === 'true',
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Post('admin/reviews/:id/moderate')
  @ApiBearerAuth()
  @RequirePermissions('review:manage:all')
  @Audit({ action: 'review.moderate', resource: 'review', fa: 'بررسی و انتشار بازخورد', recordBody: true })
  @ApiOperation({ summary: 'انتشار یا عدم انتشار بازخورد' })
  moderate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.moderate(id, dto);
  }
}
