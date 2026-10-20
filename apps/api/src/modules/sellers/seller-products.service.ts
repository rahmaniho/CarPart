import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeFa } from '@carpart/contract';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { CatalogService } from '../catalog/catalog.service';
import { Part } from '../catalog/entities/part.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { InventoryMovement, type InventoryReason } from './entities/inventory-movement.entity';
import { SellerBranch } from './entities/seller-branch.entity';
import { SellerProduct } from './entities/seller-product.entity';
import { Seller } from './entities/seller.entity';
import { CreateProductDto, UpdateProductDto, UpdatePriceDto, UpdateStockDto } from './dto/seller.dto';

export interface StockReservationItem {
  sellerProductId: string;
  quantity: number;
}

export interface StockOperationResult {
  sellerProductId: string;
  stock: number;
  reservedStock: number;
  available: number;
}

const LOW_STOCK_THRESHOLD = 3;

/**
 * مدیریت محصولات، قیمت و موجودی فروشنده.
 *
 * اصول پیاده‌سازی:
 * - تغییر موجودی به‌صورت اتمیک در پایگاه‌داده انجام می‌شود (UPDATE ... WHERE stock - reserved >= qty)
 *   تا فروش هم‌زمان آخرین موجودی توسط دو مکانیک ممکن نباشد.
 * - هر تغییر موجودی در دفتر حرکت موجودی با دلیل و موجودی پس از تغییر ثبت می‌شود.
 * - قیمت و موجودی همیشه زمان آخرین به‌روزرسانی دارند.
 */
@Injectable()
export class SellerProductsService {
  private readonly logger = new Logger(SellerProductsService.name);

  constructor(
    @InjectRepository(SellerProduct) private readonly products: Repository<SellerProduct>,
    @InjectRepository(InventoryMovement) private readonly movements: Repository<InventoryMovement>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    sellerId: string,
    query: { page?: number; pageSize?: number; search?: string; categoryId?: string; isActive?: boolean; lowStock?: boolean; outOfStock?: boolean } = {},
  ): Promise<PageResult<SellerProduct>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const qb = this.products
      .createQueryBuilder('sp')
      .leftJoinAndSelect('sp.part', 'part')
      .leftJoinAndSelect('part.category', 'category')
      .leftJoinAndSelect('part.brand', 'brand')
      .leftJoinAndSelect('sp.branch', 'branch')
      .where('sp.sellerId = :sellerId', { sellerId });
    if (query.search) {
      qb.andWhere('(sp.searchKey LIKE :nq OR part.nameFa LIKE :like OR LOWER(sp.sku) LIKE :likeLower)', {
        nq: `%${normalizeFa(query.search)}%`,
        like: `%${query.search}%`,
        likeLower: `%${query.search.toLowerCase()}%`,
      });
    }
    if (query.categoryId) qb.andWhere('part.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.isActive !== undefined) qb.andWhere('sp.isActive = :isActive', { isActive: query.isActive });
    if (query.lowStock) qb.andWhere('sp.stock - sp.reservedStock <= :threshold', { threshold: LOW_STOCK_THRESHOLD });
    if (query.outOfStock) qb.andWhere('sp.stock - sp.reservedStock <= 0');
    qb.orderBy('sp.updatedAt', 'DESC').skip(skip).take(take);
    const [items, total] = await qb.getManyAndCount();
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async get(sellerId: string, productId: string): Promise<SellerProduct> {
    const product = await this.products.findOne({
      where: { id: productId, sellerId },
      relations: { part: { category: true, brand: true }, branch: true },
    });
    if (!product) throw new NotFoundException('محصول');
    return product;
  }

  async findById(productId: string): Promise<SellerProduct | null> {
    return this.products.findOne({ where: { id: productId }, relations: { part: true, branch: true, seller: true } });
  }

  async create(seller: Seller, dto: CreateProductDto, actorId: string): Promise<SellerProduct> {
    let part: Part;
    if (dto.partId) {
      const found = await this.parts.findOne({ where: { id: dto.partId } });
      if (!found) throw new NotFoundException('قطعه');
      part = found;
    } else if (dto.newPart) {
      part = await this.catalog.createPart(
        {
          nameFa: dto.newPart.nameFa,
          categoryId: dto.newPart.categoryId,
          brandId: dto.newPart.brandId ?? null,
          technicalCode: dto.newPart.technicalCode,
          oemCode: dto.newPart.oemCode,
          description: dto.newPart.description,
        },
        actorId,
      );
    } else {
      throw new AppException('قطعه را از کاتالوگ انتخاب کنید یا مشخصات قطعه جدید را وارد کنید.', ErrorCodes.VALIDATION_FAILED);
    }

    const branch = await this.resolveBranch(seller.id, dto.branchId);

    const duplicate = await this.products.findOne({ where: { sellerId: seller.id, partId: part.id, branchId: branch.id } });
    if (duplicate) {
      throw new AppException('این قطعه پیش‌تر در همین شعبه ثبت شده است. همان رکورد را ویرایش کنید.', ErrorCodes.CONFLICT, {
        statusCode: 409,
      });
    }

    const entity = this.products.create({
      sellerId: seller.id,
      branchId: branch.id,
      partId: part.id,
      sku: dto.sku ?? null,
      price: dto.price,
      listPrice: dto.listPrice ?? null,
      stock: dto.stock,
      reservedStock: 0,
      priceUpdatedAt: new Date(),
      stockUpdatedAt: new Date(),
      quality: dto.quality ?? part.defaultQuality,
      isGenuineClaimed: dto.isGenuineClaimed ?? false,
      preparationMinutes: dto.preparationMinutes ?? branch.prepTimeMinutes,
      warrantyNote: dto.warrantyNote ?? null,
      returnPolicy: dto.returnPolicy ?? null,
      returnWindowDays: dto.returnWindowDays ?? 7,
      images: dto.images ?? part.images ?? null,
      conditionNote: dto.conditionNote ?? null,
      isActive: dto.isActive ?? true,
      searchKey: normalizeFa(`${part.searchKey ?? part.nameFa} ${dto.sku ?? ''}`),
    });
    const saved = await this.products.save(entity);
    await this.recordMovement(saved, dto.stock, 'initial', actorId, 'ثبت اولیه موجودی', saved.stock);
    return saved;
  }

  private async resolveBranch(sellerId: string, branchId?: string | null): Promise<SellerBranch> {
    const qb = this.products.manager.getRepository(SellerBranch).createQueryBuilder('branch').where('branch.sellerId = :sellerId', { sellerId });
    if (branchId) qb.andWhere('branch.id = :branchId', { branchId });
    else qb.andWhere('branch.isPrimary = :primary', { primary: true });
    qb.andWhere('branch.isActive = :active', { active: true });
    const branch = await qb.getOne();
    if (!branch) {
      throw new AppException('شعبه‌ای برای ثبت محصول یافت نشد. ابتدا شعبه را با موقعیت ثبت کنید.', ErrorCodes.PROFILE_INCOMPLETE, {
        statusCode: 409,
      });
    }
    return branch;
  }

  async update(seller: Seller, productId: string, dto: UpdateProductDto, actorId: string): Promise<SellerProduct> {
    const product = await this.get(seller.id, productId);
    const previousStock = product.stock;
    const previousPrice = product.price;

    if (dto.branchId && dto.branchId !== product.branchId) {
      const branch = await this.resolveBranch(seller.id, dto.branchId);
      product.branchId = branch.id;
      product.branch = branch;
    }
    if (dto.sku !== undefined) product.sku = dto.sku;
    if (dto.quality !== undefined) product.quality = dto.quality;
    if (dto.isGenuineClaimed !== undefined) product.isGenuineClaimed = dto.isGenuineClaimed;
    if (dto.preparationMinutes !== undefined) product.preparationMinutes = dto.preparationMinutes;
    if (dto.warrantyNote !== undefined) product.warrantyNote = dto.warrantyNote;
    if (dto.returnPolicy !== undefined) product.returnPolicy = dto.returnPolicy;
    if (dto.returnWindowDays !== undefined) product.returnWindowDays = dto.returnWindowDays;
    if (dto.images !== undefined) product.images = dto.images;
    if (dto.conditionNote !== undefined) product.conditionNote = dto.conditionNote;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;

    if (dto.price !== undefined && dto.price !== previousPrice) {
      product.price = dto.price;
      product.priceUpdatedAt = new Date();
    }
    if (dto.listPrice !== undefined) product.listPrice = dto.listPrice;
    if (dto.stock !== undefined && dto.stock !== previousStock) {
      if (dto.stock < product.reservedStock) {
        throw new AppException(
          `موجودی نمی‌تواند کمتر از مقدار رزروشده (${product.reservedStock}) باشد.`,
          ErrorCodes.INSUFFICIENT_STOCK,
          { statusCode: 409 },
        );
      }
      product.stock = dto.stock;
      product.stockUpdatedAt = new Date();
      await this.recordMovement(product, dto.stock - previousStock, 'adjustment', actorId, 'ویرایش محصول', dto.stock);
    }

    product.searchKey = normalizeFa(`${product.part.searchKey ?? product.part.nameFa} ${product.sku ?? ''}`);
    const saved = await this.products.save(product);
    await this.maybeAlertLowStock(saved);
    return saved;
  }

  async updatePrice(seller: Seller, productId: string, dto: UpdatePriceDto): Promise<SellerProduct> {
    const product = await this.get(seller.id, productId);
    product.price = dto.price;
    if (dto.listPrice !== undefined) product.listPrice = dto.listPrice;
    product.priceUpdatedAt = new Date();
    return this.products.save(product);
  }

  /** تغییر موجودی به‌صورت اتمیک + ثبت در دفتر حرکت موجودی. */
  async updateStock(seller: Seller, productId: string, dto: UpdateStockDto, actorId: string): Promise<StockOperationResult> {
    const product = await this.get(seller.id, productId);
    if (dto.delta !== undefined && dto.absoluteStock !== undefined) {
      throw new AppException('فقط یکی از دو مقدار delta یا absoluteStock را ارسال کنید.', ErrorCodes.VALIDATION_FAILED);
    }
    if (dto.delta !== undefined) {
      const result = await this.products
        .createQueryBuilder()
        .update(SellerProduct)
        .set({
          stock: () => 'stock + :delta',
          stockUpdatedAt: new Date(),
          version: () => 'version + 1',
        })
        .where('id = :id AND sellerId = :sellerId AND stock + :delta >= reservedStock', {
          id: product.id,
          sellerId: seller.id,
          delta: dto.delta,
        })
        .execute();
      if (!result.affected) {
        throw new AppException(
          'موجودی پس از این تغییر کمتر از مقدار رزروشده در سفارش‌های جاری می‌شود.',
          ErrorCodes.INSUFFICIENT_STOCK,
          { statusCode: 409 },
        );
      }
      const updated = await this.get(seller.id, productId);
      await this.recordMovement(updated, dto.delta, dto.reason, actorId, dto.note ?? null, updated.stock);
      await this.maybeAlertLowStock(updated);
      return { sellerProductId: updated.id, stock: updated.stock, reservedStock: updated.reservedStock, available: updated.availableStock };
    }

    const target = dto.absoluteStock ?? 0;
    if (target < product.reservedStock) {
      throw new AppException(
        `موجودی نمی‌تواند کمتر از مقدار رزروشده (${product.reservedStock}) باشد.`,
        ErrorCodes.INSUFFICIENT_STOCK,
        { statusCode: 409 },
      );
    }
    const delta = target - product.stock;
    const result = await this.products
      .createQueryBuilder()
      .update(SellerProduct)
      .set({ stock: target, stockUpdatedAt: new Date(), version: () => 'version + 1' })
      .where('id = :id AND sellerId = :sellerId', { id: product.id, sellerId: seller.id })
      .execute();
    if (!result.affected) throw new NotFoundException('محصول');
    const updated = await this.get(seller.id, productId);
    await this.recordMovement(updated, delta, dto.reason, actorId, dto.note ?? null, updated.stock);
    await this.maybeAlertLowStock(updated);
    return { sellerProductId: updated.id, stock: updated.stock, reservedStock: updated.reservedStock, available: updated.availableStock };
  }

  async setActive(seller: Seller, productId: string, isActive: boolean): Promise<SellerProduct> {
    const product = await this.get(seller.id, productId);
    product.isActive = isActive;
    return this.products.save(product);
  }

  /** حذف مخرب انجام نمی‌شود؛ محصول غیرفعال می‌گردد تا سوابق سفارش‌ها سالم بماند. */
  async deactivate(seller: Seller, productId: string): Promise<{ ok: true }> {
    await this.setActive(seller, productId, false);
    return { ok: true };
  }

  /* --------------------- عملیات اتمیک موجودی برای سفارش --------------------- */

  /** رزرو موجودی هنگام ثبت سفارش — اگر موجودی کافی نباشد هیچ تغییری اعمال نمی‌شود. */
  async reserve(items: StockReservationItem[], orderId: string, actorId: string | null): Promise<StockOperationResult[]> {
    const results: StockOperationResult[] = [];
    const reserved: StockReservationItem[] = [];

    for (const item of items) {
      const result = await this.products
        .createQueryBuilder()
        .update(SellerProduct)
        .set({ reservedStock: () => 'reservedStock + :qty', version: () => 'version + 1' })
        .where('id = :id AND stock - reservedStock >= :qty', { id: item.sellerProductId, qty: item.quantity })
        .execute();

      if (!result.affected) {
        // بازگرداندن رزروهای موفقِ پیشین تا وضعیت موجودی ناسازگار نماند
        if (reserved.length) await this.release(reserved, orderId);
        const product = await this.products.findOne({ where: { id: item.sellerProductId }, relations: { part: true } });
        throw new AppException(
          product
            ? `موجودی «${product.part?.nameFa ?? 'قطعه'}» کافی نیست (موجودی قابل فروش: ${product.availableStock}).`
            : 'محصول یافت نشد.',
          ErrorCodes.STOCK_CONFLICT,
          { statusCode: 409, details: { sellerProductId: item.sellerProductId, requested: item.quantity } },
        );
      }

      reserved.push({ sellerProductId: item.sellerProductId, quantity: item.quantity });
      const updated = await this.products.findOne({ where: { id: item.sellerProductId } });
      if (updated) {
        await this.recordMovement(updated, 0, 'reservation', actorId, `رزرو برای سفارش ${orderId}`, updated.stock);
        results.push({
          sellerProductId: updated.id,
          stock: updated.stock,
          reservedStock: updated.reservedStock,
          available: updated.availableStock,
        });
      }
    }
    return results;
  }

  /** آزادسازی رزرو (لغو سفارش یا ناموفق‌بودن پرداخت). */
  async release(items: Array<{ sellerProductId: string; quantity: number }>, orderId: string): Promise<void> {
    for (const item of items) {
      if (!item.quantity) continue;
      await this.products
        .createQueryBuilder()
        .update(SellerProduct)
        .set({
          reservedStock: () => 'CASE WHEN reservedStock >= :qty THEN reservedStock - :qty ELSE 0 END',
          version: () => 'version + 1',
        })
        .where('id = :id', { id: item.sellerProductId, qty: item.quantity })
        .execute();
      const product = await this.products.findOne({ where: { id: item.sellerProductId } });
      if (product) await this.recordMovement(product, 0, 'release', null, `آزادسازی رزرو سفارش ${orderId}`, product.stock);
    }
  }

  /** قطعی‌کردن کسر موجودی پس از پرداخت موفق/تحویل. */
  async commit(items: Array<{ sellerProductId: string; quantity: number }>, orderId: string): Promise<void> {
    for (const item of items) {
      await this.products
        .createQueryBuilder()
        .update(SellerProduct)
        .set({
          stock: () => 'CASE WHEN stock >= :qty THEN stock - :qty ELSE 0 END',
          reservedStock: () => 'CASE WHEN reservedStock >= :qty THEN reservedStock - :qty ELSE 0 END',
          stockUpdatedAt: new Date(),
          version: () => 'version + 1',
        })
        .where('id = :id', { id: item.sellerProductId, qty: item.quantity })
        .execute();
      const product = await this.products.findOne({ where: { id: item.sellerProductId } });
      if (product) await this.recordMovement(product, -item.quantity, 'sale', null, `کسر موجودی سفارش ${orderId}`, product.stock);
    }
  }

  /** بازگرداندن موجودی پس از مرجوعی تأییدشده. */
  async restock(sellerProductId: string, quantity: number, note: string, actorId: string | null): Promise<void> {
    await this.products
      .createQueryBuilder()
      .update(SellerProduct)
      .set({ stock: () => 'stock + :qty', stockUpdatedAt: new Date(), version: () => 'version + 1' })
      .where('id = :id', { id: sellerProductId, qty: quantity })
      .execute();
    const product = await this.products.findOne({ where: { id: sellerProductId } });
    if (product) await this.recordMovement(product, quantity, 'return', actorId, note, product.stock);
  }

  private async recordMovement(
    product: SellerProduct,
    delta: number,
    reason: InventoryReason,
    actorId: string | null,
    note: string | null,
    stockAfter: number,
  ): Promise<void> {
    await this.movements.save(
      this.movements.create({
        sellerProductId: product.id,
        branchId: product.branchId,
        delta,
        stockAfter,
        reason,
        note,
        actorId,
        actorType: actorId ? 'user' : 'system',
      }),
    );
  }

  async movementsFor(sellerId: string, productId: string): Promise<InventoryMovement[]> {
    const product = await this.get(sellerId, productId);
    return this.movements.find({ where: { sellerProductId: product.id }, order: { createdAt: 'DESC' }, take: 100 });
  }

  private async maybeAlertLowStock(product: SellerProduct): Promise<void> {
    if (!product.isActive) return;
    if (product.availableStock > LOW_STOCK_THRESHOLD) return;
    const seller = product.seller ?? (await this.products.manager.findOne(Seller, { where: { id: product.sellerId } }));
    if (!seller) return;
    await this.notifications
      .notify({
        userId: seller.userId,
        eventKey: 'inventory.low_stock',
        subjectId: product.id,
        vars: { productId: product.id, productName: product.part?.nameFa ?? product.searchKey ?? 'محصول', stock: product.availableStock },
        dedupeKey: `low-stock:${product.id}:${product.stockUpdatedAt?.getTime() ?? Date.now()}`,
      })
      .catch((error) => this.logger.warn(`ارسال اعلان موجودی کم ناموفق بود: ${(error as Error).message}`));
  }
}
