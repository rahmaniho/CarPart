import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { formatJalali, haversineKm, normalizeFa, type RequestStatus } from '@carpart/contract';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { shortCode } from '../../common/utils/id';
import { JobQueueService } from '../jobs/job-queue.service';
import { MapService } from '../maps/map.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SellerBranch } from '../sellers/entities/seller-branch.entity';
import { SellerProduct } from '../sellers/entities/seller-product.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { SellersService } from '../sellers/sellers.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { WorkshopsService } from '../workshops/workshops.service';
import { PartRequest } from './entities/part-request.entity';
import { Quote } from './entities/quote.entity';
import { CreatePartRequestDto } from './dto/request.dto';

export interface TargetSeller {
  sellerId: string;
  branchId: string;
  storeName: string;
  city: string | null;
  distanceKm: number | null;
  hasMatchingProduct: boolean;
  isOpenNow: boolean;
}

/** مدیریت درخواست‌های تأمین قطعه: ثبت، هدف‌گیری فروشندگان، مهلت و انقضا. */
@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(PartRequest) private readonly requests: Repository<PartRequest>,
    @InjectRepository(Quote) private readonly quotes: Repository<Quote>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(SellerBranch) private readonly branches: Repository<SellerBranch>,
    @InjectRepository(SellerProduct) private readonly products: Repository<SellerProduct>,
    private readonly workshops: WorkshopsService,
    private readonly sellersService: SellersService,
    private readonly settings: SystemSettingsService,
    private readonly maps: MapService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobQueueService,
  ) {}

  async create(userId: string, dto: CreatePartRequestDto): Promise<{ request: PartRequest; targets: TargetSeller[] }> {
    const workshop = await this.workshops.requireWorkshop(userId);
    const address = dto.deliveryAddressId
      ? await this.workshops.findAddress(userId, dto.deliveryAddressId)
      : ((await this.workshops.listAddresses(userId))[0] ?? null);
    if (!address && !(workshop.lat !== null && workshop.lng !== null)) {
      throw new AppException(
        'برای ثبت درخواست، حداقل یک آدرس تحویل یا موقعیت تعمیرگاه روی نقشه لازم است.',
        ErrorCodes.PROFILE_INCOMPLETE,
        { statusCode: 409 },
      );
    }

    const vehicle = dto.vehicleId ? (await this.workshops.listVehicles(userId)).find((v) => v.id === dto.vehicleId) ?? null : null;
    const vehicleSnapshot = vehicle
      ? {
          makeName: vehicle.model?.make?.nameFa ?? vehicle.freeMakeName ?? null,
          modelName: vehicle.model?.nameFa ?? vehicle.freeModelName ?? null,
          variantName: vehicle.variant?.nameFa ?? null,
          year: vehicle.yearFrom ?? null,
          engine: vehicle.engine ?? null,
          plate: vehicle.plate ?? null,
          vin: vehicle.vin ?? null,
        }
      : dto.vehicleInfo
        ? {
            makeName: dto.vehicleInfo.freeMakeName ?? null,
            modelName: dto.vehicleInfo.freeModelName ?? null,
            variantName: dto.vehicleInfo.variantName ?? null,
            year: dto.vehicleInfo.year ?? null,
            engine: dto.vehicleInfo.engine ?? null,
            plate: dto.vehicleInfo.plate ?? null,
            vin: null,
          }
        : null;

    const urgency = dto.urgency ?? 'normal';
    const deadlineMinutes =
      urgency === 'normal'
        ? await this.settings.getNumber('request.quote.deadline_minutes', 45)
        : await this.settings.getNumber('request.quote.urgent_deadline_minutes', 15);
    const deadlineAt = new Date(Date.now() + deadlineMinutes * 60_000);

    const deliverySnapshot = address
      ? {
          receiverName: address.receiverName,
          phone: address.phone,
          city: address.city ?? workshop.city,
          addressText: address.addressText,
          lat: address.lat ?? workshop.lat,
          lng: address.lng ?? workshop.lng,
        }
      : {
          receiverName: workshop.ownerName ?? workshop.name,
          phone: workshop.phone ?? '',
          city: workshop.city,
          addressText: workshop.addressText ?? '',
          lat: workshop.lat,
          lng: workshop.lng,
        };

    const request = this.requests.create({
      code: shortCode(6, 'REQ'),
      userId,
      workshopId: workshop.id,
      status: 'OPEN',
      titleFa: dto.titleFa?.trim() || dto.partNameFa.trim(),
      partNameFa: dto.partNameFa.trim(),
      technicalCode: dto.technicalCode ?? null,
      oemCode: dto.oemCode ?? null,
      categoryId: dto.categoryId ?? null,
      quantity: dto.quantity,
      qualityPreference: dto.qualityPreference ?? 'unknown',
      onlyGenuine: dto.onlyGenuine ?? false,
      urgency,
      description: dto.description ?? null,
      images: dto.images ?? null,
      vehicleId: vehicle?.id ?? dto.vehicleId ?? null,
      vehicleSnapshot,
      city: dto.city ?? deliverySnapshot.city ?? workshop.city,
      deliveryAddressId: address?.id ?? null,
      deliverySnapshot,
      neededBy: dto.neededBy ? new Date(dto.neededBy) : null,
      deadlineAt,
      searchKey: normalizeFa(`${dto.partNameFa} ${dto.technicalCode ?? ''} ${dto.oemCode ?? ''}`),
    });
    const saved = await this.requests.save(request);

    const targets = await this.resolveTargets(saved);
    saved.targetedSellerIds = [...new Set(targets.map((t) => t.sellerId))];
    await this.requests.save(saved);

    await this.notifyTargets(saved, targets);
    await this.notifications.notify({
      userId,
      eventKey: 'request.created',
      subjectId: saved.id,
      vars: {
        id: saved.id,
        title: saved.titleFa,
        code: saved.code,
        sellerCount: new Set(targets.map((t) => t.sellerId)).size,
        deadline: formatJalali(deadlineAt, { withTime: true }),
      },
      moneyVars: [],
      data: { requestId: saved.id },
    });

    await this.jobs.enqueue(
      'request.expire',
      { requestId: saved.id },
      { dedupeKey: `expire:${saved.id}`, runAt: deadlineAt, maxAttempts: 3 },
    );

    return { request: saved, targets };
  }

  /** یافتن فروشندگان مرتبط بر اساس موقعیت، محدوده خدمات، شهر و دسته‌بندی قطعه. */
  async resolveTargets(request: PartRequest): Promise<TargetSeller[]> {
    const maxTargets = await this.settings.getNumber('request.quote.max_target_sellers', 12);
    const branches = await this.branches.find({ where: { isActive: true }, relations: { seller: true }, take: 500 });
    const origin = request.deliverySnapshot?.lat && request.deliverySnapshot?.lng
      ? { lat: request.deliverySnapshot.lat, lng: request.deliverySnapshot.lng }
      : null;

    const candidates = branches
      .filter((branch) => branch.seller && branch.seller.isActive && branch.seller.verificationStatus === 'APPROVED')
      .map((branch) => {
        const distanceKm =
          origin && branch.lat !== null && branch.lng !== null
            ? haversineKm(origin, { lat: branch.lat, lng: branch.lng })
            : null;
        const inCity = Boolean(request.city && branch.city && branch.city === request.city);
        const inRadius = distanceKm !== null && distanceKm <= branch.serviceRadiusKm;
        return { branch, distanceKm, inCity, inRadius };
      })
      .filter((candidate) => candidate.inCity || candidate.inRadius || (!request.city && candidate.distanceKm === null));

    if (!candidates.length) return [];

    // اولویت با فروشندگانی است که در همان دسته‌بندی محصول فعال دارند
    const sellerIds = [...new Set(candidates.map((c) => c.branch.sellerId))];
    const matchingSellerIds = new Set<string>();
    if (request.categoryId && sellerIds.length) {
      const rows = await this.products
        .createQueryBuilder('sp')
        .select('DISTINCT sp.sellerId', 'sellerId')
        .innerJoin('sp.part', 'part')
        .where('sp.sellerId IN (:...sellerIds)', { sellerIds })
        .andWhere('part.categoryId = :categoryId', { categoryId: request.categoryId })
        .andWhere('sp.isActive = :active', { active: true })
        .andWhere('sp.stock - sp.reservedStock > 0')
        .getRawMany<{ sellerId: string }>();
      rows.forEach((row) => matchingSellerIds.add(row.sellerId));
    }

    const scored = candidates
      .map((candidate) => ({
        sellerId: candidate.branch.sellerId,
        branchId: candidate.branch.id,
        storeName: candidate.branch.seller.storeName,
        city: candidate.branch.city ?? candidate.branch.seller.city ?? null,
        distanceKm: candidate.distanceKm === null ? null : Math.round(candidate.distanceKm * 100) / 100,
        hasMatchingProduct: matchingSellerIds.has(candidate.branch.sellerId),
        isOpenNow: this.sellersService.isOpenNow(candidate.branch),
      }))
      .sort((a, b) => {
        if (a.hasMatchingProduct !== b.hasMatchingProduct) return a.hasMatchingProduct ? -1 : 1;
        if (a.isOpenNow !== b.isOpenNow) return a.isOpenNow ? -1 : 1;
        return (a.distanceKm ?? 1e6) - (b.distanceKm ?? 1e6);
      });

    // اگر هیچ فروشنده‌ای محصول مرتبط نداشت، همان فهرست شهری/محدوده‌ای برگردانده می‌شود
    return scored.slice(0, maxTargets);
  }

  private async notifyTargets(request: PartRequest, targets: TargetSeller[]): Promise<void> {
    const sellerIds = [...new Set(targets.map((t) => t.sellerId))];
    const sellers = sellerIds.length ? await this.sellers.find({ where: { id: In(sellerIds) } }) : [];
    for (const seller of sellers) {
      await this.notifications
        .notify({
          userId: seller.userId,
          eventKey: 'request.broadcast',
          subjectId: request.id,
          vars: {
            id: request.id,
            title: request.titleFa,
            quantity: request.quantity,
            urgency: request.urgency,
            deadline: formatJalali(request.deadlineAt, { withTime: true }),
          },
          data: { requestId: request.id, city: request.city },
        })
        .catch((error) => this.logger.warn(`اعلان درخواست به فروشنده ناموفق بود: ${(error as Error).message}`));
    }
  }

  async listMine(userId: string, query: { status?: RequestStatus; page?: number; pageSize?: number } = {}): Promise<PageResult<PartRequest>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = { userId };
    if (query.status) where.status = query.status;
    const [items, total] = await this.requests.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async getMine(userId: string, id: string): Promise<PartRequest> {
    const request = await this.requests.findOne({ where: { id, userId } });
    if (!request) throw new NotFoundException('درخواست تأمین');
    return request;
  }

  async findById(id: string): Promise<PartRequest | null> {
    return this.requests.findOne({ where: { id } });
  }

  async cancel(userId: string, id: string, reason?: string): Promise<PartRequest> {
    const request = await this.getMine(userId, id);
    if (!['OPEN', 'QUOTED'].includes(request.status)) {
      throw new AppException('این درخواست قابل لغو نیست.', ErrorCodes.REQUEST_CLOSED, { statusCode: 409 });
    }
    request.status = 'CANCELLED';
    request.closedAt = new Date();
    request.closeReason = reason ?? 'لغو توسط کاربر';
    const saved = await this.requests.save(request);
    await this.quotes.update({ requestId: saved.id, status: 'SUBMITTED' }, { status: 'EXPIRED', decidedAt: new Date(), decisionNote: 'درخواست لغو شد' });
    return saved;
  }

  /** درخواست‌های مرتبط برای فروشنده (هدف‌گیری‌شده، هم‌شهری یا در محدوده خدمات). */
  async listForSeller(
    sellerId: string,
    query: { status?: 'open' | 'closed' | 'all'; page?: number; pageSize?: number } = {},
  ): Promise<PageResult<PartRequest & { myQuoteStatus?: string | null; hasQuoted?: boolean }>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const qb = this.requests.createQueryBuilder('req');
    if (query.status === 'open') qb.where('req.status IN (:...statuses)', { statuses: ['OPEN', 'QUOTED'] });
    else if (query.status === 'closed')
      qb.where('req.status IN (:...statuses)', { statuses: ['EXPIRED', 'UNFULFILLED', 'CONVERTED', 'CANCELLED'] });
    qb.orderBy('req.deadlineAt', 'ASC');
    const rows = await qb.getMany();

    const visible = await this.filterVisibleForSeller(rows, sellerId);
    const myQuotes = visible.length
      ? await this.quotes.find({ where: { sellerId, requestId: In(visible.map((row) => row.id)) } })
      : [];
    const quoteByRequest = new Map(myQuotes.map((quote) => [quote.requestId, quote.status]));
    const enriched = visible.map((row) => ({
      ...row,
      myQuoteStatus: quoteByRequest.get(row.id) ?? null,
      hasQuoted: quoteByRequest.has(row.id),
    }));
    return buildPage(enriched.slice(skip, skip + take), enriched.length, query.page ?? 1, query.pageSize ?? 20);
  }

  /**
   * فیلتر درخواست‌های قابل مشاهده برای یک فروشنده.
   * یک فروشنده زمانی درخواست را می‌بیند که در فهرست هدف باشد، یا در همان شهر فعالیت کند،
   * یا محل تحویل داخل شعاع خدمات یکی از شعبه‌های او باشد.
   */
  async filterVisibleForSeller(requests: PartRequest[], sellerId: string): Promise<PartRequest[]> {
    if (!requests.length) return [];
    const seller = await this.sellers.findOne({ where: { id: sellerId } });
    if (!seller) return [];
    const branches = await this.branches.find({ where: { sellerId, isActive: true } });

    return requests.filter((request) => {
      if (request.targetedSellerIds?.includes(sellerId)) return true;
      if (request.city && seller.city && request.city === seller.city) return true;
      const origin =
        request.deliverySnapshot?.lat && request.deliverySnapshot?.lng
          ? { lat: request.deliverySnapshot.lat, lng: request.deliverySnapshot.lng }
          : null;
      if (!origin) return false;
      return branches.some((branch) => {
        if (branch.lat === null || branch.lng === null) return false;
        const distance = haversineKm(origin, { lat: branch.lat, lng: branch.lng });
        return distance !== null && distance <= branch.serviceRadiusKm;
      });
    });
  }

  async isTargeted(request: PartRequest, sellerId: string): Promise<boolean> {
    const visible = await this.filterVisibleForSeller([request], sellerId);
    return visible.length > 0;
  }

  /**
   * بستن درخواست‌هایی که مهلتشان تمام شده است.
   * اگر پیشنهادی رسیده باشد → EXPIRED و اگر هیچ پیشنهادی نباشد → UNFULFILLED.
   */
  async expireDue(now = new Date()): Promise<{ expired: number; unfulfilled: number; quotesExpired: number }> {
    const due = await this.requests.find({
      where: { status: In(['OPEN', 'QUOTED']), deadlineAt: LessThan(now) },
      take: 200,
    });
    let expired = 0;
    let unfulfilled = 0;
    let quotesExpired = 0;

    for (const request of due) {
      request.quoteCount = await this.quotes.count({ where: { requestId: request.id } });
      request.status = request.quoteCount > 0 ? 'EXPIRED' : 'UNFULFILLED';
      request.closedAt = now;
      request.closeReason = request.quoteCount > 0 ? 'پایان مهلت بدون انتخاب پیشنهاد' : 'پایان مهلت بدون دریافت پیشنهاد';
      await this.requests.save(request);

      const result = await this.quotes.update(
        { requestId: request.id, status: 'SUBMITTED' },
        { status: 'EXPIRED', decidedAt: now, decisionNote: 'پایان مهلت درخواست' },
      );
      quotesExpired += result.affected ?? 0;

      if (request.quoteCount > 0) expired += 1;
      else unfulfilled += 1;

      await this.notifications
        .notify({
          userId: request.userId,
          eventKey: request.quoteCount > 0 ? 'request.expired' : 'request.unfulfilled',
          subjectId: request.id,
          vars: { title: request.titleFa, code: request.code, quoteCount: request.quoteCount },
          data: { requestId: request.id },
        })
        .catch((error) => this.logger.warn(`اعلان انقضای درخواست ناموفق بود: ${(error as Error).message}`));
    }
    if (expired || unfulfilled) this.logger.log(`${expired} درخواست منقضی و ${unfulfilled} درخواست بدون پیشنهاد بسته شد.`);
    return { expired, unfulfilled, quotesExpired };
  }

  /** پیشنهادها یک درخواست. */
  async quotesOf(requestId: string): Promise<Quote[]> {
    return this.quotes.find({ where: { requestId }, order: { createdAt: 'ASC' }, relations: { items: true } });
  }

  async countOpenForSeller(sellerId: string): Promise<number> {
    const rows = await this.requests.find({ where: { status: In(['OPEN', 'QUOTED']) }, take: 200 });
    let count = 0;
    for (const row of rows) {
      if (await this.isTargeted(row, sellerId)) count += 1;
    }
    return count;
  }

  /** میانگین زمان پاسخ فروشنده به درخواست‌ها (دقیقه) — محاسبه از داده واقعی. */
  async avgResponseMinutes(sellerId: string): Promise<number | null> {
    const quotes = await this.quotes.find({ where: { sellerId }, relations: { request: true }, take: 200 });
    const diffs = quotes
      .filter((quote) => quote.request?.createdAt)
      .map((quote) => (quote.createdAt.getTime() - quote.request.createdAt.getTime()) / 60_000)
      .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);
    if (!diffs.length) return null;
    return Math.round((diffs.reduce((acc, value) => acc + value, 0) / diffs.length) * 10) / 10;
  }

  async routeEstimate(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    return this.maps.route(from, to);
  }
}
