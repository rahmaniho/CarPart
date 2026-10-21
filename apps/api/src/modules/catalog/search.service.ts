import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';
import {
  boundingBox,
  haversineKm,
  normalizeFa,
  toLatinDigits,
  type CompatibilityLevel,
  type LatLng,
  type OfferDto,
  type RankExplanation,
} from '@carpart/contract';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { NotFoundException } from '../../common/errors/app-error';
import { Part } from './entities/part.entity';
import { PartCompatibility } from './entities/part-compatibility.entity';
import { SellerProduct } from '../sellers/entities/seller-product.entity';
import { SellerBranch } from '../sellers/entities/seller-branch.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { Review } from '../reviews/entities/review.entity';
import { Vehicle } from '../workshops/entities/vehicle.entity';
import { VehicleModel, VehicleVariant, VehicleMake } from './entities/vehicle-catalog.entity';
import { MapService } from '../maps/map.service';
import { PricingService } from '../finance/pricing.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { RankingService, type OfferRankInput } from './ranking.service';
import type { SearchQueryDto } from './dto/search.dto';

/** نتیجه جست‌وجوی پیشنهادها — شکل کامل‌تر از OfferDto پایه در قرارداد مشترک. */
export interface OfferSearchResult extends OfferDto {
  part: {
    id: string;
    nameFa: string;
    nameEn: string | null;
    technicalCode: string | null;
    oemCode: string | null;
    category: { id: string; nameFa: string } | null;
    brand: { id: string; nameFa: string; isOem: boolean } | null;
    image: string | null;
    unit: string;
  };
  branch: { id: string; name: string; city: string | null; lat: number | null; lng: number | null };
  sellerDetail: { id: string; verificationStatus: string; ratingCount: number; ratingAvg: number };
  listPrice: number | null;
  isGenuineClaimed: boolean;
  warrantyNote: string | null;
  returnPolicy: string | null;
  returnWindowDays: number;
  conditionNote: string | null;
  priceUpdatedAt: string | null;
  stockUpdatedAt: string | null;
  compatibility: { level: CompatibilityLevel; note: string | null };
  deliveryFeeBreakdown: Array<{ fa: string; amount: number }>;
  routeSource: string;
  sku: string | null;
  isFeatured: boolean;
  warnings: string[];
}

export interface SearchContext {
  userId?: string | null;
  workshopId?: string | null;
  location?: LatLng | null;
}

export interface PartSummaryDto {
  id: string;
  nameFa: string;
  nameEn: string | null;
  technicalCode: string | null;
  oemCode: string | null;
  category: { id: string; nameFa: string } | null;
  brand: { id: string; nameFa: string; isOem: boolean } | null;
  image: string | null;
  offerCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  compatibility: CompatibilityLevel | 'unknown';
}

interface CandidateRow {
  product: SellerProduct;
  part: Part;
  branch: SellerBranch;
  seller: Seller;
}

const COMPATIBILITY_ORDER: Record<CompatibilityLevel, number> = {
  exact: 3,
  likely: 2,
  unknown: 1,
  incompatible: 0,
};

/**
 * سرویس جست‌وجوی قطعات و پیشنهادهای فروش.
 *
 * ویژگی‌ها:
 * - یکسان‌سازی متن فارسی (ی/ي، ک/ك، ارقام فارسی/عربی، فاصله‌های اضافی)
 * - جست‌وجو با نام قطعه، کد فنی، شماره OEM، SKU فروشنده، برند و دسته‌بندی
 * - فیلتر سازگاری با خودرو به‌صورت ساختاریافته (نه متن آزاد)
 * - محاسبه فاصله/زمان از لایه نقشه قابل جایگزینی و هزینه ارسال پیش از پرداخت
 * - رتبه‌بندی شفاف با وزن‌های قابل تنظیم
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(SellerProduct) private readonly products: Repository<SellerProduct>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(PartCompatibility) private readonly compatibilities: Repository<PartCompatibility>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(VehicleModel) private readonly models: Repository<VehicleModel>,
    @InjectRepository(VehicleVariant) private readonly variants: Repository<VehicleVariant>,
    @InjectRepository(VehicleMake) private readonly makes: Repository<VehicleMake>,
    private readonly maps: MapService,
    private readonly pricing: PricingService,
    private readonly ranking: RankingService,
    private readonly settings: SystemSettingsService,
  ) {}

  /** جست‌وجوی پیشنهادهای فروش (نتیجه اصلی برای مکانیک). */
  /**
   * فیلتر متنی tolerant بر پایه واژه.
   *
   * هر واژه از عبارت جست‌وجو باید در یکی از فیلدهای متنی یافت شود؛ بنابراین ترتیب واژه‌ها،
   * فاصله‌های اضافی و نیم‌فاصله نتیجه را از بین نمی‌برد. پیش از مقایسه، نویسه‌های فارسی/عربی
   * (ی/ي و ک/ك) و ارقام فارسی/عربی یکسان‌سازی می‌شوند.
   */
  private applyTextFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    raw: string,
    fields: { textColumns: string[]; codeColumns: string[] },
  ): void {
    const tokens = normalizeFa(raw)
      .split(/\s+/)
      .filter((token) => token.length > 0)
      .slice(0, 6);
    tokens.forEach((token, index) => {
      const latin = toLatinDigits(token).replace(/\s+/g, '').toLowerCase();
      const textClauses = fields.textColumns.map((column) => `${column} LIKE :tok${index}`);
      const codeClauses = fields.codeColumns.flatMap((column) => [
        `LOWER(${column}) LIKE :tokLatin${index}`,
        `REPLACE(LOWER(${column}), ' ', '') LIKE :tokLatin${index}`,
      ]);
      qb.andWhere(`(${[...textClauses, ...codeClauses].join(' OR ')})`, {
        [`tok${index}`]: `%${token}%`,
        [`tokLatin${index}`]: `%${latin}%`,
      });
    });
  }

  async searchOffers(query: SearchQueryDto, context: SearchContext = {}): Promise<PageResult<OfferSearchResult>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const maxCandidates = await this.settings.getNumber('search.max_candidates', 300);

    const location = await this.resolveLocation(query, context);
    const vehicleInfo = await this.resolveVehicle(query);

    const candidates = await this.findCandidates(query, maxCandidates);
    if (!candidates.length) return buildPage([], 0, query.page ?? 1, query.pageSize ?? 20);

    const compatibilityMap = await this.resolveCompatibility(
      candidates.map((c) => c.part),
      vehicleInfo,
    );
    const mismatchRates = await this.sellerMismatchRates(candidates.map((c) => c.seller.id));

    const enriched: Array<{ offer: OfferSearchResult; rankInput: OfferRankInput; total: number; warnings: string[]; explanation: RankExplanation }> = [];
    const routeCache = new Map<string, { distanceKm: number | null; etaMinutes: number | null; source: string }>();

    for (const candidate of candidates) {
      const { product, part, branch, seller } = candidate;
      const cacheKey = branch.id;
      let route = routeCache.get(cacheKey);
      if (!route) {
        const branchPoint = branch.lat !== null && branch.lng !== null ? { lat: branch.lat, lng: branch.lng } : null;
        const estimate = location && branchPoint ? await this.maps.route(branchPoint, location) : null;
        route = {
          distanceKm: estimate?.distanceKm ?? (branchPoint && location ? haversineKm(branchPoint, location) : null),
          etaMinutes: estimate ? estimate.durationMinutes : null,
          source: estimate?.source ?? 'estimation',
        };
        routeCache.set(cacheKey, route);
      }

      if (query.radiusKm && location && route.distanceKm !== null && route.distanceKm > query.radiusKm) continue;

      const fee = await this.pricing.estimateDeliveryFee({
        distanceKm: route.distanceKm,
        urgency: 'normal',
        itemsTotal: product.price,
      });
      const compatibility = compatibilityMap.get(part.id) ?? { level: 'unknown' as CompatibilityLevel, note: null };
      const cancellationRate = seller.completedOrders + seller.cancelledOrders > 0 ? seller.cancelledOrders / (seller.completedOrders + seller.cancelledOrders) : 0;

      const offer: OfferSearchResult = {
        id: product.id,
        sellerProductId: product.id,
        seller: {
          id: seller.id,
          name: seller.storeName,
          branchName: branch.name,
          rating: seller.ratingAvg || null,
          city: branch.city ?? seller.city ?? null,
        },
        price: product.price,
        stock: product.availableStock,
        quality: product.quality,
        preparationMinutes: product.preparationMinutes,
        deliveryFee: fee.total,
        estimatedDeliveryMinutes: route.etaMinutes === null ? null : route.etaMinutes + product.preparationMinutes,
        distanceKm: route.distanceKm,
        updatedAt: (product.updatedAt ?? new Date()).toISOString(),
        rank: { total: 0, factors: [], compatibility: compatibility.level, transparent: true },
        part: {
          id: part.id,
          nameFa: part.nameFa,
          nameEn: part.nameEn,
          technicalCode: part.technicalCode,
          oemCode: part.oemCode,
          category: part.category ? { id: part.category.id, nameFa: part.category.nameFa } : null,
          brand: part.brand ? { id: part.brand.id, nameFa: part.brand.nameFa, isOem: part.brand.isOem } : null,
          image: product.images?.[0] ?? part.images?.[0] ?? null,
          unit: part.unit,
        },
        branch: { id: branch.id, name: branch.name, city: branch.city, lat: branch.lat, lng: branch.lng },
        sellerDetail: {
          id: seller.id,
          verificationStatus: seller.verificationStatus,
          ratingCount: seller.ratingCount,
          ratingAvg: seller.ratingAvg,
        },
        listPrice: product.listPrice,
        isGenuineClaimed: product.isGenuineClaimed,
        warrantyNote: product.warrantyNote,
        returnPolicy: product.returnPolicy,
        returnWindowDays: product.returnWindowDays,
        conditionNote: product.conditionNote,
        priceUpdatedAt: product.priceUpdatedAt ? product.priceUpdatedAt.toISOString() : null,
        stockUpdatedAt: product.stockUpdatedAt ? product.stockUpdatedAt.toISOString() : null,
        compatibility: { level: compatibility.level, note: compatibility.note },
        deliveryFeeBreakdown: fee.breakdown,
        routeSource: route.source,
        sku: product.sku,
        isFeatured: product.isFeatured,
        warnings: [],
      };

      enriched.push({
        offer,
        total: 0,
        warnings: [],
        explanation: offer.rank,
        rankInput: {
          sellerProductId: product.id,
          compatibility: compatibility.level,
          price: product.price,
          deliveryFee: fee.total,
          preparationMinutes: product.preparationMinutes,
          etaMinutes: route.etaMinutes === null ? null : route.etaMinutes + product.preparationMinutes,
          distanceKm: route.distanceKm,
          sellerRating: seller.ratingAvg ?? 0,
          sellerRatingCount: seller.ratingCount ?? 0,
          cancellationRate,
          mismatchRate: mismatchRates.get(seller.id) ?? 0,
          stock: product.availableStock,
          isFeatured: product.isFeatured,
        },
      });
    }

    const ranked = await this.ranking.rankOffers(
      enriched.map((item) => item.rankInput),
      { maxDistanceKm: query.radiusKm ?? undefined },
    );
    const rankById = new Map(ranked.map((r) => [r.sellerProductId, r]));
    for (const item of enriched) {
      const result = rankById.get(item.rankInput.sellerProductId);
      if (result) {
        item.total = result.total;
        item.warnings = result.warnings;
        item.offer.rank = result.explanation;
        item.offer.warnings = result.warnings;
      }
    }

    this.sortOffers(enriched, query.sort ?? 'rank');
    const pageItems = enriched.slice(skip, skip + take).map((item) => item.offer);
    return buildPage(pageItems, enriched.length, query.page ?? 1, query.pageSize ?? 20);
  }

  private sortOffers(
    items: Array<{ offer: OfferSearchResult; total: number }>,
    sort: NonNullable<SearchQueryDto['sort']>,
  ): void {
    const byRank = (a: { total: number }, b: { total: number }) => b.total - a.total;
    switch (sort) {
      case 'price_asc':
        items.sort((a, b) => a.offer.price - b.offer.price || byRank(a, b));
        break;
      case 'price_desc':
        items.sort((a, b) => b.offer.price - a.offer.price || byRank(a, b));
        break;
      case 'distance':
        items.sort((a, b) => (a.offer.distanceKm ?? 1e9) - (b.offer.distanceKm ?? 1e9));
        break;
      case 'newest':
        items.sort((a, b) => Date.parse(b.offer.updatedAt) - Date.parse(a.offer.updatedAt));
        break;
      case 'rating':
        items.sort(
          (a, b) =>
            ((b.offer.seller.rating ?? 0) as number) - ((a.offer.seller.rating ?? 0) as number) || byRank(a, b),
        );
        break;
      case 'rank':
      default:
        items.sort(byRank);
    }
  }

  private async findCandidates(query: SearchQueryDto, limit: number): Promise<CandidateRow[]> {
    const qb = this.products
      .createQueryBuilder('sp')
      .innerJoinAndSelect('sp.part', 'part')
      .leftJoinAndSelect('part.category', 'category')
      .leftJoinAndSelect('part.brand', 'brand')
      .innerJoinAndSelect('sp.branch', 'branch')
      .innerJoinAndSelect('sp.seller', 'seller')
      .where('sp.isActive = :active', { active: true })
      .andWhere('part.isActive = :active', { active: true })
      .andWhere('seller.isActive = :active', { active: true })
      .andWhere('seller.verificationStatus = :approved', { approved: 'APPROVED' })
      .andWhere('branch.isActive = :active', { active: true });

    const raw = query.q?.trim() ?? '';
    if (raw) {
      this.applyTextFilter(qb, raw, {
        textColumns: ['part.searchKey', 'sp.searchKey', 'part.nameFa'],
        codeColumns: ['sp.sku', 'part.technicalCode', 'part.oemCode'],
      });
    }
    if (query.categoryId) qb.andWhere('part.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.brandId) qb.andWhere('part.brandId = :brandId', { brandId: query.brandId });
    if (query.quality) qb.andWhere('sp.quality = :quality', { quality: query.quality });
    if (query.minPrice !== undefined) qb.andWhere('sp.price >= :minPrice', { minPrice: query.minPrice });
    if (query.maxPrice !== undefined) qb.andWhere('sp.price <= :maxPrice', { maxPrice: query.maxPrice });
    if (query.city) qb.andWhere('(branch.city = :city OR seller.city = :city)', { city: query.city });
    if (query.inStockOnly === 'true' || query.inStockOnly === '1') {
      qb.andWhere('sp.stock - sp.reservedStock > 0');
    }
    if (query.lat !== undefined && query.lng !== undefined && query.radiusKm) {
      const box = boundingBox({ lat: query.lat, lng: query.lng }, query.radiusKm * 1.4);
      qb.andWhere('branch.lat BETWEEN :minLat AND :maxLat', { minLat: box.minLat, maxLat: box.maxLat })
        .andWhere('branch.lng BETWEEN :minLng AND :maxLng', { minLng: box.minLng, maxLng: box.maxLng });
    }

    qb.orderBy('sp.stock', 'DESC').addOrderBy('sp.price', 'ASC').take(limit);
    const rows = await qb.getMany();
    return rows.map((product) => ({
      product,
      part: product.part,
      branch: product.branch,
      seller: product.seller,
    }));
  }

  private async resolveLocation(query: SearchQueryDto, context: SearchContext): Promise<LatLng | null> {
    if (query.lat !== undefined && query.lng !== undefined) return { lat: query.lat, lng: query.lng };
    if (context.location) return context.location;
    return null;
  }

  private async resolveVehicle(query: SearchQueryDto): Promise<{
    makeId?: string | null;
    modelId?: string | null;
    variantId?: string | null;
    year?: number | null;
    engine?: string | null;
    label?: string | null;
  } | null> {
    if (query.vehicleId) {
      const vehicle = await this.vehicles.findOne({ where: { id: query.vehicleId } });
      if (vehicle) {
        const variant = vehicle.variantId ? await this.variants.findOne({ where: { id: vehicle.variantId } }) : null;
        const model = vehicle.modelId ? await this.models.findOne({ where: { id: vehicle.modelId } }) : variant?.model ?? null;
        const make = model?.makeId ? await this.makes.findOne({ where: { id: model.makeId } }) : null;
        return {
          makeId: make?.id ?? null,
          modelId: model?.id ?? null,
          variantId: variant?.id ?? null,
          year: vehicle.yearFrom ?? null,
          engine: vehicle.engine ?? null,
          label: [make?.nameFa, model?.nameFa ?? vehicle.freeModelName, variant?.nameFa].filter(Boolean).join(' ') || null,
        };
      }
    }
    if (query.variantId || query.modelId || query.makeId) {
      const variant = query.variantId ? await this.variants.findOne({ where: { id: query.variantId } }) : null;
      const model = query.modelId ? await this.models.findOne({ where: { id: query.modelId } }) : variant?.model ?? null;
      const make = query.makeId ? await this.makes.findOne({ where: { id: query.makeId } }) : model?.make ?? null;
      return {
        makeId: make?.id ?? null,
        modelId: model?.id ?? variant?.modelId ?? null,
        variantId: variant?.id ?? null,
        year: null,
        engine: variant?.engine ?? null,
        label: [make?.nameFa, model?.nameFa, variant?.nameFa].filter(Boolean).join(' ') || null,
      };
    }
    return null;
  }

  /** تعیین سطح سازگاری هر قطعه با خودرو — دقیق‌ترین سطح تطابق انتخاب می‌شود. */
  async resolveCompatibility(
    parts: Part[],
    vehicle: { makeId?: string | null; modelId?: string | null; variantId?: string | null; year?: number | null } | null,
  ): Promise<Map<string, { level: CompatibilityLevel; note: string | null }>> {
    const result = new Map<string, { level: CompatibilityLevel; note: string | null }>();
    if (!parts.length) return result;
    const rows = await this.compatibilities.find({ where: { partId: In(parts.map((p) => p.id)), isActive: true } });
    const byPart = new Map<string, PartCompatibility[]>();
    for (const row of rows) {
      const list = byPart.get(row.partId) ?? [];
      list.push(row);
      byPart.set(row.partId, list);
    }

    for (const part of parts) {
      const matches = byPart.get(part.id) ?? [];
      if (!vehicle) {
        result.set(part.id, {
          level: part.isCompatibilityCritical ? 'unknown' : 'exact',
          note: part.isCompatibilityCritical
            ? 'خودرو انتخاب نشده است؛ سازگاری بررسی نشد.'
            : 'قطعه عمومی است و به خودروی خاصی محدود نمی‌شود.',
        });
        continue;
      }
      let best: { level: CompatibilityLevel; note: string | null } = {
        level: part.isCompatibilityCritical ? 'unknown' : 'exact',
        note: part.isCompatibilityCritical ? 'هیچ رکورد سازگاری برای این خودرو ثبت نشده است.' : 'قطعه عمومی است.',
      };
      for (const row of matches) {
        const yearOk =
          (!row.yearFrom || !vehicle.year || vehicle.year >= row.yearFrom) && (!row.yearTo || !vehicle.year || vehicle.year <= row.yearTo);
        if (!yearOk) continue;
        const variantMatch = row.variantId && vehicle.variantId ? row.variantId === vehicle.variantId : null;
        const modelMatch = row.modelId && vehicle.modelId ? row.modelId === vehicle.modelId : null;
        const makeMatch = row.makeId && vehicle.makeId ? row.makeId === vehicle.makeId : null;
        if (variantMatch === false || modelMatch === false || makeMatch === false) continue;
        const precision = variantMatch === true ? 3 : modelMatch === true ? 2 : makeMatch === true ? 1 : 0;
        const candidate: CompatibilityLevel = precision >= 3 ? row.level : precision === 2 ? (row.level === 'exact' ? 'likely' : row.level) : 'likely';
        if (COMPATIBILITY_ORDER[candidate] > COMPATIBILITY_ORDER[best.level]) {
          best = { level: candidate, note: row.note ?? null };
        }
      }
      result.set(part.id, best);
    }
    return result;
  }

  /** نرخ گزارش مغایرت هر فروشنده از داده واقعی نظرسنجی‌ها. */
  private async sellerMismatchRates(sellerIds: string[]): Promise<Map<string, number>> {
    const ids = [...new Set(sellerIds)];
    if (!ids.length) return new Map();
    const rows = await this.reviews
      .createQueryBuilder('review')
      .select('review.targetId', 'sellerId')
      .addSelect('COUNT(1)', 'total')
      .addSelect('SUM(CASE WHEN review.hadIssue THEN 1 ELSE 0 END)', 'issues')
      .where('review.targetType = :type', { type: 'seller' })
      .andWhere('review.targetId IN (:...ids)', { ids })
      .groupBy('review.targetId')
      .getRawMany<{ sellerId: string; total: string; issues: string }>();
    const map = new Map<string, number>();
    for (const row of rows) {
      const total = Number(row.total) || 0;
      const issues = Number(row.issues) || 0;
      map.set(row.sellerId, total > 0 ? issues / total : 0);
    }
    return map;
  }

  /** جست‌وجو در کاتالوگ عمومی قطعات (بدون در نظر گرفتن فروشنده). */
  async searchParts(query: SearchQueryDto): Promise<PageResult<PartSummaryDto>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const qb = this.parts
      .createQueryBuilder('part')
      .leftJoinAndSelect('part.category', 'category')
      .leftJoinAndSelect('part.brand', 'brand')
      .where('part.isActive = :active', { active: true });
    const raw = query.q?.trim() ?? '';
    if (raw) {
      this.applyTextFilter(qb, raw, {
        textColumns: ['part.searchKey', 'part.nameFa'],
        codeColumns: ['part.technicalCode', 'part.oemCode'],
      });
    }
    if (query.categoryId) qb.andWhere('part.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.brandId) qb.andWhere('part.brandId = :brandId', { brandId: query.brandId });
    qb.orderBy('part.nameFa', 'ASC').skip(skip).take(take);
    const [rows, total] = await qb.getManyAndCount();

    const offerStats = rows.length
      ? await this.products
          .createQueryBuilder('sp')
          .select('sp.partId', 'partId')
          .addSelect('COUNT(1)', 'offers')
          .addSelect('MIN(sp.price)', 'minPrice')
          .addSelect('MAX(sp.price)', 'maxPrice')
          .where('sp.partId IN (:...ids)', { ids: rows.map((r) => r.id) })
          .andWhere('sp.isActive = :active', { active: true })
          .groupBy('sp.partId')
          .getRawMany<{ partId: string; offers: string; minPrice: string; maxPrice: string }>()
      : [];
    const stats = new Map(offerStats.map((row) => [row.partId, row]));

    const items: PartSummaryDto[] = rows.map((part) => ({
      id: part.id,
      nameFa: part.nameFa,
      nameEn: part.nameEn,
      technicalCode: part.technicalCode,
      oemCode: part.oemCode,
      category: part.category ? { id: part.category.id, nameFa: part.category.nameFa } : null,
      brand: part.brand ? { id: part.brand.id, nameFa: part.brand.nameFa, isOem: part.brand.isOem } : null,
      image: part.images?.[0] ?? null,
      offerCount: Number(stats.get(part.id)?.offers ?? 0),
      minPrice: stats.get(part.id) ? Number(stats.get(part.id)?.minPrice) : null,
      maxPrice: stats.get(part.id) ? Number(stats.get(part.id)?.maxPrice) : null,
      compatibility: 'unknown',
    }));
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  /** جزئیات یک قطعه + پیشنهادهای فعال آن. */
  async partDetail(partId: string, query: SearchQueryDto = {}, context: SearchContext = {}) {
    const part = await this.parts.findOne({
      where: { id: partId },
      relations: { category: true, brand: true },
    });
    if (!part) throw new NotFoundException('قطعه');
    const offers = await this.searchOffers({ ...query, pageSize: 50, page: 1 }, context);
    const offersForPart = offers.items.filter((offer) => offer.part.id === partId);
    const related = await this.parts.find({ where: { categoryId: part.categoryId, isActive: true }, take: 8 });
    const compatibilities = await this.compatibilities.find({ where: { partId, isActive: true }, take: 50 });
    return {
      part: {
        id: part.id,
        nameFa: part.nameFa,
        nameEn: part.nameEn,
        technicalCode: part.technicalCode,
        oemCode: part.oemCode,
        description: part.description,
        specs: part.specs ?? {},
        images: part.images ?? [],
        unit: part.unit,
        defaultQuality: part.defaultQuality,
        category: part.category ? { id: part.category.id, nameFa: part.category.nameFa } : null,
        brand: part.brand ? { id: part.brand.id, nameFa: part.brand.nameFa, isOem: part.brand.isOem } : null,
        referencePrice: part.referencePrice,
      },
      offers: offersForPart,
      compatibilities: compatibilities.map((row) => ({
        id: row.id,
        level: row.level,
        makeId: row.makeId,
        modelId: row.modelId,
        variantId: row.variantId,
        yearFrom: row.yearFrom,
        yearTo: row.yearTo,
        engine: row.engine,
        note: row.note,
        source: row.source,
      })),
      related: related.filter((row) => row.id !== partId).map((row) => ({ id: row.id, nameFa: row.nameFa, technicalCode: row.technicalCode })),
    };
  }
}
