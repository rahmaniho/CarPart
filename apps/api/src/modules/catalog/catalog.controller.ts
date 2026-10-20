import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import type { RequestUser } from '../../common/types/auth';
import { CatalogService } from './catalog.service';
import { SearchService } from './search.service';
import {
  CreateBrandDto,
  CreateCategoryDto,
  CreateCompatibilityDto,
  CreatePartDto,
  CreateVehicleMakeDto,
  CreateVehicleModelDto,
  CreateVehicleVariantDto,
  UpdatePartDto,
} from './dto/catalog.dto';
import { SearchQueryDto } from './dto/search.dto';

/** بخش عمومی کاتالوگ — بدون نیاز به ورود قابل استفاده است. */
@ApiTags('کاتالوگ')
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly searchService: SearchService,
  ) {}

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'درخت دسته‌بندی قطعات' })
  categories() {
    return this.catalog.categoryTree();
  }

  @Public()
  @Get('brands')
  @ApiOperation({ summary: 'فهرست برندهای قطعه' })
  brands() {
    return this.catalog.listBrands();
  }

  @Public()
  @Get('vehicle-makes')
  @ApiOperation({ summary: 'فهرست سازندگان خودرو' })
  makes() {
    return this.catalog.listMakes();
  }

  @Public()
  @Get('vehicle-models')
  @ApiOperation({ summary: 'فهرست مدل‌های یک سازنده' })
  models(@Query('makeId') makeId?: string) {
    return this.catalog.listModels(makeId);
  }

  @Public()
  @Get('vehicle-variants')
  @ApiOperation({ summary: 'فهرست تیپ‌های یک مدل' })
  variants(@Query('modelId') modelId?: string) {
    return this.catalog.listVariants(modelId);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('search')
  @ApiOperation({ summary: 'جست‌وجوی پیشنهادهای فروش با رتبه‌بندی شفاف' })
  async search(@Query() query: SearchQueryDto, @CurrentUser() user?: RequestUser) {
    return this.searchService.searchOffers(query, {
      userId: user?.id ?? null,
      workshopId: user?.profileKind === 'workshop' ? user.profileId : null,
    });
  }

  @Public()
  @Get('parts')
  @ApiOperation({ summary: 'جست‌وجو در کاتالوگ عمومی قطعات' })
  parts(@Query() query: SearchQueryDto) {
    return this.searchService.searchParts(query);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('parts/:id')
  @ApiOperation({ summary: 'جزئیات قطعه همراه با پیشنهادهای فعال' })
  partDetail(@Param('id', ParseUUIDPipe) id: string, @Query() query: SearchQueryDto, @CurrentUser() user?: RequestUser) {
    return this.searchService.partDetail(id, query, { userId: user?.id ?? null });
  }
}

/** بخش مدیریت کاتالوگ — فقط با مجوزهای مدیریتی. */
@ApiTags('مدیریت کاتالوگ')
@Controller('admin/catalog')
export class CatalogAdminController {
  constructor(private readonly catalog: CatalogService) {}

  @Post('categories')
  @RequirePermissions('category:manage')
  @Audit({ action: 'category.create', resource: 'category', fa: 'ایجاد دسته‌بندی قطعه' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Patch('categories/:id')
  @RequirePermissions('category:manage')
  @Audit({ action: 'category.update', resource: 'category', fa: 'ویرایش دسته‌بندی قطعه' })
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateCategoryDto> & { isActive?: boolean }) {
    return this.catalog.updateCategory(id, dto);
  }

  @Post('brands')
  @RequirePermissions('brand:manage')
  @Audit({ action: 'brand.create', resource: 'brand', fa: 'ایجاد برند قطعه' })
  createBrand(@Body() dto: CreateBrandDto) {
    return this.catalog.createBrand(dto);
  }

  @Patch('brands/:id')
  @RequirePermissions('brand:manage')
  @Audit({ action: 'brand.update', resource: 'brand', fa: 'ویرایش برند قطعه' })
  updateBrand(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateBrandDto> & { isActive?: boolean }) {
    return this.catalog.updateBrand(id, dto);
  }

  @Post('vehicle-makes')
  @RequirePermissions('vehicle:manage')
  @Audit({ action: 'vehicle_make.create', resource: 'vehicle_make', fa: 'ایجاد سازنده خودرو' })
  createMake(@Body() dto: CreateVehicleMakeDto) {
    return this.catalog.createMake(dto);
  }

  @Post('vehicle-models')
  @RequirePermissions('vehicle:manage')
  @Audit({ action: 'vehicle_model.create', resource: 'vehicle_model', fa: 'ایجاد مدل خودرو' })
  createModel(@Body() dto: CreateVehicleModelDto) {
    return this.catalog.createModel(dto);
  }

  @Post('vehicle-variants')
  @RequirePermissions('vehicle:manage')
  @Audit({ action: 'vehicle_variant.create', resource: 'vehicle_variant', fa: 'ایجاد تیپ خودرو' })
  createVariant(@Body() dto: CreateVehicleVariantDto) {
    return this.catalog.createVariant(dto);
  }

  @Get('parts')
  @RequirePermissions('catalog:read')
  listParts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.catalog.listParts({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      search,
      categoryId,
      brandId,
      isActive: isActive === undefined ? undefined : isActive === 'true' || isActive === '1',
    });
  }

  @Post('parts')
  @RequirePermissions('catalog:manage')
  @Audit({ action: 'part.create', resource: 'part', fa: 'ایجاد قطعه در کاتالوگ' })
  createPart(@Body() dto: CreatePartDto, @CurrentUser() user: RequestUser) {
    return this.catalog.createPart(dto, user.id);
  }

  @Patch('parts/:id')
  @RequirePermissions('catalog:manage')
  @Audit({ action: 'part.update', resource: 'part', fa: 'ویرایش قطعه در کاتالوگ' })
  updatePart(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartDto) {
    return this.catalog.updatePart(id, dto);
  }

  @Get('parts/:id/compatibilities')
  @RequirePermissions('catalog:read')
  compatibilities(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.listCompatibilities(id);
  }

  @Post('parts/:id/compatibilities')
  @RequirePermissions('compatibility:manage')
  @Audit({ action: 'compatibility.create', resource: 'part', fa: 'ثبت سازگاری قطعه با خودرو' })
  createCompatibility(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCompatibilityDto) {
    return this.catalog.createCompatibility({ ...dto, partId: id }, 'admin');
  }

  @Patch('compatibilities/:id')
  @RequirePermissions('compatibility:manage')
  @Audit({ action: 'compatibility.remove', resource: 'part', fa: 'غیرفعال‌سازی رکورد سازگاری' })
  removeCompatibility(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.removeCompatibility(id);
  }
}
