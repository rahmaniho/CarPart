import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import type { CompatibilityLevel } from '@carpart/contract';
import { formatJalali } from '@carpart/contract';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { RankingService, type OfferRankInput } from '../catalog/ranking.service';
import { SearchService } from '../catalog/search.service';
import { Part } from '../catalog/entities/part.entity';
import { JobQueueService } from '../jobs/job-queue.service';
import { MapService } from '../maps/map.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Review } from '../reviews/entities/review.entity';
import { SellerBranch } from '../sellers/entities/seller-branch.entity';
import { SellerProduct } from '../sellers/entities/seller-product.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { SellersService } from '../sellers/sellers.service';
import { PricingService } from '../finance/pricing.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { Vehicle } from '../workshops/entities/vehicle.entity';
import { CreateQuoteDto } from './dto/request.dto';
import { PartRequest } from './entities/part-request.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { Quote } from './entities/quote.entity';
import { RequestsService } from './requests.service';

/** قلم پیشنهاد پیش از ذخیره (بدون شناسه و ارجاع به والد). */
type QuoteItemDraft = Pick<
  QuoteItem,
  | 'sellerProductId'
  | 'partId'
  | 'nameFa'
  | 'sku'
  | 'quality'
  | 'quantity'
  | 'unitPrice'
  | 'lineTotal'
  | 'stockAtQuote'
  | 'isSubstitute'
  | 'note'
>;

export interface QuoteComparisonRow {
  quoteId: string;
  sellerId: string;
  storeName: string;
  sellerRating: number;
  sellerRatingCount: number;
  city: string | null;
  branchName: string | null;
  distanceKm: number | null;
  routeSource: 'live' | 'estimation' | 'unknown';
  itemsTotal: number;
  deliveryFee: number;
  total: number;
  preparationMinutes: number;
  estimatedDeliveryMinutes: number | null;
  expectedReadyAt: string | null;
  expectedDeliveryAt: string | null;
  compatibility: CompatibilityLevel;
  compatibilityNote: string | null;
  hasSubstitute: boolean;
  validUntil: string | null;
  note: string | null;
  rank: number;
  explanation: unknown;
  warnings: string[];
  items: QuoteItem[];
  status: string;
  submittedAt: string | null;
}

/** مدیریت پیشنهاد قیمت فروشندگان روی درخواست‌های تأمین. */
@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    @InjectRepository(Quote) private readonly quotes: Repository<Quote>,
    @InjectRepository(QuoteItem) private readonly quoteItems: Repository<QuoteItem>,
    @InjectRepository(PartRequest) private readonly requests: Repository<PartRequest>,
    @InjectRepository(SellerProduct) private readonly products: Repository<SellerProduct>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(SellerBranch) private readonly branches: Repository<SellerBranch>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly requestsService: RequestsService,
    private readonly sellersService: SellersService,
    private readonly pricing: PricingService,
    private readonly maps: MapService,
    private readonly ranking: RankingService,
    private readonly search: SearchService,
    private readonly notifications: NotificationsService,
    private readonly settings: SystemSettingsService,
    private readonly jobs: JobQueueService,
  ) {}

  /** ثبت پیشنهاد توسط فروشنده تأییدشده. */
  async submitQuote(userId: string, requestId: string, dto: CreateQuoteDto): Promise<Quote> {
    const seller = await this.sellersService.requireVerifiedSeller(userId);
    const request = await this.requests.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('درخواست تأمین');
    if (!['OPEN', 'QUOTED'].includes(request.status)) {
      throw new AppException('این درخواست بسته شده است و امکان ثبت پیشنهاد وجود ندارد.', ErrorCodes.REQUEST_CLOSED, { statusCode: 409 });
    }
    if (request.deadlineAt && request.deadlineAt < new Date()) {
      throw new AppException('مهلت ارسال پیشنهاد برای این درخواست به پایان رسیده است.', ErrorCodes.REQUEST_CLOSED, { statusCode: 409 });
    }
    if (!(await this.requestsService.isTargeted(request, seller.id))) {
      throw new AppException(
        'این درخواست در محدوده خدمات یا شهر فعالیت فروشگاه شما نیست.',
        ErrorCodes.PERMISSION_DENIED,
        { statusCode: 403 },
      );
    }
    if (!dto.items?.length) throw new AppException('حداقل یک قلم در پیشنهاد لازم است.', ErrorCodes.VALIDATION_FAILED);

    const branch = await this.resolveBranch(seller.id, dto.branchId);
    const existing = await this.quotes.findOne({ where: { requestId, sellerId: seller.id, branchId: branch.id, status: 'SUBMITTED' } });
    if (existing) {
      throw new AppException('پیشنهاد فعالی برای این درخواست از همین شعبه ثبت کرده‌اید. آن را ویرایش یا بردارید.', ErrorCodes.CONFLICT, {
        statusCode: 409,
      });
    }

    const items = await this.buildQuoteItems(seller.id, dto);
    const itemsTotal = items.reduce((acc, item) => acc + item.lineTotal, 0);

    const destination = request.deliverySnapshot?.lat && request.deliverySnapshot?.lng
      ? { lat: request.deliverySnapshot.lat, lng: request.deliverySnapshot.lng }
      : null;
    const origin = branch.lat !== null && branch.lng !== null ? { lat: branch.lat, lng: branch.lng } : null;
    const route = origin && destination ? await this.maps.route(origin, destination) : null;
    const delivery = await this.pricing.estimateDeliveryFee({
      distanceKm: route?.distanceKm ?? null,
      urgency: request.urgency,
      itemsTotal,
    });

    const preparationMinutes = dto.preparationMinutes ?? branch.prepTimeMinutes;
    const validityMinutes = await this.settings.getNumber('request.quote.validity_minutes', 60);
    const now = new Date();

    const quote = this.quotes.create({
      requestId: request.id,
      sellerId: seller.id,
      branchId: branch.id,
      status: 'SUBMITTED',
      itemsTotal,
      deliveryFee: delivery.total,
      total: Math.max(0, itemsTotal + delivery.total),
      preparationMinutes,
      estimatedDeliveryMinutes: route ? route.durationMinutes + preparationMinutes : null,
      distanceKm: route?.distanceKm ?? null,
      validUntil: new Date(now.getTime() + validityMinutes * 60_000),
      note: dto.note ?? null,
      supportsPlatformDelivery: dto.supportsPlatformDelivery ?? true,
      submittedAt: now,
      rankSnapshot: {
        weights: await this.ranking.getWeights(),
        computedAt: now.toISOString(),
        routeSource: route?.source ?? 'unknown',
        deliveryBreakdown: delivery.breakdown,
        note: 'رتبه‌بندی در لحظه مشاهده توسط مکانیک و با همان وزن‌های پیکربندی‌شده محاسبه می‌شود.',
      },
    });
    const saved = await this.quotes.save(quote);
    await this.quoteItems.save(items.map((item) => this.quoteItems.create({ quoteId: saved.id, ...item })));
    if (saved.validUntil) await this.scheduleValidityCheck(saved.id, saved.validUntil);

    request.quoteCount = await this.quotes.count({ where: { requestId: request.id } });
    if (request.status === 'OPEN') request.status = 'QUOTED';
    await this.requests.save(request);

    await this.notifications.notify({
      userId: request.userId,
      eventKey: 'request.quote_received',
      subjectId: request.id,
      vars: {
        // نام متغیرها باید با قالب رویداد ({sellerName}, {id}) یکی باشد
        id: request.id,
        title: request.titleFa,
        sellerName: seller.storeName,
        total: saved.total,
        validUntil: formatJalali(saved.validUntil ?? now, { withTime: true }),
      },
      moneyVars: ['total'],
      data: { requestId: request.id, quoteId: saved.id },
      // هر پیشنهاد یک اعلان مستقل می‌گیرد؛ کلید یکتاسازی باید بر اساس شناسه پیشنهاد باشد،
      // وگرنه پیشنهاد دوم همان درخواست هرگز اعلام نمی‌شد.
      dedupeKey: `request.quote_received:${saved.id}`,
    });

    return this.getWithItems(saved.id);
  }

  private async resolveBranch(sellerId: string, branchId?: string | null): Promise<SellerBranch> {
    const where = branchId ? { id: branchId, sellerId, isActive: true } : { sellerId, isPrimary: true, isActive: true };
    const branch = await this.branches.findOne({ where });
    if (!branch) {
      throw new AppException('شعبه معتبری برای ثبت پیشنهاد یافت نشد.', ErrorCodes.PROFILE_INCOMPLETE, { statusCode: 409 });
    }
    return branch;
  }

  private async buildQuoteItems(sellerId: string, dto: CreateQuoteDto): Promise<QuoteItemDraft[]> {
    const productIds = dto.items.map((item) => item.sellerProductId).filter((id): id is string => Boolean(id));
    const products = productIds.length ? await this.products.find({ where: { id: In(productIds), sellerId }, relations: { part: true } }) : [];
    const byId = new Map(products.map((product) => [product.id, product]));

    return dto.items.map((item) => {
      if (item.sellerProductId) {
        const product = byId.get(item.sellerProductId);
        if (!product) throw new NotFoundException('محصول انتخاب‌شده در فروشگاه شما');
        if (!product.isActive) {
          throw new AppException(`محصول «${product.part.nameFa}» غیرفعال است.`, ErrorCodes.PRODUCT_INACTIVE, { statusCode: 409 });
        }
        if (product.availableStock < item.quantity) {
          throw new AppException(
            `موجودی «${product.part.nameFa}» برای این پیشنهاد کافی نیست (قابل فروش: ${product.availableStock}).`,
            ErrorCodes.INSUFFICIENT_STOCK,
            { statusCode: 409 },
          );
        }
        return {
          sellerProductId: product.id,
          partId: product.partId,
          nameFa: product.part.nameFa,
          sku: product.sku,
          quality: item.quality ?? product.quality,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.unitPrice * item.quantity,
          stockAtQuote: product.availableStock,
          isSubstitute: item.isSubstitute ?? false,
          note: item.note ?? null,
        };
      }
      if (!item.nameFa?.trim()) {
        throw new AppException('برای پیشنهاد جایگزین، نام قطعه الزامی است.', ErrorCodes.VALIDATION_FAILED);
      }
      return {
        sellerProductId: null,
        partId: null,
        nameFa: item.nameFa.trim(),
        sku: null,
        quality: item.quality ?? 'unknown',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.quantity,
        stockAtQuote: null,
        isSubstitute: item.isSubstitute ?? true,
        note: item.note ?? null,
      };
    });
  }

  async getWithItems(quoteId: string): Promise<Quote> {
    const quote = await this.quotes.findOne({ where: { id: quoteId }, relations: { items: true } });
    if (!quote) throw new NotFoundException('پیشنهاد');
    return quote;
  }

  /** برداشتن پیشنهاد توسط فروشنده (پیش از انتخاب مکانیک). */
  async withdrawQuote(userId: string, quoteId: string): Promise<Quote> {
    const seller = await this.sellersService.requireSeller(userId);
    const quote = await this.getWithItems(quoteId);
    if (quote.sellerId !== seller.id) {
      throw new AppException('این پیشنهاد متعلق به فروشگاه شما نیست.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    if (quote.status !== 'SUBMITTED') {
      throw new AppException('فقط پیشنهاد ثبت‌شده و انتخاب‌نشده قابل برداشتن است.', ErrorCodes.QUOTE_NOT_SELECTABLE, { statusCode: 409 });
    }
    quote.status = 'WITHDRAWN';
    quote.decidedAt = new Date();
    quote.decisionNote = 'برداشته‌شده توسط فروشنده';
    return this.quotes.save(quote);
  }

  /** نمای مقایسه پیشنهادها برای مکانیک — با رتبه‌بندی شفاف. */
  async compareQuotes(userId: string, requestId: string): Promise<{ request: PartRequest; quotes: QuoteComparisonRow[] }> {
    const request = await this.requests.findOne({ where: { id: requestId, userId } });
    if (!request) throw new NotFoundException('درخواست تأمین');

    const quotes = await this.quotes.find({
      where: { requestId },
      relations: { items: true },
      order: { createdAt: 'ASC' },
    });
    const visible = quotes.filter((quote) => ['SUBMITTED', 'CONVERTED', 'DECLINED'].includes(quote.status));
    if (!visible.length) return { request, quotes: [] };

    const sellerIds = [...new Set(visible.map((quote) => quote.sellerId))];
    const branchIds = [...new Set(visible.map((quote) => quote.branchId))];
    const [sellers, branches] = await Promise.all([
      this.sellers.find({ where: { id: In(sellerIds) } }),
      this.branches.find({ where: { id: In(branchIds) } }),
    ]);
    const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));
    const mismatchRates = await this.mismatchRates(sellerIds);
    const cancellationRates = await this.cancellationRates(sellerIds);

    const vehicle = request.vehicleId ? await this.vehicles.findOne({ where: { id: request.vehicleId }, relations: { model: { make: true }, variant: true } }) : null;
    const partIds = [...new Set(visible.flatMap((quote) => quote.items.map((item) => item.partId).filter((id): id is string => Boolean(id))))];
    const parts = partIds.length ? await this.parts.find({ where: { id: In(partIds) } }) : [];
    const compatibility = await this.search.resolveCompatibility(
      parts,
      vehicle
        ? { makeId: vehicle.model?.makeId ?? null, modelId: vehicle.modelId ?? null, variantId: vehicle.variantId ?? null, year: vehicle.yearFrom ?? null }
        : null,
    );

    const destination = request.deliverySnapshot?.lat && request.deliverySnapshot?.lng
      ? { lat: request.deliverySnapshot.lat, lng: request.deliverySnapshot.lng }
      : null;

    const rankInputs: OfferRankInput[] = [];
    const rows: QuoteComparisonRow[] = [];

    for (const quote of visible) {
      const seller = sellerById.get(quote.sellerId);
      const branch = branchById.get(quote.branchId);
      const origin = branch?.lat !== null && branch?.lat !== undefined && branch?.lng !== null && branch?.lng !== undefined
        ? { lat: branch.lat, lng: branch.lng }
        : null;
      const route = origin && destination ? await this.maps.route(origin, destination) : null;
      const quoteCompatibility = this.bestCompatibility(quote.items, compatibility);

      rankInputs.push({
        sellerProductId: quote.id,
        compatibility: quoteCompatibility.level,
        price: quote.itemsTotal,
        deliveryFee: quote.deliveryFee,
        preparationMinutes: quote.preparationMinutes,
        etaMinutes: quote.estimatedDeliveryMinutes,
        distanceKm: quote.distanceKm ?? route?.distanceKm ?? null,
        sellerRating: seller?.ratingAvg ?? 0,
        sellerRatingCount: seller?.ratingCount ?? 0,
        cancellationRate: cancellationRates.get(quote.sellerId) ?? 0,
        mismatchRate: mismatchRates.get(quote.sellerId) ?? 0,
        stock: 1,
      });

      rows.push({
        quoteId: quote.id,
        sellerId: quote.sellerId,
        storeName: seller?.storeName ?? 'فروشگاه',
        sellerRating: seller?.ratingAvg ?? 0,
        sellerRatingCount: seller?.ratingCount ?? 0,
        city: seller?.city ?? branch?.city ?? null,
        branchName: branch?.name ?? null,
        distanceKm: quote.distanceKm ?? route?.distanceKm ?? null,
        routeSource: route?.source ?? (quote.distanceKm !== null ? 'estimation' : 'unknown'),
        itemsTotal: quote.itemsTotal,
        deliveryFee: quote.deliveryFee,
        total: quote.total,
        preparationMinutes: quote.preparationMinutes,
        estimatedDeliveryMinutes: quote.estimatedDeliveryMinutes,
        expectedReadyAt: this.minutesFromNow(quote.preparationMinutes, quote.submittedAt ?? quote.createdAt),
        expectedDeliveryAt: quote.estimatedDeliveryMinutes
          ? this.minutesFromNow(quote.estimatedDeliveryMinutes, quote.submittedAt ?? quote.createdAt)
          : null,
        compatibility: quoteCompatibility.level,
        compatibilityNote: quoteCompatibility.note,
        hasSubstitute: quote.items.some((item) => item.isSubstitute),
        validUntil: quote.validUntil ? quote.validUntil.toISOString() : null,
        note: quote.note,
        rank: 0,
        explanation: null,
        warnings: [],
        items: quote.items,
        status: quote.status,
        submittedAt: quote.submittedAt ? quote.submittedAt.toISOString() : null,
      });
    }

    const ranked = await this.ranking.rankOffers(rankInputs);
    const rankById = new Map(ranked.map((entry) => [entry.sellerProductId, entry]));
    const sorted = rows
      .map((row) => {
        const entry = rankById.get(row.quoteId);
        return {
          ...row,
          rank: entry?.total ?? 0,
          explanation: entry?.explanation ?? null,
          warnings: [...(entry?.warnings ?? []), ...(row.compatibilityNote && row.compatibility !== 'exact' ? [row.compatibilityNote] : [])],
        };
      })
      .sort((a, b) => b.rank - a.rank || a.total - b.total);

    return { request, quotes: sorted };
  }

  private bestCompatibility(
    items: QuoteItem[],
    compatibility: Map<string, { level: CompatibilityLevel; note: string | null }>,
  ): { level: CompatibilityLevel; note: string | null } {
    const order: CompatibilityLevel[] = ['incompatible', 'unknown', 'likely', 'exact'];
    let best: CompatibilityLevel = 'unknown';
    let note: string | null = null;
    for (const item of items) {
      if (item.isSubstitute) {
        return { level: 'likely', note: 'فروشنده این قلم را به‌عنوان جایگزین پیشنهاد داده است.' };
      }
      const entry = item.partId ? compatibility.get(item.partId) : undefined;
      if (!entry) continue;
      if (order.indexOf(entry.level) < order.indexOf(best)) {
        best = entry.level;
        note = entry.note;
      }
    }
    return { level: best, note };
  }

  private minutesFromNow(minutes: number, base: Date): string | null {
    const time = new Date(base.getTime() + minutes * 60_000);
    return formatJalali(time, { withTime: true });
  }

  /** نرخ مغایرت گزارش‌شده از بازخوردهای واقعی کاربران. */
  private async mismatchRates(sellerIds: string[]): Promise<Map<string, number>> {
    if (!sellerIds.length) return new Map();
    const rows = await this.reviews
      .createQueryBuilder('review')
      .select('review.targetId', 'sellerId')
      .addSelect('COUNT(1)', 'total')
      .addSelect('SUM(CASE WHEN review.hadIssue THEN 1 ELSE 0 END)', 'issues')
      .where('review.targetType = :type', { type: 'seller' })
      .andWhere('review.targetId IN (:...ids)', { ids: sellerIds })
      .groupBy('review.targetId')
      .getRawMany<{ sellerId: string; total: string; issues: string }>();
    const result = new Map<string, number>();
    for (const row of rows) {
      const total = Number(row.total) || 0;
      result.set(row.sellerId, total > 0 ? Number(row.issues || 0) / total : 0);
    }
    return result;
  }

  /** نرخ لغو سفارش از سوی فروشنده (داده واقعی از سفارش‌ها). */
  private async cancellationRates(sellerIds: string[]): Promise<Map<string, number>> {
    if (!sellerIds.length) return new Map();
    const sellers = await this.sellers.find({ where: { id: In(sellerIds) } });
    const result = new Map<string, number>();
    for (const seller of sellers) {
      const total = seller.completedOrders + seller.cancelledOrders;
      result.set(seller.id, total > 0 ? seller.cancelledOrders / total : 0);
    }
    return result;
  }

  /** پیشنهادهای ثبت‌شده توسط فروشنده. */
  async listForSeller(
    userId: string,
    query: { status?: string; page?: number; pageSize?: number } = {},
  ): Promise<PageResult<Quote & { requestTitle?: string | null; deadlineAt?: Date | null }>> {
    const seller = await this.sellersService.requireSeller(userId);
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = { sellerId: seller.id };
    if (query.status) where.status = query.status;
    const [rows, total] = await this.quotes.findAndCount({
      where,
      relations: { items: true, request: true },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    const enriched = rows.map((quote) => ({
      ...quote,
      requestTitle: quote.request?.titleFa ?? null,
      deadlineAt: quote.request?.deadlineAt ?? null,
    }));
    return buildPage(enriched, total, query.page ?? 1, query.pageSize ?? 20);
  }

  /** انقضای پیشنهادها پس از پایان اعتبار. */
  async expireQuotes(now = new Date()): Promise<number> {
    const result = await this.quotes.update(
      { status: 'SUBMITTED', validUntil: LessThan(now) },
      { status: 'EXPIRED', decidedAt: now, decisionNote: 'پایان مهلت اعتبار پیشنهاد' },
    );
    return result.affected ?? 0;
  }

  async statsForSeller(userId: string): Promise<{ submitted: number; converted: number; declined: number; expired: number; avgTotal: number }> {
    const seller = await this.sellersService.requireSeller(userId);
    const rows = await this.quotes.find({ where: { sellerId: seller.id }, take: 500 });
    const converted = rows.filter((quote) => quote.status === 'CONVERTED');
    return {
      submitted: rows.filter((quote) => quote.status === 'SUBMITTED').length,
      converted: converted.length,
      declined: rows.filter((quote) => quote.status === 'DECLINED').length,
      expired: rows.filter((quote) => quote.status === 'EXPIRED').length,
      avgTotal: converted.length ? Math.round(converted.reduce((acc, quote) => acc + quote.total, 0) / converted.length) : 0,
    };
  }

  /** به‌روزرسانی میانگین زمان پاسخ فروشگاه‌ها (فرایند زمان‌بندی‌شده). */
  async refreshSellerResponseTimes(): Promise<number> {
    const sellers = await this.sellers.find({ where: { verificationStatus: 'APPROVED', isActive: true }, take: 200 });
    let updated = 0;
    for (const seller of sellers) {
      const avg = await this.requestsService.avgResponseMinutes(seller.id);
      if (avg !== null && seller.avgResponseMinutes !== avg) {
        seller.avgResponseMinutes = avg;
        await this.sellers.save(seller);
        updated += 1;
      }
    }
    if (updated) this.logger.log(`میانگین زمان پاسخ ${updated} فروشگاه به‌روزرسانی شد.`);
    return updated;
  }

  /** برای ثبت در صف کارها هنگام ارسال پیشنهاد. */
  async scheduleValidityCheck(quoteId: string, validUntil: Date): Promise<void> {
    await this.jobs.enqueue('quote.expire', { quoteId }, { dedupeKey: `quote-expire:${quoteId}`, runAt: validUntil, maxAttempts: 2 });
  }
}
