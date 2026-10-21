import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial } from 'typeorm';
import { In, MoreThanOrEqual, Not, Repository } from 'typeorm';
import {
  DELIVERY_TRANSITIONS,
  findTransition,
  haversineKm,
  metersBetween,
  type Actor,
  type DeliveryStatus,
} from '@carpart/contract';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { decryptSecret, encryptSecret, safeEqual } from '../../common/utils/crypto';
import { numericOtp, shortCode } from '../../common/utils/id';
import type { RequestUser } from '../../common/types/auth';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { CourierLocation } from '../couriers/entities/courier-location.entity';
import { CouriersService } from '../couriers/couriers.service';
import { JobQueueService } from '../jobs/job-queue.service';
import { MapService } from '../maps/map.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { PricingService } from '../finance/pricing.service';
import { SellerBranch } from '../sellers/entities/seller-branch.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { SystemSettingsService } from '../settings/system-settings.service';
import { User } from '../users/entities/user.entity';
import { DeliveryEvent } from './entities/delivery-event.entity';
import { Delivery } from './entities/delivery.entity';

export interface TrackingView {
  deliveryId: string;
  code: string;
  status: DeliveryStatus;
  statusFa: string;
  pickupPoint: { title: string; city: string | null; addressText: string; lat: number | null; lng: number | null };
  dropoffPoint: { title: string; receiverName: string; phoneMasked: string; addressText: string; lat: number | null; lng: number | null };
  courier: { name: string; phoneMasked: string; ratingAvg: number; vehicleType: string | null } | null;
  distanceKm: number | null;
  estimatedMinutes: number | null;
  routeSource: 'live' | 'estimation' | 'unknown';
  estimatedArrival: string | null;
  deliveryOtp: string | null;
  pickupCode: string | null;
  events: Array<{ at: string; fa: string; status: DeliveryStatus | null }>;
  location: {
    lat: number;
    lng: number;
    accuracyM: number | null;
    speedKmh: number | null;
    heading: number | null;
    recordedAt: string;
    ageSeconds: number;
    isFresh: boolean;
    distanceToPickupM: number | null;
    distanceToDropoffM: number | null;
  } | null;
  sellerArrival: { detected: boolean; at: string | null };
  refreshAfterSeconds: number;
  notice: string;
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '—';
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

/**
 * سرویس مأموریت ارسال.
 *
 * جریان: ساخت مأموریت از سفارش پرداخت‌شده ← یافتن نزدیک‌ترین پیک واجد شرایط ← پیشنهاد با مهلت ←
 * پذیرش/رد/اتمام مهلت ← دریافت از فروشگاه با کد تحویل ← ارسال ← تحویل با کد تأیید یکبارمصرف.
 * زمان و مسافت از آداپتر نقشه گرفته می‌شود و منبع آن (واقعی/تخمینی) در پاسخ اعلام می‌گردد.
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @InjectRepository(Delivery) private readonly deliveries: Repository<Delivery>,
    @InjectRepository(DeliveryEvent) private readonly events: Repository<DeliveryEvent>,
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
    @InjectRepository(CourierLocation) private readonly locations: Repository<CourierLocation>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(SellerBranch) private readonly branches: Repository<SellerBranch>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(CONFIG_TOKEN) private readonly config: AppConfig,
    private readonly ordersService: OrdersService,
    private readonly couriersService: CouriersService,
    private readonly maps: MapService,
    private readonly pricing: PricingService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobQueueService,
    private readonly settings: SystemSettingsService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*                          ساخت و تخصیص                              */
  /* ------------------------------------------------------------------ */

  /** ساخت مأموریت ارسال برای سفارش (یک مأموریت فعال به ازای هر سفارش). */
  async createFromOrder(orderId: string): Promise<Delivery> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('سفارش');
    const existing = await this.deliveries.findOne({ where: { orderId, status: Not(In(['CANCELLED', 'FAILED'])) } });
    if (existing) return existing;

    const branch = await this.branches.findOne({ where: { id: order.branchId } });
    if (!branch) throw new NotFoundException('شعبه فروشنده');
    const seller = await this.sellers.findOne({ where: { id: order.sellerId } });
    const address = order.addressSnapshot;
    if (!address) {
      throw new AppException('آدرس تحویل برای ساخت مأموریت ارسال موجود نیست.', ErrorCodes.PROFILE_INCOMPLETE, { statusCode: 409 });
    }

    const origin = typeof branch.lat === 'number' && typeof branch.lng === 'number' ? { lat: branch.lat, lng: branch.lng } : null;
    const destination = typeof address.lat === 'number' && typeof address.lng === 'number' ? { lat: address.lat, lng: address.lng } : null;
    const route = await this.maps.route(origin, destination);
    const courierSharePercent = await this.pricing.courierSharePercent();
    const courierShare = Math.max(0, Math.round((order.deliveryFee * courierSharePercent) / 100));

    const pickupCode = numericOtp(5);
    const deliveryOtp = numericOtp(5);
    const key = this.config.auth.encryptionKey;

    const draft: DeepPartial<Delivery> = {
        code: shortCode(6, 'DLV'),
        orderId: order.id,
        sellerBranchId: branch.id,
        sellerId: order.sellerId,
        courierId: null,
        status: 'PENDING_ASSIGNMENT',
        pickupPoint: {
          title: seller?.storeName ?? 'فروشگاه',
          receiverName: null,
          phone: branch.phone ?? seller?.phone ?? null,
          city: branch.city ?? undefined,
          addressText: branch.addressText ?? '',
          lat: branch.lat,
          lng: branch.lng,
        },
        dropoffPoint: {
          title: 'محل تحویل',
          receiverName: address.receiverName ?? null,
          phone: address.phone ?? null,
          city: address.city ?? undefined,
          addressText: address.addressText ?? '',
          lat: address.lat,
          lng: address.lng,
        },
        city: order.city ?? branch.city ?? undefined,
        distanceKm: route?.distanceKm ?? null,
        estimatedMinutes: route?.durationMinutes ?? null,
        deliveryFee: order.deliveryFee,
        courierShare,
        platformShare: Math.max(0, order.deliveryFee - courierShare),
        offerCount: 0,
        attempts: 0,
        estimatedWeightKg: 3,
        isUrgent: order.urgency !== 'normal',
        notes: order.notes ?? undefined,
        pickupCodeEncrypted: encryptSecret(pickupCode, key),
        deliveryOtpEncrypted: encryptSecret(deliveryOtp, key),
        excludedCourierIds: null,
    };
    const delivery = await this.deliveries.save(this.deliveries.create(draft));

    await this.recordEvent(delivery, 'created', 'ایجاد مأموریت ارسال', null, 'system', {
      routeSource: route?.source ?? 'unknown',
      degraded: route?.degraded ?? false,
    });

    // کد تحویل به فروشنده و کد تأیید تحویل به مکانیک نمایش داده می‌شود
    if (seller) {
      await this.notifications
        .notify({
          userId: seller.userId,
          eventKey: 'order.ready',
          subjectId: order.id,
          vars: { code: order.code, orderId: order.id },
          data: { deliveryId: delivery.id, pickupCode },
          dedupeKey: `delivery.pickup-code:${delivery.id}`,
        })
        .catch(() => undefined);
    }
    await this.jobs.enqueue('delivery.assign', { deliveryId: delivery.id }, { dedupeKey: `assign:${delivery.id}`, maxAttempts: 8 });
    return delivery;
  }

  /** یافتن پیک‌های واجد شرایط به ترتیب نزدیکی (بدون ادعای زمان تضمینی). */
  async eligibleCouriers(delivery: Delivery): Promise<Array<{ courier: CourierProfile; distanceKm: number | null }>> {
    const radiusKm = await this.settings.getNumber('courier.search_radius_km', 15);
    const maxConcurrent = await this.settings.getNumber('courier.max_concurrent_deliveries', 2);
    const excluded = new Set(delivery.excludedCourierIds ?? []);
    const pickup = delivery.pickupPoint;

    const couriers = await this.couriers.find({
      where: { verificationStatus: 'APPROVED', isActive: true, availability: 'online' },
      take: 300,
    });
    if (!couriers.length) return [];

    const activeCounts = await this.deliveries
      .createQueryBuilder('delivery')
      .select('delivery.courierId', 'courierId')
      .addSelect('COUNT(*)', 'count')
      .where('delivery.status IN (:...statuses)', { statuses: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_ATTEMPTED'] })
      .groupBy('delivery.courierId')
      .getRawMany<{ courierId: string; count: string }>();
    const countByCourier = new Map(activeCounts.map((row) => [row.courierId, Number(row.count)]));

    const result: Array<{ courier: CourierProfile; distanceKm: number | null }> = [];
    for (const courier of couriers) {
      if (excluded.has(courier.id)) continue;
      if ((countByCourier.get(courier.id) ?? 0) >= maxConcurrent) continue;
      if (courier.serviceCity && delivery.city && courier.serviceCity !== delivery.city) continue;

      const distanceKm =
        pickup.lat !== null && pickup.lng !== null && courier.currentLat !== null && courier.currentLng !== null
          ? haversineKm({ lat: pickup.lat, lng: pickup.lng }, { lat: courier.currentLat, lng: courier.currentLng })
          : null;
      const withinRadius = distanceKm === null ? Boolean(!courier.serviceCity || courier.serviceCity === delivery.city) : distanceKm <= radiusKm;
      if (!withinRadius) continue;
      result.push({ courier, distanceKm });
    }
    return result.sort((a, b) => (a.distanceKm ?? 1e6) - (b.distanceKm ?? 1e6));
  }

  /** پیشنهاد مأموریت به نزدیک‌ترین پیک واجد شرایط. */
  async assign(deliveryId: string): Promise<{ delivery: Delivery; assigned: boolean; reason?: string }> {
    const delivery = await this.requireDelivery(deliveryId);
    if (!['PENDING_ASSIGNMENT', 'OFFER_EXPIRED', 'FAILED'].includes(delivery.status)) {
      return { delivery, assigned: false, reason: 'مأموریت در وضعیت قابل تخصیص نیست.' };
    }
    const maxOffers = await this.settings.getNumber('courier.max_offers_per_delivery', 5);
    if (delivery.offerCount >= maxOffers) {
      return this.noCourierAvailable(delivery, `پس از ${maxOffers} پیشنهاد، پیک واجد شرایطی یافت نشد.`);
    }

    const candidates = await this.eligibleCouriers(delivery);
    const next = candidates[0];
    if (!next) {
      return this.noCourierAvailable(delivery, 'پیک واجد شرایطی در محدوده یافت نشد.');
    }

    const timeoutMinutes = await this.settings.getNumber('courier.offer.timeout_minutes', 4);
    const now = new Date();
    delivery.status = 'OFFERED';
    delivery.courierId = next.courier.id;
    delivery.offerCount += 1;
    delivery.offeredAt = now;
    delivery.offerExpiresAt = new Date(now.getTime() + timeoutMinutes * 60_000);
    const saved = await this.deliveries.save(delivery);

    await this.recordEvent(saved, 'offered', `پیشنهاد مأموریت به پیک (فاصله ${next.distanceKm === null ? 'نامشخص' : `${next.distanceKm.toFixed(1)} کیلومتر`})`, next.courier.userId, 'system', {
      distanceKm: next.distanceKm,
      offerExpiresAt: saved.offerExpiresAt?.toISOString(),
    });
    await this.notifications.notify({
      userId: next.courier.userId,
      eventKey: 'delivery.offered',
      subjectId: saved.id,
      vars: {
        code: saved.code,
        deliveryId: saved.id,
        pickup: saved.pickupPoint.title ?? 'فروشگاه',
        dropoff: saved.dropoffPoint.city ?? 'محل تحویل',
        fee: saved.courierShare,
        // مسافت از سرویس نقشه می‌آید و در حالت تخمین، تقریبی اعلام می‌شود (بدون ادعای دقت کاذب)
        distance: next.distanceKm === null || next.distanceKm === undefined ? 'نامشخص' : `${next.distanceKm.toFixed(1)} کیلومتر`,
        deadline: `${timeoutMinutes} دقیقه`,
      },
      moneyVars: ['fee'],
      data: { deliveryId: saved.id },
    });
    await this.jobs.enqueue(
      'delivery.offer_timeout',
      { deliveryId: saved.id },
      { dedupeKey: `offer-timeout:${saved.id}:${saved.offerCount}`, runAt: saved.offerExpiresAt ?? now, maxAttempts: 3 },
    );
    return { delivery: saved, assigned: true };
  }

  private async noCourierAvailable(delivery: Delivery, reason: string): Promise<{ delivery: Delivery; assigned: boolean; reason: string }> {
    delivery.status = 'FAILED';
    delivery.lastFailureReason = reason;
    const saved = await this.deliveries.save(delivery);
    await this.recordEvent(saved, 'no_courier', reason, null, 'system');
    const order = await this.orders.findOne({ where: { id: saved.orderId } });
    if (order) {
      await this.notifications
        .notify({
          userId: order.userId,
          eventKey: 'delivery.no_courier',
          subjectId: order.id,
          vars: { code: order.code, orderId: order.id, deliveryId: saved.id, deliveryCode: saved.code, reason },
          data: { orderId: order.id, deliveryId: saved.id },
        })
        .catch(() => undefined);
      const admins = await this.users
        .createQueryBuilder('user')
        .where('user.isActive = :active', { active: true })
        .andWhere("user.roles LIKE :role", { role: '%admin%' })
        .take(20)
        .getMany();
      for (const admin of admins) {
        await this.notifications
          .notify({
            userId: admin.id,
            eventKey: 'delivery.no_courier.admin',
            subjectId: saved.id,
            vars: { code: order.code, orderId: order.id, deliveryId: saved.id, deliveryCode: saved.code, reason },
            data: { orderId: order.id, deliveryId: saved.id },
            dedupeKey: `delivery.no_courier.admin:${saved.id}:${admin.id}`,
          })
          .catch(() => undefined);
      }
    }
    this.logger.warn(`مأموریت ${saved.code} بدون پیک ماند: ${reason}`);
    return { delivery: saved, assigned: false, reason };
  }

  /** پایان مهلت پذیرش: بازگشت به صف و پیشنهاد به پیک بعدی. */
  async handleOfferTimeout(deliveryId: string): Promise<{ expired: boolean }> {
    const delivery = await this.requireDelivery(deliveryId);
    if (delivery.status !== 'OFFERED') return { expired: false };
    if (delivery.offerExpiresAt && delivery.offerExpiresAt > new Date()) return { expired: false };

    const offeredCourierId = delivery.courierId;
    delivery.status = 'OFFER_EXPIRED';
    await this.deliveries.save(delivery);
    await this.recordEvent(delivery, 'offer_expired', 'مهلت پذیرش مأموریت به پایان رسید', null, 'system');

    delivery.status = 'PENDING_ASSIGNMENT';
    delivery.courierId = null;
    delivery.excludedCourierIds = [...new Set([...(delivery.excludedCourierIds ?? []), ...(offeredCourierId ? [offeredCourierId] : [])])];
    const saved = await this.deliveries.save(delivery);
    await this.recordEvent(saved, 'requeue', 'بازگشت مأموریت به صف تخصیص', null, 'system');

    const result = await this.assign(saved.id);
    if (!result.assigned) {
      await this.notifications
        .notify({
          userId: (await this.orders.findOne({ where: { id: saved.orderId } }))?.userId ?? '',
          eventKey: 'delivery.reassigned',
          subjectId: saved.id,
          vars: { code: saved.code, deliveryId: saved.id, reason: result.reason ?? 'در حال جست‌وجوی پیک' },
        })
        .catch(() => undefined);
    }
    return { expired: true };
  }

  /* ------------------------------------------------------------------ */
  /*                         کنش‌های پیک                                */
  /* ------------------------------------------------------------------ */

  async accept(user: RequestUser, deliveryId: string): Promise<Delivery> {
    const courier = await this.couriersService.requireVerifiedCourier(user.id);
    const delivery = await this.requireDelivery(deliveryId);
    if (delivery.status !== 'OFFERED') {
      throw new AppException('این مأموریت در وضعیت پیشنهاد نیست.', ErrorCodes.CONFLICT, { statusCode: 409 });
    }
    if (delivery.courierId !== courier.id) {
      throw new AppException('این مأموریت به شما پیشنهاد نشده است.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    if (delivery.offerExpiresAt && delivery.offerExpiresAt < new Date()) {
      await this.handleOfferTimeout(delivery.id);
      throw new AppException('مهلت پذیرش این مأموریت به پایان رسیده است.', ErrorCodes.CONFLICT, { statusCode: 409 });
    }
    const maxConcurrent = await this.settings.getNumber('courier.max_concurrent_deliveries', 2);
    const active = await this.deliveries.count({
      where: { courierId: courier.id, status: In(['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_ATTEMPTED']) },
    });
    if (active >= maxConcurrent) {
      throw new AppException(`شما ${active} مأموریت فعال دارید و سقف هم‌زمان ${maxConcurrent} است.`, ErrorCodes.COURIER_NOT_ELIGIBLE, {
        statusCode: 409,
      });
    }

    this.assertTransition(delivery.status, 'ACCEPTED', 'courier');
    delivery.status = 'ACCEPTED';
    delivery.acceptedAt = new Date();
    const saved = await this.deliveries.save(delivery);
    await this.recordEvent(saved, 'accepted', 'پیک مأموریت را پذیرفت', user.id, 'courier');

    const order = await this.orders.findOne({ where: { id: saved.orderId } });
    if (order && order.status === 'WAITING_FOR_COURIER') {
      await this.ordersService.systemTransition(order.id, 'COURIER_ASSIGNED', 'تخصیص پیک');
    }
    if (order) {
      await this.notifications
        .notify({
          userId: order.userId,
          eventKey: 'delivery.accepted',
          subjectId: order.id,
          vars: { code: order.code, orderId: order.id, courierName: user.fullName ?? 'پیک', eta: saved.estimatedMinutes ?? 'نامشخص' },
          data: { orderId: order.id, deliveryId: saved.id },
        })
        .catch(() => undefined);
    }
    return saved;
  }

  async reject(user: RequestUser, deliveryId: string, reason?: string): Promise<Delivery> {
    const courier = await this.couriersService.requireVerifiedCourier(user.id);
    const delivery = await this.requireDelivery(deliveryId);
    if (delivery.courierId !== courier.id || !['OFFERED', 'ACCEPTED'].includes(delivery.status)) {
      throw new AppException('این مأموریت در اختیار شما نیست.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    const wasAccepted = delivery.status === 'ACCEPTED';
    delivery.status = 'PENDING_ASSIGNMENT';
    delivery.excludedCourierIds = [...new Set([...(delivery.excludedCourierIds ?? []), courier.id])];
    delivery.courierId = null;
    delivery.offerExpiresAt = null;
    delivery.lastFailureReason = reason ?? 'رد پیشنهاد توسط پیک';
    const saved = await this.deliveries.save(delivery);
    await this.recordEvent(saved, wasAccepted ? 'courier_released' : 'rejected', reason ?? 'رد پیشنهاد توسط پیک', user.id, 'courier');

    if (wasAccepted) {
      const order = await this.orders.findOne({ where: { id: saved.orderId } });
      if (order && order.status === 'COURIER_ASSIGNED') {
        await this.ordersService.systemTransition(order.id, 'WAITING_FOR_COURIER', 'بازگشت به صف تخصیص پیک');
      }
    }
    await this.jobs.enqueue('delivery.assign', { deliveryId: saved.id }, { dedupeKey: `assign:${saved.id}:${saved.offerCount}`, maxAttempts: 8 });
    return saved;
  }

  /** دریافت مرسوله از فروشگاه با کد تحویل (رمزنگاری‌شده نگهداری می‌شود). */
  async pickup(user: RequestUser, deliveryId: string, pickupCode: string, note?: string): Promise<Delivery> {
    const courier = await this.couriersService.requireVerifiedCourier(user.id);
    const delivery = await this.requireOwnedDelivery(deliveryId, courier.id);
    this.assertTransition(delivery.status, 'PICKED_UP', 'courier');
    this.assertCode(delivery.pickupCodeEncrypted, pickupCode, ErrorCodes.PICKUP_CODE_INVALID, 'کد دریافت از فروشگاه');

    delivery.status = 'PICKED_UP';
    delivery.pickedUpAt = new Date();
    delivery.arrivedAtSellerAt = delivery.arrivedAtSellerAt ?? new Date();
    const saved = await this.deliveries.save(delivery);
    await this.recordEvent(saved, 'picked_up', note ? `دریافت از فروشگاه — ${note}` : 'دریافت مرسوله از فروشگاه', user.id, 'courier');

    const order = await this.orders.findOne({ where: { id: saved.orderId } });
    if (order && order.status === 'COURIER_ASSIGNED') {
      await this.ordersService.transition(order.id, 'PICKED_UP', user, note);
    }
    return saved;
  }

  async startTransit(user: RequestUser, deliveryId: string): Promise<Delivery> {
    const courier = await this.couriersService.requireVerifiedCourier(user.id);
    const delivery = await this.requireOwnedDelivery(deliveryId, courier.id);
    this.assertTransition(delivery.status, 'IN_TRANSIT', 'courier');
    delivery.status = 'IN_TRANSIT';
    const saved = await this.deliveries.save(delivery);
    await this.recordEvent(saved, 'in_transit', 'شروع ارسال به سمت مقصد', user.id, 'courier');
    const order = await this.orders.findOne({ where: { id: saved.orderId } });
    if (order && order.status === 'PICKED_UP') {
      await this.ordersService.transition(order.id, 'IN_TRANSIT', user);
    }
    return saved;
  }

  /** ثبت تحویل با کد تأیید یکبارمصرف دریافت‌کننده. */
  async deliver(
    user: RequestUser,
    deliveryId: string,
    otp: string,
    options: { proofImageUrl?: string; note?: string } = {},
  ): Promise<Delivery> {
    const courier = await this.couriersService.requireVerifiedCourier(user.id);
    const delivery = await this.requireOwnedDelivery(deliveryId, courier.id);
    this.assertTransition(delivery.status, 'DELIVERED', 'courier');
    this.assertCode(delivery.deliveryOtpEncrypted, otp, ErrorCodes.DELIVERY_OTP_INVALID, 'کد تأیید تحویل');

    delivery.status = 'DELIVERED';
    delivery.deliveredAt = new Date();
    delivery.proofImageUrl = options.proofImageUrl ?? null;
    delivery.proofNote = options.note ?? null;
    const saved = await this.deliveries.save(delivery);
    await this.recordEvent(saved, 'delivered', 'تحویل مرسوله با کد تأیید', user.id, 'courier');

    courier.completedDeliveries += 1;
    await this.couriers.save(courier);

    const order = await this.orders.findOne({ where: { id: saved.orderId } });
    if (order && ['IN_TRANSIT', 'DELIVERY_ATTEMPTED'].includes(order.status)) {
      await this.ordersService.transition(order.id, 'DELIVERED', user, options.note);
    }
    return saved;
  }

  async failAttempt(user: RequestUser, deliveryId: string, reason: string, nextAction: 'retry' | 'cancel' = 'retry'): Promise<Delivery> {
    const courier = await this.couriersService.requireVerifiedCourier(user.id);
    const delivery = await this.requireOwnedDelivery(deliveryId, courier.id);
    delivery.attempts += 1;
    delivery.lastFailureReason = reason;

    if (nextAction === 'cancel') {
      this.assertTransition(delivery.status, 'FAILED', 'courier');
      delivery.status = 'FAILED';
      const saved = await this.deliveries.save(delivery);
      await this.recordEvent(saved, 'failed', reason, user.id, 'courier');
      const order = await this.orders.findOne({ where: { id: saved.orderId } });
      if (order && ['PICKED_UP', 'IN_TRANSIT'].includes(order.status)) {
        await this.ordersService.transition(order.id, 'DISPUTED', user, `عدم امکان تحویل: ${reason}`);
      }
      return saved;
    }

    this.assertTransition(delivery.status, 'DELIVERY_ATTEMPTED', 'courier');
    delivery.status = 'DELIVERY_ATTEMPTED';
    const saved = await this.deliveries.save(delivery);
    await this.recordEvent(saved, 'attempt_failed', `تلاش تحویل ناموفق: ${reason}`, user.id, 'courier');
    await this.jobs.enqueue(
      'delivery.retry_reminder',
      { deliveryId: saved.id },
      { dedupeKey: `retry:${saved.id}:${saved.attempts}`, runAt: new Date(Date.now() + 15 * 60_000), maxAttempts: 2 },
    );
    return saved;
  }

  async cancel(deliveryId: string, reason: string, actor: Actor = 'system'): Promise<Delivery> {
    const delivery = await this.requireDelivery(deliveryId);
    if (['DELIVERED', 'CANCELLED'].includes(delivery.status)) return delivery;
    this.assertTransition(delivery.status, 'CANCELLED', actor === 'system' ? 'system' : 'admin');
    delivery.status = 'CANCELLED';
    delivery.cancelledAt = new Date();
    delivery.lastFailureReason = reason;
    const saved = await this.deliveries.save(delivery);
    await this.recordEvent(saved, 'cancelled', reason, null, actor === 'system' ? 'system' : 'admin');
    return saved;
  }

  /* ------------------------------------------------------------------ */
  /*                       مشاهده و ردیابی                              */
  /* ------------------------------------------------------------------ */

  async requireDelivery(deliveryId: string): Promise<Delivery> {
    const delivery = await this.deliveries.findOne({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('مأموریت ارسال');
    return delivery;
  }

  private async requireOwnedDelivery(deliveryId: string, courierId: string): Promise<Delivery> {
    const delivery = await this.requireDelivery(deliveryId);
    if (delivery.courierId !== courierId) {
      throw new AppException('این مأموریت به پیک دیگری تخصیص یافته است.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    return delivery;
  }

  async forOrder(orderId: string): Promise<Delivery | null> {
    return this.deliveries.findOne({ where: { orderId }, order: { createdAt: 'DESC' } });
  }

  private assertTransition(from: DeliveryStatus, to: DeliveryStatus, actor: Actor): void {
    const transition = findTransition(DELIVERY_TRANSITIONS, from, to);
    if (!transition) {
      throw new AppException(`تغییر وضعیت مأموریت از «${from}» به «${to}» مجاز نیست.`, ErrorCodes.ORDER_TRANSITION_FORBIDDEN, {
        statusCode: 409,
      });
    }
    if (!transition.actors.includes(actor)) {
      throw new AppException(`شما اجازه این تغییر وضعیت مأموریت را ندارید.`, ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
  }

  private assertCode(encrypted: string | null, provided: string, code: string, label: string): void {
    if (!encrypted) {
      throw new AppException(`${label} برای این مأموریت صادر نشده است.`, ErrorCodes.INTERNAL_ERROR, { statusCode: 500 });
    }
    const expected = decryptSecret(encrypted, this.config.auth.encryptionKey);
    if (!safeEqual(expected, provided.trim())) {
      throw new AppException(`${label} واردشده معتبر نیست.`, code, { statusCode: 409 });
    }
  }

  /** نمای ردیابی با محدودسازی حریم خصوصی (شماره‌ها پوشیده و نام کامل پیک داده نمی‌شود). */
  async tracking(orderId: string, viewer: RequestUser): Promise<TrackingView> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('سفارش');
    const isOwner = order.userId === viewer.id;
    const isSeller = viewer.profileKind === 'seller' && viewer.profileId === order.sellerId;
    const isStaff = viewer.roles.includes('admin') || viewer.roles.includes('operator');
    if (!isOwner && !isSeller && !isStaff) {
      throw new AppException('دسترسی به ردیابی این سفارش ندارید.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }

    const delivery = await this.forOrder(orderId);
    if (!delivery) {
      return {
        deliveryId: '',
        code: '',
        status: 'PENDING_ASSIGNMENT',
        statusFa: 'مأموریت ارسال هنوز ساخته نشده است',
        pickupPoint: { title: '', city: order.city, addressText: '', lat: null, lng: null },
        dropoffPoint: {
          title: 'محل تحویل',
          receiverName: order.addressSnapshot?.receiverName ?? '',
          phoneMasked: maskPhone(order.addressSnapshot?.phone),
          addressText: order.addressSnapshot?.addressText ?? '',
          lat: order.addressSnapshot?.lat ?? null,
          lng: order.addressSnapshot?.lng ?? null,
        },
        courier: null,
        distanceKm: null,
        estimatedMinutes: null,
        routeSource: 'unknown',
        estimatedArrival: null,
        deliveryOtp: null,
        pickupCode: null,
        events: [],
        location: null,
        sellerArrival: { detected: false, at: null },
        refreshAfterSeconds: 15,
        notice: 'پس از پرداخت و آماده‌سازی سفارش، مأموریت ارسال ساخته می‌شود.',
      };
    }

    const courierProfile = delivery.courierId ? await this.couriers.findOne({ where: { id: delivery.courierId } }) : null;
    const courierUser = courierProfile ? await this.users.findOne({ where: { id: courierProfile.userId } }) : null;
    const events = await this.events.find({ where: { deliveryId: delivery.id }, order: { createdAt: 'ASC' } });
    const latestLocation = courierProfile
      ? await this.locations.findOne({ where: { courierId: courierProfile.id, deliveryId: delivery.id }, order: { recordedAt: 'DESC' } })
      : null;
    const freshSeconds = await this.settings.getNumber('courier.location.fresh_seconds', 45);
    const locationAgeSeconds = latestLocation ? Math.max(0, Math.floor((Date.now() - latestLocation.recordedAt.getTime()) / 1000)) : null;
    const currentPoint = latestLocation ? { lat: latestLocation.lat, lng: latestLocation.lng } : null;
    const pickupPoint = delivery.pickupPoint.lat != null && delivery.pickupPoint.lng != null
      ? { lat: delivery.pickupPoint.lat, lng: delivery.pickupPoint.lng }
      : null;
    const dropoffPoint = delivery.dropoffPoint.lat != null && delivery.dropoffPoint.lng != null
      ? { lat: delivery.dropoffPoint.lat, lng: delivery.dropoffPoint.lng }
      : null;

    const key = this.config.auth.encryptionKey;
    return {
      deliveryId: delivery.id,
      code: delivery.code,
      status: delivery.status,
      statusFa: delivery.status,
      pickupPoint: {
        title: delivery.pickupPoint.title ?? 'فروشگاه',
        city: delivery.pickupPoint.city ?? null,
        addressText: delivery.pickupPoint.addressText,
        lat: delivery.pickupPoint.lat,
        lng: delivery.pickupPoint.lng,
      },
      dropoffPoint: {
        title: delivery.dropoffPoint.title ?? 'محل تحویل',
        receiverName: isStaff || isOwner ? (delivery.dropoffPoint.receiverName ?? '') : (delivery.dropoffPoint.receiverName ?? '').split(' ')[0] ?? '',
        phoneMasked: isOwner || isStaff ? (delivery.dropoffPoint.phone ?? '') : maskPhone(delivery.dropoffPoint.phone),
        addressText: delivery.dropoffPoint.addressText,
        lat: delivery.dropoffPoint.lat,
        lng: delivery.dropoffPoint.lng,
      },
      courier: courierProfile
        ? {
            name: courierUser?.fullName?.split(' ')[0] ?? 'پیک',
            phoneMasked: isOwner || isStaff ? (courierUser?.mobile ?? '') : maskPhone(courierUser?.mobile),
            ratingAvg: courierProfile.ratingAvg,
            vehicleType: courierProfile.vehicleType ?? null,
          }
        : null,
      distanceKm: delivery.distanceKm,
      estimatedMinutes: delivery.estimatedMinutes,
      routeSource: (events.find((event) => event.type === 'created')?.metadata?.routeSource as TrackingView['routeSource']) ?? 'unknown',
      estimatedArrival:
        delivery.estimatedMinutes && delivery.pickedUpAt
          ? new Date(delivery.pickedUpAt.getTime() + delivery.estimatedMinutes * 60_000).toISOString()
          : null,
      // کد تأیید تحویل فقط به گیرنده (مالک سفارش) و مدیر نمایش داده می‌شود
      deliveryOtp: isOwner || isStaff ? (delivery.deliveryOtpEncrypted ? decryptSecret(delivery.deliveryOtpEncrypted, key) : null) : null,
      pickupCode: isSeller || isStaff ? (delivery.pickupCodeEncrypted ? decryptSecret(delivery.pickupCodeEncrypted, key) : null) : null,
      events: events.map((event) => ({
        at: event.createdAt.toISOString(),
        fa: event.faDescription,
        status: event.status,
      })),
      location: latestLocation && currentPoint
        ? {
            lat: latestLocation.lat,
            lng: latestLocation.lng,
            accuracyM: latestLocation.accuracyM,
            speedKmh: latestLocation.speedKmh,
            heading: latestLocation.heading,
            recordedAt: latestLocation.recordedAt.toISOString(),
            ageSeconds: locationAgeSeconds ?? 0,
            isFresh: (locationAgeSeconds ?? Number.POSITIVE_INFINITY) <= freshSeconds,
            distanceToPickupM: pickupPoint ? Math.round(metersBetween(currentPoint, pickupPoint)) : null,
            distanceToDropoffM: dropoffPoint ? Math.round(metersBetween(currentPoint, dropoffPoint)) : null,
          }
        : null,
      sellerArrival: {
        detected: delivery.arrivedAtSellerAt !== null,
        at: delivery.arrivedAtSellerAt?.toISOString() ?? null,
      },
      refreshAfterSeconds: 15,
      notice:
        delivery.status === 'PENDING_ASSIGNMENT'
          ? 'در حال یافتن نزدیک‌ترین پیک واجد شرایط هستیم؛ زمان تحویل قطعی نیست.'
          : delivery.estimatedMinutes
            ? 'زمان تقریبی بر پایه مسافت مسیر محاسبه شده و ممکن است با ترافیک تغییر کند.'
            : 'زمان تحویل به‌صورت تقریبی اعلام می‌شود.',
    };
  }

  async listForCourier(
    user: RequestUser,
    query: { status?: 'offers' | 'active' | 'history' | 'all'; page?: number; pageSize?: number } = {},
  ): Promise<PageResult<Delivery>> {
    const courier = await this.couriersService.requireCourier(user.id);
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = { courierId: courier.id };
    if (query.status === 'offers') where.status = 'OFFERED';
    else if (query.status === 'active') where.status = In(['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_ATTEMPTED']);
    else if (query.status === 'history') where.status = In(['DELIVERED', 'FAILED', 'CANCELLED']);
    const [items, total] = await this.deliveries.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items.map((item) => this.courierView(item)), total, query.page ?? 1, query.pageSize ?? 20);
  }

  /** دید پیک: شماره کامل گیرنده فقط پس از پذیرش مأموریت در اختیار پیک قرار می‌گیرد. */
  private courierView(delivery: Delivery): Delivery {
    const accepted = ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_ATTEMPTED', 'DELIVERED'].includes(delivery.status);
    if (accepted) return { ...delivery, deliveryOtpEncrypted: null, pickupCodeEncrypted: null };
    return {
      ...delivery,
      dropoffPoint: { ...delivery.dropoffPoint, phone: maskPhone(delivery.dropoffPoint.phone), receiverName: (delivery.dropoffPoint.receiverName ?? '').split(' ')[0] ?? '' },
      deliveryOtpEncrypted: null,
      pickupCodeEncrypted: null,
    };
  }

  async detailForCourier(user: RequestUser, deliveryId: string): Promise<Delivery> {
    const courier = await this.couriersService.requireCourier(user.id);
    const delivery = await this.requireDelivery(deliveryId);
    if (delivery.courierId !== courier.id) {
      throw new AppException('این مأموریت به شما تخصیص نیافته است.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    return this.courierView(delivery);
  }

  async eventsFor(user: RequestUser, deliveryId: string): Promise<DeliveryEvent[]> {
    const delivery = await this.requireDelivery(deliveryId);
    const order = await this.orders.findOne({ where: { id: delivery.orderId } });
    if (!order) throw new NotFoundException('سفارش');
    const courier = user.profileKind === 'courier' ? await this.couriersService.requireCourier(user.id) : null;
    const allowed =
      order.userId === user.id ||
      user.roles.includes('admin') ||
      user.roles.includes('operator') ||
      (user.profileKind === 'seller' && user.profileId === order.sellerId) ||
      (courier !== null && delivery.courierId === courier.id);
    if (!allowed) throw new AppException('دسترسی به رویدادهای این مأموریت ندارید.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    return this.events.find({ where: { deliveryId }, order: { createdAt: 'ASC' } });
  }

  async listAll(query: { status?: DeliveryStatus; page?: number; pageSize?: number } = {}): Promise<PageResult<Delivery>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await this.deliveries.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  private async recordEvent(
    delivery: Delivery,
    type: string,
    faDescription: string,
    actorId: string | null,
    actorType: DeliveryEvent['actorType'],
    metadata?: Record<string, unknown> | null,
  ): Promise<void> {
    await this.events.save(
      this.events.create({
        deliveryId: delivery.id,
        type,
        status: delivery.status,
        faDescription,
        actorId,
        actorType,
        lat: null,
        lng: null,
        metadata: metadata ?? null,
      }),
    );
  }

  async statistics(rangeDays = 30): Promise<{ total: number; delivered: number; failed: number; avgMinutes: number | null }> {
    const since = new Date(Date.now() - rangeDays * 86_400_000);
    const rows = await this.deliveries.find({ where: { createdAt: MoreThanOrEqual(since) }, take: 1000 });
    const delivered = rows.filter((row) => row.status === 'DELIVERED');
    const durations = delivered
      .filter((row) => row.pickedUpAt && row.deliveredAt)
      .map((row) => ((row.deliveredAt as Date).getTime() - (row.pickedUpAt as Date).getTime()) / 60_000);
    return {
      total: rows.length,
      delivered: delivered.length,
      failed: rows.filter((row) => ['FAILED', 'CANCELLED'].includes(row.status)).length,
      avgMinutes: durations.length ? Math.round(durations.reduce((acc, value) => acc + value, 0) / durations.length) : null,
    };
  }
}
