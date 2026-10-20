import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThan, Repository } from 'typeorm';
import { ORDER_STATUSES, formatJalali, type Actor, type OrderStatus, type PaymentStatus } from '@carpart/contract';
import type { RequestDeliverySnapshot, RequestVehicleSnapshot } from '../requests/entities/part-request.entity';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { shortCode } from '../../common/utils/id';
import type { RequestUser } from '../../common/types/auth';
import { CouponsService } from '../coupons/coupons.service';
import { Delivery } from '../delivery/entities/delivery.entity';
import { Commission } from '../finance/entities/commission.entity';
import { PricingService } from '../finance/pricing.service';
import { JobQueueService } from '../jobs/job-queue.service';
import { MapService } from '../maps/map.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Payment } from '../payments/entities/payment.entity';
import { PartRequest } from '../requests/entities/part-request.entity';
import { Quote } from '../requests/entities/quote.entity';
import { SellerBranch } from '../sellers/entities/seller-branch.entity';
import { SellerProduct } from '../sellers/entities/seller-product.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { SellerProductsService } from '../sellers/seller-products.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { WorkshopsService } from '../workshops/workshops.service';
import { CreateOrderDto } from './dto/order.dto';
import { OrderEvent } from './entities/order-event.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrderStateMachine } from './state-machine';

export interface ListOrderFilter {
  status?: OrderStatus | 'all' | 'active';
  page?: number;
  pageSize?: number;
  search?: string;
  from?: string;
  to?: string;
}

export interface OrderWithDetails extends Order {
  items: OrderItem[];
  events?: OrderEvent[];
  delivery?: Delivery | null;
  allowedActions?: Array<{ to: OrderStatus; fa: string; requiresReason: boolean }>;
  breakdown?: Array<{ fa: string; amount: number }>;
}

interface PricedLine {
  sellerProductId: string | null;
  partId: string | null;
  nameFa: string;
  sku: string | null;
  technicalCode: string | null;
  brandName: string | null;
  quality: OrderItem['quality'];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl: string | null;
  snapshot: Record<string, unknown>;
}

/**
 * سرویس سفارش — تنها مرجع ایجاد و تغییر وضعیت سفارش.
 *
 * قواعد کلیدی:
 * - قیمت واحد همیشه از پایگاه‌داده خوانده می‌شود؛ ورودی مشتری هرگز منبع قیمت نیست.
 * - موجودی هنگام ثبت سفارش به‌صورت اتمیک رزرو و پس از پرداخت قطعی می‌شود.
 * - تغییر وضعیت فقط از طریق ماشین وضعیت و با گاردهای سمت سرور انجام می‌شود.
 * - هر سفارش یک فروشنده و یک شعبه دارد (محدودیت مستند نسخه جاری).
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly items: Repository<OrderItem>,
    @InjectRepository(OrderEvent) private readonly events: Repository<OrderEvent>,
    @InjectRepository(SellerProduct) private readonly products: Repository<SellerProduct>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(SellerBranch) private readonly branches: Repository<SellerBranch>,
    @InjectRepository(Quote) private readonly quotes: Repository<Quote>,
    @InjectRepository(PartRequest) private readonly requests: Repository<PartRequest>,
    @InjectRepository(Commission) private readonly commissions: Repository<Commission>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Delivery) private readonly deliveries: Repository<Delivery>,
    private readonly stateMachine: OrderStateMachine,
    private readonly pricing: PricingService,
    private readonly coupons: CouponsService,
    private readonly sellerProducts: SellerProductsService,
    private readonly workshops: WorkshopsService,
    private readonly maps: MapService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobQueueService,
    private readonly settings: SystemSettingsService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*                            ساخت سفارش                              */
  /* ------------------------------------------------------------------ */

  /** خرید مستقیم از کاتالوگ. */
  async createDirect(userId: string, dto: CreateOrderDto, idempotencyKey?: string | null): Promise<OrderWithDetails> {
    if (idempotencyKey) {
      const existing = await this.orders.findOne({ where: { idempotencyKey } });
      if (existing) return this.detailForUser(userId, existing.id);
    }

    const workshop = await this.workshops.requireWorkshop(userId);
    const address = dto.deliveryAddressId
      ? await this.workshops.findAddress(userId, dto.deliveryAddressId)
      : ((await this.workshops.listAddresses(userId)).find((a) => a.isDefault) ?? (await this.workshops.listAddresses(userId))[0] ?? null);

    const lines = await this.buildLinesFromProducts(dto.items);
    const seller = await this.requireSingleSeller(lines);
    const branch = await this.branches.findOne({ where: { id: lines[0].snapshot.branchId as string } });
    if (!branch) throw new NotFoundException('شعبه فروشنده');

    const deliverySnapshot = this.buildDeliverySnapshot(workshop, address);
    if (!deliverySnapshot || (deliverySnapshot.lat === null && !deliverySnapshot.addressText)) {
      throw new AppException(
        'برای ثبت سفارش، یک آدرس تحویل با موقعیت یا متن آدرس کامل لازم است.',
        ErrorCodes.PROFILE_INCOMPLETE,
        { statusCode: 409 },
      );
    }
    const vehicleSnapshot = dto.vehicleId ? await this.vehicleSnapshot(userId, dto.vehicleId) : null;

    const order = await this.persistOrder({
      userId,
      source: 'direct',
      seller,
      branch,
      lines,
      deliverySnapshot,
      vehicleSnapshot,
      addressId: address?.id ?? null,
      city: deliverySnapshot.city ?? workshop.city,
      urgency: dto.urgency ?? 'normal',
      couponCode: dto.couponCode ?? null,
      notes: dto.notes ?? null,
      status: dto.saveAsDraft ? 'DRAFT' : 'WAITING_FOR_PAYMENT',
      idempotencyKey: idempotencyKey ?? null,
      workshopId: workshop.id,
    });

    if (dto.saveAsDraft) {
      await this.recordEvent(order, null, 'DRAFT', 'ثبت پیش‌نویس سفارش', userId, 'mechanic');
      return this.detailForUser(userId, order.id);
    }

    try {
      await this.reserveStock(order, lines, userId);
    } catch (error) {
      // در صورت شکست رزرو موجودی، سفارش ناقص پاک می‌شود تا داده ناسازگار نماند
      await this.items.delete({ orderId: order.id });
      await this.orders.delete({ id: order.id });
      throw error;
    }

    await this.afterOrderCreated(order, userId);
    return this.detailForUser(userId, order.id);
  }

  /** تبدیل پیش‌نویس به سفارش قابل پرداخت (محاسبه دوباره قیمت و رزرو موجودی). */
  async checkout(userId: string, orderId: string, idempotencyKey?: string | null): Promise<OrderWithDetails> {
    const order = await this.loadOrder(orderId);
    this.assertReadAccess(order, userId, null);
    if (order.status !== 'DRAFT') {
      throw new AppException('فقط سفارش پیش‌نویس قابل ثبت نهایی است.', ErrorCodes.ORDER_NOT_EDITABLE, { statusCode: 409 });
    }
    const items = await this.items.find({ where: { orderId } });
    const lines = await this.buildLinesFromProducts(
      items
        .filter((item) => item.sellerProductId)
        .map((item) => ({ sellerProductId: item.sellerProductId as string, quantity: item.quantity })),
    );
    const seller = await this.requireSingleSeller(lines);
    const branch = await this.branches.findOne({ where: { id: lines[0].snapshot.branchId as string } });
    if (!branch) throw new NotFoundException('شعبه فروشنده');

    await this.items.delete({ orderId });
    await this.reprice(order, lines, seller, branch);
    await this.items.save(lines.map((line) => this.items.create({ orderId, ...line })));
    await this.reserveStock(order, lines, userId);
    if (idempotencyKey && !order.idempotencyKey) order.idempotencyKey = idempotencyKey;
    await this.stateMachine.assertAllowed(order.status, 'WAITING_FOR_PAYMENT', 'mechanic');
    await this.applyTransition(order, 'WAITING_FOR_PAYMENT', 'mechanic', userId, 'ثبت نهایی سفارش', null);
    await this.schedulePaymentExpiry(order);
    return this.detailForUser(userId, order.id);
  }

  /** ساخت سفارش از یک پیشنهاد پذیرفته‌شده. */
  async createFromQuote(
    userId: string,
    quoteId: string,
    options: { deliveryAddressId?: string; couponCode?: string; notes?: string } = {},
    idempotencyKey?: string | null,
  ): Promise<OrderWithDetails> {
    if (idempotencyKey) {
      const existing = await this.orders.findOne({ where: { idempotencyKey } });
      if (existing) return this.detailForUser(userId, existing.id);
    }

    const quote = await this.quotes.findOne({ where: { id: quoteId }, relations: { items: true, request: true } });
    if (!quote) throw new NotFoundException('پیشنهاد');
    const request = quote.request ?? (await this.requests.findOne({ where: { id: quote.requestId } }));
    if (!request) throw new NotFoundException('درخواست تأمین');
    if (request.userId !== userId) {
      throw new AppException('این پیشنهاد متعلق به شما نیست.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    if (!['OPEN', 'QUOTED'].includes(request.status)) {
      throw new AppException('این درخواست بسته شده است و امکان پذیرش پیشنهاد وجود ندارد.', ErrorCodes.REQUEST_CLOSED, { statusCode: 409 });
    }
    if (quote.status !== 'SUBMITTED') {
      throw new AppException('این پیشنهاد پیش‌تر تعیین تکلیف شده است.', ErrorCodes.QUOTE_EXPIRED, { statusCode: 409 });
    }
    if (quote.validUntil && quote.validUntil < new Date()) {
      throw new AppException('مهلت اعتبار این پیشنهاد به پایان رسیده است.', ErrorCodes.QUOTE_EXPIRED, { statusCode: 409 });
    }

    const seller = await this.sellers.findOne({ where: { id: quote.sellerId } });
    if (!seller || !seller.isActive || seller.verificationStatus !== 'APPROVED') {
      throw new AppException('فروشگاه این پیشنهاد در وضعیت قابل خرید نیست.', ErrorCodes.ACCOUNT_NOT_VERIFIED, { statusCode: 403 });
    }
    const branch = await this.branches.findOne({ where: { id: quote.branchId } });
    if (!branch) throw new NotFoundException('شعبه فروشنده');

    const lines = await this.buildLinesFromQuoteItems(quote);
    const workshop = await this.workshops.findByUserId(userId);
    const address = options.deliveryAddressId ? await this.workshops.findAddress(userId, options.deliveryAddressId) : null;
    const deliverySnapshot = address
      ? this.buildDeliverySnapshot(workshop, address)
      : ((request.deliverySnapshot as RequestDeliverySnapshot) ?? this.buildDeliverySnapshot(workshop, null));
    if (!deliverySnapshot) {
      throw new AppException('آدرس تحویل برای این سفارش یافت نشد.', ErrorCodes.PROFILE_INCOMPLETE, { statusCode: 409 });
    }

    const order = await this.persistOrder({
      userId,
      source: 'request',
      requestId: request.id,
      quoteId: quote.id,
      seller,
      branch,
      lines,
      deliverySnapshot,
      vehicleSnapshot: (request.vehicleSnapshot as RequestVehicleSnapshot | null) ?? null,
      addressId: address?.id ?? request.deliveryAddressId ?? null,
      city: deliverySnapshot.city ?? request.city,
      urgency: request.urgency,
      couponCode: options.couponCode ?? null,
      notes: options.notes ?? request.description ?? null,
      status: 'WAITING_FOR_PAYMENT',
      idempotencyKey: idempotencyKey ?? null,
      workshopId: workshop?.id ?? null,
      quotedDeliveryFee: quote.deliveryFee,
      preparationMinutes: quote.preparationMinutes,
    });

    await this.reserveStock(order, lines, userId);
    await this.afterOrderCreated(order, userId);

    // تعیین تکلیف پیشنهادها
    quote.status = 'CONVERTED';
    quote.convertedOrderId = order.id;
    quote.decidedAt = new Date();
    quote.decisionNote = 'پذیرش توسط مکانیک و تبدیل به سفارش';
    await this.quotes.save(quote);
    await this.quotes.update(
      { requestId: request.id, status: 'SUBMITTED' },
      { status: 'DECLINED', decidedAt: new Date(), decisionNote: 'پیشنهاد دیگری انتخاب شد' },
    );
    request.status = 'CONVERTED';
    request.convertedOrderId = order.id;
    request.closedAt = new Date();
    await this.requests.save(request);

    await this.notifications.notify({
      userId: seller.userId,
      eventKey: 'quote.accepted',
      subjectId: quote.id,
      vars: { title: request.titleFa, orderCode: order.code, orderId: order.id },
      data: { orderId: order.id },
    });
    const declinedQuotes = await this.quotes.find({ where: { requestId: request.id, status: 'DECLINED' } });
    const declinedSellerIds = [...new Set(declinedQuotes.map((item) => item.sellerId))];
    const declinedSellers = declinedSellerIds.length ? await this.sellers.find({ where: { id: In(declinedSellerIds) } }) : [];
    for (const declinedSeller of declinedSellers) {
      await this.notifications
        .notify({
          userId: declinedSeller.userId,
          eventKey: 'quote.declined',
          subjectId: request.id,
          vars: { title: request.titleFa },
        })
        .catch(() => undefined);
    }

    return this.detailForUser(userId, order.id);
  }

  /* ------------------------------------------------------------------ */
  /*                         اجزای ساخت سفارش                           */
  /* ------------------------------------------------------------------ */

  private async buildLinesFromProducts(inputs: Array<{ sellerProductId: string; quantity: number }>): Promise<PricedLine[]> {
    if (!inputs.length) throw new AppException('حداقل یک قلم کالا لازم است.', ErrorCodes.VALIDATION_FAILED);
    const ids = [...new Set(inputs.map((input) => input.sellerProductId))];
    const products = await this.products.find({
      where: { id: In(ids) },
      relations: { part: { brand: true, category: true }, branch: true, seller: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    const lines: PricedLine[] = [];

    for (const input of inputs) {
      const product = byId.get(input.sellerProductId);
      if (!product) throw new NotFoundException(`محصول ${input.sellerProductId}`);
      if (!product.isActive) {
        throw new AppException(`«${product.part.nameFa}» در حال حاضر غیرفعال است.`, ErrorCodes.PRODUCT_INACTIVE, { statusCode: 409 });
      }
      if (product.availableStock < input.quantity) {
        throw new AppException(
          `موجودی «${product.part.nameFa}» کافی نیست (موجودی قابل فروش: ${product.availableStock}).`,
          ErrorCodes.INSUFFICIENT_STOCK,
          { statusCode: 409, details: { sellerProductId: product.id } },
        );
      }
      lines.push({
        sellerProductId: product.id,
        partId: product.partId,
        nameFa: product.part.nameFa,
        sku: product.sku,
        technicalCode: product.part.technicalCode,
        brandName: product.part.brand?.nameFa ?? null,
        quality: product.quality,
        quantity: input.quantity,
        // قیمت واحد فقط از پایگاه‌داده — مقدار ارسالی کاربر نادیده گرفته می‌شود
        unitPrice: product.price,
        lineTotal: product.price * input.quantity,
        imageUrl: (product.images?.[0] ?? product.part.images?.[0] ?? null) as string | null,
        snapshot: {
          branchId: product.branchId,
          sellerId: product.sellerId,
          storeName: product.seller?.storeName ?? null,
          listPrice: product.listPrice,
          warrantyNote: product.warrantyNote,
          returnWindowDays: product.returnWindowDays,
          preparationMinutes: product.preparationMinutes,
          availableStockAtOrder: product.availableStock,
        },
      });
    }
    return lines;
  }

  private async buildLinesFromQuoteItems(quote: Quote): Promise<PricedLine[]> {
    const productIds = quote.items.map((item) => item.sellerProductId).filter((id): id is string => Boolean(id));
    const products = productIds.length
      ? await this.products.find({ where: { id: In(productIds) }, relations: { part: { brand: true }, branch: true, seller: true } })
      : [];
    const byId = new Map(products.map((product) => [product.id, product]));

    return quote.items.map((item) => {
      const product = item.sellerProductId ? byId.get(item.sellerProductId) : undefined;
      return {
        sellerProductId: item.sellerProductId,
        partId: item.partId ?? product?.partId ?? null,
        nameFa: item.nameFa || product?.part.nameFa || 'قطعه',
        sku: item.sku ?? product?.sku ?? null,
        technicalCode: product?.part.technicalCode ?? null,
        brandName: product?.part.brand?.nameFa ?? null,
        quality: item.quality,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.quantity,
        imageUrl: (product?.images?.[0] ?? product?.part.images?.[0] ?? null) as string | null,
        snapshot: {
          branchId: quote.branchId,
          sellerId: quote.sellerId,
          quoteItemId: item.id,
          isSubstitute: item.isSubstitute,
          note: item.note ?? null,
        },
      };
    });
  }

  private async requireSingleSeller(lines: PricedLine[]): Promise<Seller> {
    const sellerIds = [...new Set(lines.map((line) => line.snapshot.sellerId as string))];
    if (sellerIds.length !== 1) {
      throw new AppException(
        'در نسخه جاری هر سفارش فقط از یک فروشگاه تأمین می‌شود. لطفاً اقلام هر فروشگاه را در سفارش جداگانه ثبت کنید.',
        ErrorCodes.ORDER_MULTI_SELLER_NOT_SUPPORTED,
        { statusCode: 409, details: { sellerCount: sellerIds.length } },
      );
    }
    const seller = await this.sellers.findOne({ where: { id: sellerIds[0] } });
    if (!seller) throw new NotFoundException('فروشگاه');
    if (!seller.isActive || seller.verificationStatus !== 'APPROVED') {
      throw new AppException('فروشگاه این اقلام در وضعیت قابل خرید نیست.', ErrorCodes.ACCOUNT_NOT_VERIFIED, { statusCode: 403 });
    }
    return seller;
  }

  private buildDeliverySnapshot(workshop: Awaited<ReturnType<WorkshopsService['findByUserId']>>, address: Awaited<ReturnType<WorkshopsService['findAddress']>> | null): RequestDeliverySnapshot | null {
    if (address) {
      return {
        receiverName: address.receiverName,
        phone: address.phone,
        city: address.city ?? workshop?.city ?? null,
        addressText: address.addressText,
        lat: address.lat ?? workshop?.lat ?? null,
        lng: address.lng ?? workshop?.lng ?? null,
      };
    }
    if (!workshop) return null;
    if (workshop.lat === null || workshop.lng === null) {
      if (!workshop.addressText) return null;
    }
    return {
      receiverName: workshop.ownerName ?? workshop.name,
      phone: workshop.phone ?? '',
      city: workshop.city,
      addressText: workshop.addressText ?? '',
      lat: workshop.lat,
      lng: workshop.lng,
    };
  }

  private async vehicleSnapshot(userId: string, vehicleId: string): Promise<RequestVehicleSnapshot | null> {
    const vehicles = await this.workshops.listVehicles(userId);
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) return null;
    return {
      makeName: vehicle.model?.make?.nameFa ?? vehicle.freeMakeName ?? null,
      modelName: vehicle.model?.nameFa ?? vehicle.freeModelName ?? null,
      variantName: vehicle.variant?.nameFa ?? null,
      year: vehicle.yearFrom ?? null,
      engine: vehicle.engine ?? null,
      plate: vehicle.plate ?? null,
      vin: vehicle.vin ?? null,
    };
  }

  private async persistOrder(input: {
    userId: string;
    source: 'direct' | 'request';
    requestId?: string | null;
    quoteId?: string | null;
    seller: Seller;
    branch: SellerBranch;
    lines: PricedLine[];
    deliverySnapshot: RequestDeliverySnapshot | null;
    vehicleSnapshot: RequestVehicleSnapshot | null;
    addressId: string | null;
    city: string | null;
    urgency: Order['urgency'];
    couponCode: string | null;
    notes: string | null;
    status: OrderStatus;
    idempotencyKey: string | null;
    workshopId: string | null;
    quotedDeliveryFee?: number | null;
    preparationMinutes?: number | null;
  }): Promise<Order> {
    const order = this.orders.create({
      code: shortCode(8, 'ORD'),
      userId: input.userId,
      workshopId: input.workshopId,
      sellerId: input.seller.id,
      branchId: input.branch.id,
      status: input.status,
      requestId: input.requestId ?? null,
      quoteId: input.quoteId ?? null,
      source: input.source,
      city: input.city,
      currency: 'IRT',
      deliveryAddressId: input.addressId,
      addressSnapshot: input.deliverySnapshot,
      vehicleSnapshot: input.vehicleSnapshot,
      urgency: input.urgency,
      notes: input.notes,
      couponCode: input.couponCode,
      idempotencyKey: input.idempotencyKey,
      createdBy: input.userId,
      paymentStatus: null,
    });
    await this.reprice(order, input.lines, input.seller, input.branch, {
      quotedDeliveryFee: input.quotedDeliveryFee ?? null,
      preparationMinutes: input.preparationMinutes ?? null,
    });
    const saved = await this.orders.save(order);
    await this.items.save(input.lines.map((line) => this.items.create({ orderId: saved.id, ...line })));
    return saved;
  }

  /** محاسبه مبلغ اقلام، ارسال، تخفیف، کارمزد و مبلغ قابل پرداخت. */
  private async reprice(
    order: Order,
    lines: PricedLine[],
    seller: Seller,
    branch: SellerBranch,
    overrides: { quotedDeliveryFee?: number | null; preparationMinutes?: number | null } = {},
  ): Promise<void> {
    const itemsSubtotal = lines.reduce((acc, line) => acc + line.lineTotal, 0);
    const destination = order.addressSnapshot?.lat && order.addressSnapshot?.lng
      ? { lat: order.addressSnapshot.lat, lng: order.addressSnapshot.lng }
      : null;
    const origin = branch.lat !== null && branch.lng !== null ? { lat: branch.lat, lng: branch.lng } : null;
    const route = await this.maps.route(origin, destination);

    const delivery = await this.pricing.estimateDeliveryFee({
      distanceKm: route?.distanceKm ?? null,
      urgency: order.urgency,
      itemsTotal: itemsSubtotal,
    });
    const deliveryFee = overrides.quotedDeliveryFee ?? delivery.total;

    let discountTotal = 0;
    let couponId: string | null = null;
    if (order.couponCode) {
      const validated = await this.coupons.validate(order.couponCode, order.userId, itemsSubtotal, { city: order.city });
      discountTotal = validated.discount;
      couponId = validated.coupon.id;
      order.couponCode = validated.coupon.code;
    }
    order.couponId = couponId;

    const commission = await this.pricing.calculateCommission({
      itemsTotal: itemsSubtotal,
      discountTotal,
      deliveryFee,
      ratePercent: await this.pricing.commissionRatePercent(seller.commissionPercent),
      courierSharePercent: await this.pricing.courierSharePercent(),
    });
    const payable = this.pricing.payableBreakdown({ itemsSubtotal, deliveryFee, discountTotal });

    order.itemsSubtotal = itemsSubtotal;
    order.deliveryFee = deliveryFee;
    order.discountTotal = discountTotal;
    order.platformFee = commission.platformAmount;
    order.payableTotal = payable.payable;

    const preparationMinutes =
      overrides.preparationMinutes ?? Math.max(branch.prepTimeMinutes, ...lines.map((line) => Number(line.snapshot.preparationMinutes ?? 0)), 0);
    const now = Date.now();
    order.expectedReadyAt = new Date(now + preparationMinutes * 60_000);
    order.expectedDeliveryAt = route
      ? new Date(order.expectedReadyAt.getTime() + route.durationMinutes * 60_000)
      : null;
  }

  private async reserveStock(order: Order, lines: PricedLine[], actorId: string | null): Promise<void> {
    const stockLines = lines
      .filter((line) => line.sellerProductId)
      .map((line) => ({ sellerProductId: line.sellerProductId as string, quantity: line.quantity }));
    if (!stockLines.length) return;
    await this.sellerProducts.reserve(stockLines, order.id, actorId);
  }

  private async afterOrderCreated(order: Order, userId: string): Promise<void> {
    await this.recordEvent(order, null, order.status, 'ثبت سفارش', userId, 'mechanic');
    if (order.couponId) {
      await this.coupons.redeem(order.couponId, order.userId, order.id, order.discountTotal);
    }
    await this.schedulePaymentExpiry(order);
    const seller = await this.sellers.findOne({ where: { id: order.sellerId } });
    if (seller) {
      await this.notifications.notify({
        userId: seller.userId,
        eventKey: 'order.created',
        subjectId: order.id,
        vars: { code: order.code, orderId: order.id, total: order.payableTotal },
        moneyVars: ['total'],
        data: { orderId: order.id },
      });
    }
    await this.notifications.notify({
      userId,
      eventKey: 'order.created',
      subjectId: order.id,
      vars: { code: order.code, orderId: order.id, total: order.payableTotal },
      moneyVars: ['total'],
      data: { orderId: order.id },
      dedupeKey: `order.created.owner:${order.id}`,
    });
  }

  private async schedulePaymentExpiry(order: Order): Promise<void> {
    const minutes = await this.settings.getNumber('order.payment_expire_minutes', 15);
    await this.jobs.enqueue(
      'order.payment_expire',
      { orderId: order.id },
      { dedupeKey: `payment-expire:${order.id}`, runAt: new Date(Date.now() + minutes * 60_000), maxAttempts: 3 },
    );
  }

  /* ------------------------------------------------------------------ */
  /*                         خواندن و دسترسی                           */
  /* ------------------------------------------------------------------ */

  async loadOrder(orderId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('سفارش');
    return order;
  }

  /** تعیین نقش انجام‌دهنده نسبت به این سفارش. */
  async actorFor(order: Order, user: RequestUser | null): Promise<Actor> {
    if (!user) return 'system';
    if (user.roles.includes('admin')) return 'admin';
    if (user.roles.includes('operator')) return 'operator';
    if (user.id === order.userId) return 'mechanic';
    if (user.profileKind === 'seller' && user.profileId === order.sellerId) return 'seller';
    if (user.profileKind === 'courier') {
      const delivery = await this.deliveries.findOne({ where: { orderId: order.id } });
      if (delivery && delivery.courierId === user.profileId) return 'courier';
    }
    throw new AppException('شما به این سفارش دسترسی ندارید.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
  }

  assertReadAccess(order: Order, userId: string | null, user: RequestUser | null): void {
    if (user && (user.roles.includes('admin') || user.roles.includes('operator'))) return;
    if (userId && order.userId === userId) return;
    if (user && user.profileKind === 'seller' && user.profileId === order.sellerId) return;
    throw new AppException('شما به این سفارش دسترسی ندارید.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
  }

  async detailForUser(userId: string, orderId: string): Promise<OrderWithDetails> {
    const order = await this.loadOrder(orderId);
    this.assertReadAccess(order, userId, null);
    return this.decorate(order, 'mechanic');
  }

  async detail(orderId: string, user: RequestUser | null): Promise<OrderWithDetails> {
    const order = await this.loadOrder(orderId);
    const actor = await this.actorFor(order, user);
    return this.decorate(order, actor);
  }

  private async decorate(order: Order, actor: Actor): Promise<OrderWithDetails> {
    const items = await this.items.find({ where: { orderId: order.id } });
    const delivery = await this.deliveries.findOne({ where: { orderId: order.id } });
    const fee = await this.pricing.estimateDeliveryFee({ distanceKm: delivery?.distanceKm ?? null, urgency: order.urgency, itemsTotal: order.itemsSubtotal });
    return {
      ...order,
      items,
      delivery: delivery ?? null,
      allowedActions: this.stateMachine.allowedActions(order.status, actor),
      breakdown: [
        { fa: 'مبلغ اقلام', amount: order.itemsSubtotal },
        { fa: 'هزینه ارسال', amount: order.deliveryFee },
        ...(order.discountTotal > 0 ? [{ fa: 'تخفیف', amount: -order.discountTotal }] : []),
        { fa: 'مبلغ قابل پرداخت', amount: order.payableTotal },
        { fa: `منبع محاسبه ارسال: ${fee.distanceKm === null ? 'تخمین بدون مسافت' : 'مسافت مسیر'}`, amount: 0 },
      ],
    };
  }

  async listMine(
    userId: string,
    query: ListOrderFilter = {},
  ): Promise<PageResult<Order>> {
    return this.listOrders({ userId, ...query });
  }

  async listForSeller(sellerId: string, query: ListOrderFilter = {}): Promise<PageResult<Order>> {
    return this.listOrders({ sellerId, ...query });
  }

  async listAll(query: ListOrderFilter & { sellerId?: string } = {}): Promise<PageResult<Order>> {
    return this.listOrders(query);
  }

  private async listOrders(filter: {
    userId?: string;
    sellerId?: string;
    status?: OrderStatus | 'all' | 'active';
    page?: number;
    pageSize?: number;
    search?: string;
    from?: string;
    to?: string;
  }): Promise<PageResult<Order>> {
    const { skip, take } = toSkipTake(filter.page, filter.pageSize);
    const qb = this.orders.createQueryBuilder('order');
    if (filter.userId) qb.andWhere('order.userId = :userId', { userId: filter.userId });
    if (filter.sellerId) qb.andWhere('order.sellerId = :sellerId', { sellerId: filter.sellerId });
    if (filter.status && filter.status !== 'all') {
      if (filter.status === 'active') {
        qb.andWhere('order.status NOT IN (:...finals)', { finals: ['CANCELLED', 'REFUNDED', 'COMPLETED'] });
      } else {
        qb.andWhere('order.status = :status', { status: filter.status });
      }
    }
    if (filter.search) {
      qb.andWhere('(order.code LIKE :q OR order.city LIKE :q)', { q: `%${filter.search}%` });
    }
    if (filter.from) qb.andWhere('order.createdAt >= :from', { from: new Date(filter.from) });
    if (filter.to) qb.andWhere('order.createdAt <= :to', { to: new Date(filter.to) });
    qb.orderBy('order.createdAt', 'DESC').skip(skip).take(take);
    const [items, total] = await qb.getManyAndCount();
    return buildPage(items, total, filter.page ?? 1, filter.pageSize ?? 20);
  }

  async orderEvents(orderId: string, user: RequestUser | null): Promise<OrderEvent[]> {
    const order = await this.loadOrder(orderId);
    await this.actorFor(order, user);
    return this.events.find({ where: { orderId }, order: { createdAt: 'ASC' } });
  }

  /* ------------------------------------------------------------------ */
  /*                        تغییر وضعیت سفارش                           */
  /* ------------------------------------------------------------------ */

  /** تغییر وضعیت توسط کاربر (با بررسی نقش و گاردها). */
  async transition(orderId: string, to: OrderStatus, user: RequestUser, reason?: string): Promise<OrderWithDetails> {
    const order = await this.loadOrder(orderId);
    const actor = await this.actorFor(order, user);
    const transition = this.stateMachine.assertAllowed(order.status, to, actor);
    if (transition.requiresReason && !reason?.trim()) {
      throw new AppException('برای این تغییر وضعیت، ثبت دلیل الزامی است.', ErrorCodes.VALIDATION_FAILED);
    }
    await this.stateMachine.runGuards(transition, { order, actor, user, reason });
    await this.applyTransition(order, to, actor, user.id, transition.fa, reason ?? null);
    await this.afterTransition(order, to, actor, user);
    return this.decorate(order, actor);
  }

  /** تغییر وضعیت توسط سامانه (پرداخت، زمان‌بندی، مأموریت ارسال). */
  async systemTransition(
    orderId: string,
    to: OrderStatus,
    faDescription: string,
    meta?: Record<string, unknown>,
    reason?: string,
  ): Promise<Order> {
    const order = await this.loadOrder(orderId);
    const transition = this.stateMachine.assertAllowed(order.status, to, 'system');
    await this.stateMachine.runGuards(transition, { order, actor: 'system', meta });
    await this.applyTransition(order, to, 'system', null, faDescription, reason ?? null, meta);
    await this.afterTransition(order, to, 'system', null);
    return order;
  }

  private async applyTransition(
    order: Order,
    to: OrderStatus,
    actor: Actor,
    actorId: string | null,
    faDescription: string,
    reason: string | null,
    metadata?: Record<string, unknown> | null,
  ): Promise<void> {
    const from = order.status;
    order.status = to;
    const now = new Date();
    if (to === 'CANCELLED') {
      order.cancelledAt = now;
      order.cancelReason = reason ?? faDescription;
      order.cancelActor = actor;
    }
    if (to === 'DELIVERED') order.deliveredAt = now;
    if (to === 'COMPLETED') order.completedAt = now;
    await this.orders.save(order);
    await this.recordEvent(order, from, to, faDescription, actorId, actor, reason, metadata);
  }

  private async recordEvent(
    order: Order,
    from: OrderStatus | null,
    to: OrderStatus | null,
    faDescription: string,
    actorId: string | null,
    actor: Actor,
    reason?: string | null,
    metadata?: Record<string, unknown> | null,
  ): Promise<void> {
    await this.events.save(
      this.events.create({
        orderId: order.id,
        fromStatus: from,
        toStatus: to,
        action: to ? `status:${to}` : 'info',
        faDescription,
        actorId,
        actorRole: actor === 'system' ? 'system' : actor,
        actorType: actor === 'admin' || actor === 'operator' ? 'admin' : actor === 'system' ? 'system' : 'user',
        reason: reason ?? null,
        metadata: metadata ?? null,
      }),
    );
  }

  /** اثرات جانبی پس از تغییر وضعیت. */
  private async afterTransition(order: Order, to: OrderStatus, actor: Actor, user: RequestUser | null): Promise<void> {
    switch (to) {
      case 'PAID':
        await this.onPaid(order);
        break;
      case 'SELLER_CONFIRMED':
        await this.notifyOwner(order, 'order.confirmed', { code: order.code, orderId: order.id });
        break;
      case 'PREPARING':
        await this.notifyOwner(order, 'order.preparing', {
          code: order.code,
          orderId: order.id,
          eta: order.expectedReadyAt ? formatJalali(order.expectedReadyAt, { withTime: true }) : 'نامشخص',
        });
        break;
      case 'READY_FOR_PICKUP':
        await this.onReady(order);
        break;
      case 'DELIVERED':
        await this.onDelivered(order);
        break;
      case 'COMPLETED':
        await this.onCompleted(order);
        break;
      case 'CANCELLED':
        await this.onCancelled(order, order.cancelReason ?? 'لغو سفارش', actor);
        break;
      case 'WAITING_FOR_COURIER':
        await this.jobs.enqueue('delivery.assign', { orderId: order.id }, { dedupeKey: `delivery-assign:${order.id}`, maxAttempts: 6 });
        break;
      default:
        break;
    }
  }

  /** ثبت پرداخت موفق: قطعی‌کردن موجودی، ثبت کارمزد و ایجاد مأموریت ارسال. */
  async markPaid(orderId: string, payment: Payment): Promise<Order> {
    const order = await this.loadOrder(orderId);
    if (order.paymentStatus === 'SUCCESS') return order;
    order.paymentId = payment.id;
    order.paymentStatus = payment.status as PaymentStatus;
    order.paidAt = payment.paidAt ?? new Date();
    await this.orders.save(order);
    if (order.status !== 'WAITING_FOR_PAYMENT' && order.status !== 'PAYMENT_FAILED') return order;
    if (order.status === 'PAYMENT_FAILED') {
      await this.systemTransition(order.id, 'WAITING_FOR_PAYMENT', 'بازگشت به انتظار پرداخت پس از موفقیت تراکنش');
    }
    await this.systemTransition(order.id, 'PAID', 'ثبت پرداخت موفق', { paymentId: payment.id, mode: payment.mode });
    return this.loadOrder(orderId);
  }

  private async onPaid(order: Order): Promise<void> {
    const items = await this.items.find({ where: { orderId: order.id } });
    await this.sellerProducts.commit(
      items.filter((item) => item.sellerProductId).map((item) => ({ sellerProductId: item.sellerProductId as string, quantity: item.quantity })),
      order.id,
    );

    const seller = await this.sellers.findOne({ where: { id: order.sellerId } });
    const commission = await this.pricing.calculateCommission({
      itemsTotal: order.itemsSubtotal,
      discountTotal: order.discountTotal,
      deliveryFee: order.deliveryFee,
      ratePercent: await this.pricing.commissionRatePercent(seller?.commissionPercent),
      courierSharePercent: await this.pricing.courierSharePercent(),
    });
    const existing = await this.commissions.findOne({ where: { orderId: order.id } });
    if (!existing) {
      await this.commissions.save(
        this.commissions.create({
          orderId: order.id,
          sellerId: order.sellerId,
          branchId: order.branchId,
          itemsTotal: order.itemsSubtotal,
          discountTotal: order.discountTotal,
          deliveryFee: order.deliveryFee,
          commissionBase: commission.commissionBase,
          ratePercent: commission.ratePercent,
          platformAmount: commission.platformAmount,
          sellerNetAmount: commission.sellerNetAmount,
          courierAmount: commission.courierAmount,
          deliveryPlatformAmount: commission.deliveryPlatformAmount,
          status: 'recorded',
          calculation: commission.calculation,
        }),
      );
    }

    await this.notifyOwner(order, 'order.paid', { code: order.code, orderId: order.id, mode: order.paymentStatus ?? 'online' });
    if (seller) {
      await this.notifications.notify({
        userId: seller.userId,
        eventKey: 'order.paid',
        subjectId: order.id,
        vars: { code: order.code, orderId: order.id, mode: 'پرداخت آنلاین' },
        data: { orderId: order.id },
        dedupeKey: `order.paid.seller:${order.id}`,
      });
    }
    const prepTimeout = await this.settings.getNumber('order.preparation_timeout_minutes', 120);
    await this.jobs.enqueue(
      'order.seller_timeout',
      { orderId: order.id },
      { dedupeKey: `seller-timeout:${order.id}`, runAt: new Date(Date.now() + prepTimeout * 60_000), maxAttempts: 3 },
    );
  }

  private async onReady(order: Order): Promise<void> {
    await this.notifyOwner(order, 'order.ready', { code: order.code, orderId: order.id });
    // ایجاد مأموریت ارسال و سپس رفتن به وضعیت انتظار پیک (بدون وابستگی حلقوی بین ماژول‌ها)
    await this.jobs.enqueue('delivery.create_from_order', { orderId: order.id }, { dedupeKey: `delivery-create:${order.id}`, maxAttempts: 5 });
    await this.systemTransition(order.id, 'WAITING_FOR_COURIER', 'ثبت درخواست پیک توسط سامانه');
  }

  private async onDelivered(order: Order): Promise<void> {
    const days = await this.settings.getNumber('order.refund_window_days', 3);
    await this.notifyOwner(order, 'order.delivered', { code: order.code, orderId: order.id, refundWindow: days });
    const autoHours = await this.settings.getNumber('order.auto_complete_hours', 48);
    await this.jobs.enqueue(
      'order.auto_complete',
      { orderId: order.id },
      { dedupeKey: `auto-complete:${order.id}`, runAt: new Date(Date.now() + autoHours * 3_600_000), maxAttempts: 3 },
    );
  }

  private async onCompleted(order: Order): Promise<void> {
    await this.notifyOwner(order, 'order.completed', { code: order.code, orderId: order.id });
    const seller = await this.sellers.findOne({ where: { id: order.sellerId } });
    if (seller) {
      seller.completedOrders += 1;
      await this.sellers.save(seller);
    }
  }

  private async onCancelled(order: Order, reason: string, actor: Actor): Promise<void> {
    const items = await this.items.find({ where: { orderId: order.id } });
    if (!order.paidAt) {
      await this.sellerProducts.release(
        items.filter((item) => item.sellerProductId).map((item) => ({ sellerProductId: item.sellerProductId as string, quantity: item.quantity })),
        order.id,
      );
    }
    if (order.couponId) await this.coupons.reverse(order.id);
    const commission = await this.commissions.findOne({ where: { orderId: order.id, status: 'recorded' } });
    if (commission) {
      commission.status = 'reversed';
      commission.reversedAt = new Date();
      commission.reversalReason = reason;
      await this.commissions.save(commission);
    }
    await this.jobs.enqueue('delivery.cancel_for_order', { orderId: order.id, reason }, { dedupeKey: `delivery-cancel:${order.id}`, maxAttempts: 3 });
    await this.notifyOwner(order, 'order.cancelled', { code: order.code, orderId: order.id, reason });
    const seller = await this.sellers.findOne({ where: { id: order.sellerId } });
    if (seller && actor === 'seller') {
      // فقط لغو از سوی فروشنده در شاخص اعتبار او ثبت می‌شود
      seller.cancelledOrders += 1;
      await this.sellers.save(seller);
    }
  }

  private async notifyOwner(order: Order, eventKey: string, vars: Record<string, unknown>): Promise<void> {
    await this.notifications
      .notify({ userId: order.userId, eventKey, subjectId: order.id, vars, data: { orderId: order.id } })
      .catch((error) => this.logger.warn(`ارسال اعلان ${eventKey} ناموفق بود: ${(error as Error).message}`));
  }

  /* ------------------------------------------------------------------ */
  /*                        فرایندهای زمان‌بندی‌شده                      */
  /* ------------------------------------------------------------------ */

  /** لغو یک سفارش مشخص اگر در مهلت پرداخت نشده باشد. */
  async expireOrderIfUnpaid(orderId: string, now = new Date()): Promise<boolean> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order || order.status !== 'WAITING_FOR_PAYMENT') return false;
    const minutes = await this.settings.getNumber('order.payment_expire_minutes', 15);
    if (now.getTime() - order.createdAt.getTime() < minutes * 60_000) return false;
    await this.systemTransition(order.id, 'CANCELLED', 'لغو خودکار به‌دلیل انقضای مهلت پرداخت', undefined, 'انقضای مهلت پرداخت');
    return true;
  }

  /** تکمیل خودکار یک سفارش تحویل‌شده پس از پایان مهلت رسیدگی. */
  async autoCompleteOrder(orderId: string, now = new Date()): Promise<boolean> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order || order.status !== 'DELIVERED' || !order.deliveredAt) return false;
    const hours = await this.settings.getNumber('order.auto_complete_hours', 48);
    if (now.getTime() - order.deliveredAt.getTime() < hours * 3_600_000) return false;
    await this.systemTransition(order.id, 'COMPLETED', 'تکمیل خودکار پس از پایان مهلت رسیدگی');
    return true;
  }

  /** لغو سفارش‌هایی که در مهلت پرداخت نشده‌اند و آزادسازی موجودی. */
  async expireUnpaidPayments(now = new Date()): Promise<number> {
    const minutes = await this.settings.getNumber('order.payment_expire_minutes', 15);
    const cutoff = new Date(now.getTime() - minutes * 60_000);
    const orders = await this.orders.find({ where: { status: 'WAITING_FOR_PAYMENT', createdAt: LessThan(cutoff) }, take: 100 });
    let count = 0;
    for (const order of orders) {
      try {
        await this.systemTransition(order.id, 'CANCELLED', 'لغو خودکار به‌دلیل انقضای مهلت پرداخت', undefined, 'انقضای مهلت پرداخت');
        count += 1;
      } catch (error) {
        this.logger.warn(`لغو خودکار سفارش ${order.code} ناموفق بود: ${(error as Error).message}`);
      }
    }
    return count;
  }

  /** تکمیل خودکار سفارش‌های تحویل‌شده پس از پایان مهلت رسیدگی. */
  async autoCompleteDelivered(now = new Date()): Promise<number> {
    const hours = await this.settings.getNumber('order.auto_complete_hours', 48);
    const cutoff = new Date(now.getTime() - hours * 3_600_000);
    const orders = await this.orders.find({ where: { status: 'DELIVERED', deliveredAt: LessThan(cutoff) }, take: 100 });
    let count = 0;
    for (const order of orders) {
      try {
        await this.systemTransition(order.id, 'COMPLETED', 'تکمیل خودکار پس از پایان مهلت رسیدگی');
        count += 1;
      } catch (error) {
        this.logger.warn(`تکمیل خودکار سفارش ${order.code} ناموفق بود: ${(error as Error).message}`);
      }
    }
    return count;
  }

  /** یادآوری آماده‌سازی به فروشنده در صورت عدم تأیید. */
  async remindUnconfirmed(now = new Date()): Promise<number> {
    const minutes = await this.settings.getNumber('order.preparation_timeout_minutes', 120);
    const from = new Date(now.getTime() - (minutes + 15) * 60_000);
    const to = new Date(now.getTime() - minutes * 60_000);
    const orders = await this.orders.find({ where: { status: In(['PAID', 'SELLER_CONFIRMED']), paidAt: Between(from, to) }, take: 100 });
    for (const order of orders) {
      const seller = await this.sellers.findOne({ where: { id: order.sellerId } });
      if (!seller) continue;
      await this.notifications
        .notify({
          userId: seller.userId,
          eventKey: 'order.created',
          subjectId: order.id,
          vars: { code: order.code, orderId: order.id, total: order.payableTotal },
          moneyVars: ['total'],
          dedupeKey: `order.remind:${order.id}`,
        })
        .catch(() => undefined);
    }
    return orders.length;
  }

  async statistics(rangeDays = 30): Promise<{ total: number; byStatus: Record<string, number>; gmv: number; platformRevenue: number }> {
    const since = new Date(Date.now() - rangeDays * 86_400_000);
    const rows = await this.orders
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(order.payableTotal), 0)', 'gmv')
      .addSelect('COALESCE(SUM(order.platformFee), 0)', 'platformFee')
      .where('order.createdAt >= :since', { since })
      .groupBy('order.status')
      .getRawMany<{ status: string; count: string; gmv: string; platformFee: string }>();

    const byStatus: Record<string, number> = {};
    let gmv = 0;
    let platformRevenue = 0;
    for (const row of rows) {
      byStatus[row.status] = Number(row.count);
      if (['PAID', 'SELLER_CONFIRMED', 'PREPARING', 'COMPLETED', 'DELIVERED'].includes(row.status)) {
        gmv += Number(row.gmv);
        platformRevenue += Number(row.platformFee);
      }
    }
    return { total: rows.reduce((acc, row) => acc + Number(row.count), 0), byStatus, gmv, platformRevenue };
  }

  statuses(): OrderStatus[] {
    return [...ORDER_STATUSES];
  }
}
