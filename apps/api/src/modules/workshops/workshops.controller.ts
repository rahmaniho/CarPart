import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { RequestUser } from '../../common/types/auth';
import { ToggleFavoriteDto, UpsertAddressDto, UpsertVehicleDto, UpsertWorkshopDto } from './dto/workshop.dto';
import type { FavoriteKind } from './entities/favorite.entity';
import { WorkshopsService } from './workshops.service';

@ApiTags('تعمیرگاه (مکانیک)')
@ApiBearerAuth()
@Roles('mechanic')
@Controller('workshops')
export class WorkshopsController {
  constructor(private readonly workshops: WorkshopsService) {}

  @Get('me')
  @ApiOperation({ summary: 'پروفایل تعمیرگاه کاربر جاری' })
  async me(@CurrentUser() user: RequestUser) {
    return this.workshops.findByUserId(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'ثبت یا به‌روزرسانی پروفایل تعمیرگاه' })
  async upsert(@CurrentUser() user: RequestUser, @Body() dto: UpsertWorkshopDto) {
    return this.workshops.upsert(user.id, dto);
  }

  @Post('me/submit-review')
  @ApiOperation({ summary: 'ارسال پروفایل تعمیرگاه برای تأیید' })
  async submit(@CurrentUser() user: RequestUser) {
    return this.workshops.submitForReview(user.id);
  }

  @Get('me/addresses')
  @ApiOperation({ summary: 'آدرس‌های تحویل' })
  addresses(@CurrentUser() user: RequestUser) {
    return this.workshops.listAddresses(user.id);
  }

  @Post('me/addresses')
  @ApiOperation({ summary: 'افزودن آدرس تحویل' })
  createAddress(@CurrentUser() user: RequestUser, @Body() dto: UpsertAddressDto) {
    return this.workshops.createAddress(user.id, dto);
  }

  @Patch('me/addresses/:id')
  @ApiOperation({ summary: 'ویرایش آدرس تحویل' })
  updateAddress(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<UpsertAddressDto>) {
    return this.workshops.updateAddress(user.id, id, dto);
  }

  @Delete('me/addresses/:id')
  @ApiOperation({ summary: 'حذف آدرس تحویل (غیرفعال‌سازی)' })
  deleteAddress(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workshops.deleteAddress(user.id, id);
  }

  @Get('me/vehicles')
  @ApiOperation({ summary: 'خودروهای ذخیره‌شده' })
  vehicles(@CurrentUser() user: RequestUser) {
    return this.workshops.listVehicles(user.id);
  }

  @Post('me/vehicles')
  @ApiOperation({ summary: 'افزودن خودرو' })
  createVehicle(@CurrentUser() user: RequestUser, @Body() dto: UpsertVehicleDto) {
    return this.workshops.createVehicle(user.id, dto);
  }

  @Patch('me/vehicles/:id')
  @ApiOperation({ summary: 'ویرایش خودرو' })
  updateVehicle(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<UpsertVehicleDto>) {
    return this.workshops.updateVehicle(user.id, id, dto);
  }

  @Delete('me/vehicles/:id')
  @ApiOperation({ summary: 'حذف خودرو' })
  deleteVehicle(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workshops.deleteVehicle(user.id, id);
  }

  @Get('me/favorites')
  @ApiOperation({ summary: 'علاقه‌مندی‌ها' })
  favorites(@CurrentUser() user: RequestUser, @Query('kind') kind?: FavoriteKind) {
    return this.workshops.listFavorites(user.id, kind);
  }

  @Post('me/favorites')
  @ApiOperation({ summary: 'افزودن به علاقه‌مندی‌ها' })
  addFavorite(@CurrentUser() user: RequestUser, @Body() dto: ToggleFavoriteDto) {
    return this.workshops.addFavorite(user.id, dto);
  }

  @Delete('me/favorites/:kind/:refId')
  @ApiOperation({ summary: 'حذف از علاقه‌مندی‌ها' })
  removeFavorite(@CurrentUser() user: RequestUser, @Param('kind') kind: FavoriteKind, @Param('refId') refId: string) {
    return this.workshops.removeFavorite(user.id, kind, refId);
  }
}
