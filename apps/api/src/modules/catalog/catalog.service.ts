import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { normalizeFa, searchTokens } from '@carpart/contract';
import { slugify } from '../../common/utils/text';
import { ConflictException, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { Part } from './entities/part.entity';
import { PartBrand } from './entities/part-brand.entity';
import { PartCategory } from './entities/part-category.entity';
import { PartCompatibility } from './entities/part-compatibility.entity';
import { VehicleMake, VehicleModel, VehicleVariant } from './entities/vehicle-catalog.entity';
import { SellerProduct } from '../sellers/entities/seller-product.entity';
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

/** مدیریت کاتالوگ عمومی قطعات و داده مرجع خودروها. */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(PartCategory) private readonly categories: Repository<PartCategory>,
    @InjectRepository(PartBrand) private readonly brands: Repository<PartBrand>,
    @InjectRepository(VehicleMake) private readonly makes: Repository<VehicleMake>,
    @InjectRepository(VehicleModel) private readonly models: Repository<VehicleModel>,
    @InjectRepository(VehicleVariant) private readonly variants: Repository<VehicleVariant>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(PartCompatibility) private readonly compatibilities: Repository<PartCompatibility>,
    @InjectRepository(SellerProduct) private readonly products: Repository<SellerProduct>,
  ) {}

  /* ------------------------------ دسته‌بندی ------------------------------ */

  async categoryTree(): Promise<Array<Record<string, unknown>>> {
    const rows = await this.categories.find({ where: { isActive: true }, order: { sortOrder: 'ASC', nameFa: 'ASC' } });
    const byParent = new Map<string | null, PartCategory[]>();
    for (const row of rows) {
      const key = row.parentId ?? null;
      const list = byParent.get(key) ?? [];
      list.push(row);
      byParent.set(key, list);
    }
    const build = (parentId: string | null): Array<Record<string, unknown>> =>
      (byParent.get(parentId) ?? []).map((row) => ({
        id: row.id,
        nameFa: row.nameFa,
        nameEn: row.nameEn,
        slug: row.slug,
        icon: row.icon,
        parentId: row.parentId,
        children: build(row.id),
      }));
    return build(null);
  }

  async createCategory(dto: CreateCategoryDto): Promise<PartCategory> {
    const slug = slugify(dto.nameEn ?? dto.nameFa) || `cat-${Date.now()}`;
    const exists = await this.categories.findOne({ where: { slug } });
    if (exists) throw new ConflictException('دسته‌بندی با این نام پیش‌تر ثبت شده است.');
    const entity = this.categories.create({
      nameFa: dto.nameFa,
      nameEn: dto.nameEn ?? null,
      slug,
      parentId: dto.parentId ?? null,
      icon: dto.icon ?? null,
      sortOrder: dto.sortOrder ?? 0,
      description: dto.description ?? null,
      searchKey: normalizeFa(dto.nameFa),
      isActive: true,
    });
    return this.categories.save(entity);
  }

  async updateCategory(id: string, dto: Partial<CreateCategoryDto> & { isActive?: boolean }): Promise<PartCategory> {
    const entity = await this.categories.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('دسته‌بندی');
    Object.assign(entity, {
      nameFa: dto.nameFa ?? entity.nameFa,
      nameEn: dto.nameEn ?? entity.nameEn,
      parentId: dto.parentId !== undefined ? dto.parentId : entity.parentId,
      icon: dto.icon ?? entity.icon,
      sortOrder: dto.sortOrder ?? entity.sortOrder,
      description: dto.description ?? entity.description,
      isActive: dto.isActive ?? entity.isActive,
    });
    entity.searchKey = normalizeFa(entity.nameFa);
    return this.categories.save(entity);
  }

  /* -------------------------------- برند -------------------------------- */

  async listBrands(activeOnly = true): Promise<PartBrand[]> {
    return this.brands.find({ where: activeOnly ? { isActive: true } : {}, order: { sortOrder: 'ASC', nameFa: 'ASC' } });
  }

  async createBrand(dto: CreateBrandDto): Promise<PartBrand> {
    const slug = slugify(dto.nameEn ?? dto.nameFa) || `brand-${Date.now()}`;
    const exists = await this.brands.findOne({ where: { slug } });
    if (exists) throw new ConflictException('برند با این نام پیش‌تر ثبت شده است.');
    return this.brands.save(
      this.brands.create({
        nameFa: dto.nameFa,
        nameEn: dto.nameEn ?? null,
        slug,
        country: dto.country ?? null,
        isOem: dto.isOem ?? false,
        searchKey: normalizeFa(`${dto.nameFa} ${dto.nameEn ?? ''}`),
        isActive: true,
      }),
    );
  }

  async updateBrand(id: string, dto: Partial<CreateBrandDto> & { isActive?: boolean }): Promise<PartBrand> {
    const entity = await this.brands.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('برند');
    Object.assign(entity, dto);
    entity.searchKey = normalizeFa(`${entity.nameFa} ${entity.nameEn ?? ''}`);
    return this.brands.save(entity);
  }

  /* --------------------------- داده مرجع خودرو --------------------------- */

  async listMakes(): Promise<VehicleMake[]> {
    return this.makes.find({ where: { isActive: true }, order: { sortOrder: 'ASC', nameFa: 'ASC' } });
  }

  async createMake(dto: CreateVehicleMakeDto): Promise<VehicleMake> {
    const slug = slugify(dto.nameEn ?? dto.nameFa) || `make-${Date.now()}`;
    return this.makes.save(
      this.makes.create({
        nameFa: dto.nameFa,
        nameEn: dto.nameEn ?? null,
        slug,
        country: dto.country ?? null,
        searchKey: normalizeFa(`${dto.nameFa} ${dto.nameEn ?? ''}`),
        isActive: true,
      }),
    );
  }

  async listModels(makeId?: string): Promise<VehicleModel[]> {
    const where = makeId ? { makeId, isActive: true } : { isActive: true };
    return this.models.find({ where, order: { nameFa: 'ASC' }, relations: { make: true } });
  }

  async createModel(dto: CreateVehicleModelDto): Promise<VehicleModel> {
    const make = await this.makes.findOne({ where: { id: dto.makeId } });
    if (!make) throw new NotFoundException('سازنده خودرو');
    const slug = `${make.slug}-${slugify(dto.nameEn ?? dto.nameFa) || Date.now()}`;
    return this.models.save(
      this.models.create({
        makeId: make.id,
        nameFa: dto.nameFa,
        nameEn: dto.nameEn ?? null,
        slug,
        bodyType: dto.bodyType ?? null,
        yearFrom: dto.yearFrom ?? null,
        yearTo: dto.yearTo ?? null,
        searchKey: normalizeFa(`${make.nameFa} ${dto.nameFa} ${dto.nameEn ?? ''}`),
        isActive: true,
      }),
    );
  }

  async listVariants(modelId?: string): Promise<VehicleVariant[]> {
    const where = modelId ? { modelId, isActive: true } : { isActive: true };
    return this.variants.find({ where, order: { nameFa: 'ASC' }, relations: { model: true } });
  }

  async createVariant(dto: CreateVehicleVariantDto): Promise<VehicleVariant> {
    const model = await this.models.findOne({ where: { id: dto.modelId } });
    if (!model) throw new NotFoundException('مدل خودرو');
    return this.variants.save(
      this.variants.create({
        modelId: model.id,
        nameFa: dto.nameFa,
        engine: dto.engine ?? null,
        gearbox: dto.gearbox ?? null,
        yearFrom: dto.yearFrom ?? null,
        yearTo: dto.yearTo ?? null,
        searchKey: normalizeFa(`${model.nameFa} ${dto.nameFa} ${dto.engine ?? ''}`),
        isActive: true,
      }),
    );
  }

  /* -------------------------------- قطعه -------------------------------- */

  /** ساخت کلید جست‌وجوی یکسان‌سازی‌شده برای قطعه. */
  buildPartSearchKey(part: Pick<Part, 'nameFa' | 'nameEn' | 'technicalCode' | 'oemCode'>, brandName?: string | null, categoryName?: string | null): string {
    return normalizeFa([part.nameFa, part.nameEn ?? '', part.technicalCode ?? '', part.oemCode ?? '', brandName ?? '', categoryName ?? ''].join(' '));
  }

  async listParts(query: { page?: number; pageSize?: number; search?: string; categoryId?: string; brandId?: string; isActive?: boolean } = {}): Promise<PageResult<Part>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const qb = this.parts.createQueryBuilder('part').leftJoinAndSelect('part.category', 'category').leftJoinAndSelect('part.brand', 'brand');
    if (query.search) {
      const normalized = normalizeFa(query.search);
      qb.where('(part.searchKey LIKE :nq OR part.nameFa LIKE :like)', { nq: `%${normalized}%`, like: `%${query.search}%` });
    }
    if (query.categoryId) qb.andWhere('part.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.brandId) qb.andWhere('part.brandId = :brandId', { brandId: query.brandId });
    if (query.isActive !== undefined) qb.andWhere('part.isActive = :isActive', { isActive: query.isActive });
    qb.orderBy('part.createdAt', 'DESC').skip(skip).take(take);
    const [items, total] = await qb.getManyAndCount();
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async getPart(id: string): Promise<Part> {
    const part = await this.parts.findOne({ where: { id }, relations: { category: true, brand: true } });
    if (!part) throw new NotFoundException('قطعه');
    return part;
  }

  async createPart(dto: CreatePartDto, actorId?: string | null): Promise<Part> {
    const category = await this.categories.findOne({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('دسته‌بندی');
    const brand = dto.brandId ? await this.brands.findOne({ where: { id: dto.brandId } }) : null;
    if (dto.brandId && !brand) throw new NotFoundException('برند');

    const entity = this.parts.create({
      nameFa: dto.nameFa.trim(),
      nameEn: dto.nameEn ?? null,
      categoryId: category.id,
      brandId: brand?.id ?? null,
      technicalCode: dto.technicalCode ?? null,
      oemCode: dto.oemCode ?? null,
      description: dto.description ?? null,
      specs: dto.specs ?? null,
      images: dto.images ?? null,
      defaultQuality: dto.defaultQuality ?? 'unknown',
      unit: dto.unit ?? 'عدد',
      minOrderQty: dto.minOrderQty ?? 1,
      isCompatibilityCritical: dto.isCompatibilityCritical ?? true,
      isActive: true,
      createdBy: actorId ?? null,
    });
    entity.searchKey = this.buildPartSearchKey(entity, brand?.nameFa, category.nameFa);
    entity.searchTokens = searchTokens(entity.searchKey);
    return this.parts.save(entity);
  }

  async updatePart(id: string, dto: UpdatePartDto): Promise<Part> {
    const part = await this.getPart(id);
    const category = dto.categoryId ? await this.categories.findOne({ where: { id: dto.categoryId } }) : part.category;
    if (dto.categoryId && !category) throw new NotFoundException('دسته‌بندی');
    const brand = dto.brandId ? await this.brands.findOne({ where: { id: dto.brandId } }) : part.brand;
    if (dto.brandId && !brand) throw new NotFoundException('برند');

    part.nameFa = dto.nameFa ?? part.nameFa;
    part.nameEn = dto.nameEn ?? part.nameEn;
    part.categoryId = category?.id ?? part.categoryId;
    part.brandId = dto.brandId !== undefined ? dto.brandId : part.brandId;
    part.technicalCode = dto.technicalCode ?? part.technicalCode;
    part.oemCode = dto.oemCode ?? part.oemCode;
    part.description = dto.description ?? part.description;
    part.specs = dto.specs ?? part.specs;
    part.images = dto.images ?? part.images;
    part.defaultQuality = dto.defaultQuality ?? part.defaultQuality;
    part.unit = dto.unit ?? part.unit;
    part.minOrderQty = dto.minOrderQty ?? part.minOrderQty;
    part.isCompatibilityCritical = dto.isCompatibilityCritical ?? part.isCompatibilityCritical;
    if (dto.isActive !== undefined) part.isActive = dto.isActive;
    part.searchKey = this.buildPartSearchKey(part, brand?.nameFa ?? null, category?.nameFa ?? null);
    part.searchTokens = searchTokens(part.searchKey);
    const saved = await this.parts.save(part);
    await this.refreshProductSearchKeys(part.id);
    return saved;
  }

  /** به‌روزرسانی کلید جست‌وجوی پیشنهادهای فروش پس از تغییر اطلاعات قطعه. */
  private async refreshProductSearchKeys(partId: string): Promise<void> {
    const part = await this.getPart(partId);
    const products = await this.products.find({ where: { partId } });
    if (!products.length) return;
    for (const product of products) {
      product.searchKey = normalizeFa(`${part.searchKey ?? part.nameFa} ${product.sku ?? ''}`);
    }
    await this.products.save(products);
  }

  /* ------------------------------ سازگاری ------------------------------ */

  async listCompatibilities(partId: string): Promise<PartCompatibility[]> {
    return this.compatibilities.find({
      where: { partId, isActive: true },
      take: 200,
      order: { level: 'ASC', createdAt: 'DESC' },
    });
  }

  async createCompatibility(dto: CreateCompatibilityDto, source: 'seller' | 'admin' | 'system' = 'admin'): Promise<PartCompatibility> {
    const part = await this.parts.findOne({ where: { id: dto.partId } });
    if (!part) throw new NotFoundException('قطعه');
    if (!dto.makeId && !dto.modelId && !dto.variantId) {
      throw new ConflictException('حداقل یکی از سازنده، مدل یا تیپ خودرو باید مشخص شود.');
    }
    const duplicate = await this.compatibilities.findOne({
      where: {
        partId: dto.partId,
        variantId: dto.variantId ?? null as unknown as string,
        modelId: dto.modelId ?? null as unknown as string,
        makeId: dto.makeId ?? null as unknown as string,
      },
    });
    if (duplicate) throw new ConflictException('این سازگاری پیش‌تر ثبت شده است.');
    return this.compatibilities.save(
      this.compatibilities.create({
        partId: part.id,
        makeId: dto.makeId ?? null,
        modelId: dto.modelId ?? null,
        variantId: dto.variantId ?? null,
        yearFrom: dto.yearFrom ?? null,
        yearTo: dto.yearTo ?? null,
        engine: dto.engine ?? null,
        level: dto.level ?? 'exact',
        note: dto.note ?? null,
        source,
        isActive: true,
      }),
    );
  }

  async removeCompatibility(id: string): Promise<{ ok: true }> {
    const entity = await this.compatibilities.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('رکورد سازگاری');
    entity.isActive = false;
    await this.compatibilities.save(entity);
    return { ok: true };
  }

  async compatibilityByParts(partIds: string[]): Promise<PartCompatibility[]> {
    if (!partIds.length) return [];
    return this.compatibilities.find({ where: { partId: In(partIds), isActive: true } });
  }
}
