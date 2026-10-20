import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountStatusGuard } from '../../common/guards/account-status.guard';
import { NotFoundException } from '../../common/errors/app-error';
import type { RequestUser } from '../../common/types/auth';
import { PayoutInfoDto, CreateProductDto, UpdatePriceDto, UpdateStockDto, UpsertBranchDto, UpsertSellerDto } from './dto/seller.dto';
import { SellerProductsService } from './seller-products.service';
import { SellersService } from './sellers.service';

@ApiTags('فروشنده')
@ApiBearerAuth()
@Roles('seller')
@Controller('sellers')
export class SellersController {
  constructor(
    private readonly sellers: SellersService,
    private readonly products: SellerProductsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'پروفایل فروشگاه کاربر جاری' })
  async me(@CurrentUser() user: RequestUser) {
    const seller = await this.sellers.findByUserId(user.id);
    if (!seller) throw new NotFoundException('فروشگاه');
    return { ...seller, payoutInfo: this.sellers.payoutInfo(seller), payoutInfoEncrypted: undefined };
  }

  @Put('me')
  @ApiOperation({ summary: 'ثبت یا به‌روزرسانی اطلاعات فروشگاه' })
  async upsert(@CurrentUser() user: RequestUser, @Body() dto: UpsertSellerDto) {
    const seller = await this.sellers.upsert(user.id, dto);
    return { ...seller, payoutInfoEncrypted: undefined };
  }

  @Post('me/submit-review')
  @ApiOperation({ summary: 'ارسال حساب فروشگاه برای تأیید مدیر' })
  async submit(@CurrentUser() user: RequestUser) {
    const seller = await this.sellers.submitForReview(user.id);
    return { ...seller, payoutInfoEncrypted: undefined };
  }

  @Put('me/payout-info')
  @ApiOperation({ summary: 'ثبت اطلاعات دریافت تسویه (رمزنگاری‌شده نگهداری می‌شود)' })
  async updatePayoutInfo(@CurrentUser() user: RequestUser, @Body() dto: PayoutInfoDto) {
    const seller = await this.sellers.upsert(user.id, {
      storeName: (await this.sellers.requireSeller(user.id)).storeName,
      payoutInfo: dto,
    });
    return { payoutInfo: this.sellers.payoutInfo(seller) };
  }

  @Get('me/dashboard')
  @ApiOperation({ summary: 'داشبورد فروش (داده واقعی از پایگاه‌داده)' })
  dashboard(@CurrentUser() user: RequestUser) {
    return this.sellers.dashboard(user.id);
  }

  @Get('me/branches')
  @ApiOperation({ summary: 'شعبه‌ها و ساعات فعالیت' })
  async branches(@CurrentUser() user: RequestUser) {
    const seller = await this.sellers.requireSeller(user.id);
    const branches = await this.sellers.listBranches(seller.id, true);
    return branches.map((branch) => ({ ...branch, isOpenNow: this.sellers.isOpenNow(branch) }));
  }

  @Post('me/branches')
  @ApiOperation({ summary: 'افزودن شعبه' })
  async createBranch(@CurrentUser() user: RequestUser, @Body() dto: UpsertBranchDto) {
    const seller = await this.sellers.requireSeller(user.id);
    return this.sellers.createBranch(seller.id, dto);
  }

  @Patch('me/branches/:id')
  @ApiOperation({ summary: 'ویرایش شعبه، ساعات فعالیت یا محدوده خدمات' })
  async updateBranch(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<UpsertBranchDto>) {
    const seller = await this.sellers.requireSeller(user.id);
    return this.sellers.updateBranch(seller.id, id, dto);
  }

  @Get('me/products')
  @ApiOperation({ summary: 'فهرست محصولات فروشگاه' })
  async productsList(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('isActive') isActive?: string,
    @Query('lowStock') lowStock?: string,
    @Query('outOfStock') outOfStock?: string,
  ) {
    const seller = await this.sellers.requireSeller(user.id);
    return this.products.list(seller.id, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      search,
      categoryId,
      isActive: isActive === undefined ? undefined : isActive === 'true' || isActive === '1',
      lowStock: lowStock === 'true' || lowStock === '1',
      outOfStock: outOfStock === 'true' || outOfStock === '1',
    });
  }

  @Post('me/products')
  @ApiOperation({ summary: 'افزودن محصول (قطعه کاتالوگ یا قطعه جدید) با قیمت و موجودی' })
  async createProduct(@CurrentUser() user: RequestUser, @Body() dto: CreateProductDto) {
    const seller = await this.sellers.requireVerifiedSeller(user.id);
    return this.products.create(seller, dto, user.id);
  }

  @Get('me/products/:id')
  @ApiOperation({ summary: 'جزئیات یک محصول' })
  async product(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    const seller = await this.sellers.requireSeller(user.id);
    return this.products.get(seller.id, id);
  }

  @Patch('me/products/:id')
  @ApiOperation({ summary: 'ویرایش محصول' })
  async updateProduct(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateProductDto) {
    const seller = await this.sellers.requireVerifiedSeller(user.id);
    return this.products.update(seller, id, dto, user.id);
  }

  @Post('me/products/:id/price')
  @ApiOperation({ summary: 'به‌روزرسانی سریع قیمت' })
  async updatePrice(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePriceDto) {
    const seller = await this.sellers.requireVerifiedSeller(user.id);
    return this.products.updatePrice(seller, id, dto);
  }

  @Post('me/products/:id/stock')
  @ApiOperation({ summary: 'اصلاح سریع موجودی (اتمیکی و با ثبت در دفتر موجودی)' })
  async updateStock(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStockDto) {
    const seller = await this.sellers.requireVerifiedSeller(user.id);
    return this.products.updateStock(seller, id, dto, user.id);
  }

  @Post('me/products/:id/active')
  @ApiOperation({ summary: 'فعال یا غیرفعال‌کردن محصول' })
  async setActive(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body('isActive') isActive: boolean) {
    const seller = await this.sellers.requireSeller(user.id);
    return this.products.setActive(seller, id, Boolean(isActive));
  }

  @Delete('me/products/:id')
  @ApiOperation({ summary: 'غیرفعال‌سازی محصول (حذف مخرب انجام نمی‌شود)' })
  async removeProduct(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    const seller = await this.sellers.requireSeller(user.id);
    return this.products.deactivate(seller, id);
  }

  @Get('me/products/:id/movements')
  @ApiOperation({ summary: 'دفتر حرکت موجودی یک محصول' })
  async movements(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    const seller = await this.sellers.requireSeller(user.id);
    return this.products.movementsFor(seller.id, id);
  }
}

/** اطلاعات عمومی فروشگاه برای خریداران (بدون داده‌های حساس). */
@ApiTags('فروشنده')
@Controller('public/sellers')
export class PublicSellersController {
  constructor(private readonly sellers: SellersService) {}

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'پروفایل عمومی فروشگاه' })
  async publicProfile(@Param('id', ParseUUIDPipe) id: string) {
    const seller = await this.sellers.findById(id);
    if (!seller || seller.verificationStatus !== 'APPROVED' || !seller.isActive) throw new NotFoundException('فروشگاه');
    const branches = await this.sellers.listBranches(seller.id);
    return {
      id: seller.id,
      storeName: seller.storeName,
      city: seller.city,
      description: seller.description,
      logoUrl: seller.logoUrl,
      ratingAvg: seller.ratingAvg,
      ratingCount: seller.ratingCount,
      completedOrders: seller.completedOrders,
      avgResponseMinutes: seller.avgResponseMinutes,
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        city: branch.city,
        lat: branch.lat,
        lng: branch.lng,
        serviceRadiusKm: branch.serviceRadiusKm,
        prepTimeMinutes: branch.prepTimeMinutes,
        isOpenNow: this.sellers.isOpenNow(branch),
        businessHours: branch.businessHours,
      })),
    };
  }
}
