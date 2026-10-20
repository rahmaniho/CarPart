import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import { decryptSecret, encryptSecret } from '../../common/utils/crypto';
import { CourierLocation } from './entities/courier-location.entity';
import { CourierProfile } from './entities/courier-profile.entity';
import { CourierPayoutInfoDto, UpdateLocationDto, UpsertCourierDto } from './dto/courier.dto';
import { Delivery } from '../delivery/entities/delivery.entity';
import { Payout } from '../finance/entities/payout.entity';
import { User } from '../users/entities/user.entity';

export interface CourierDashboard {
  profile: { id: string; verificationStatus: string; availability: string; ratingAvg: number; completedDeliveries: number };
  activeMission: { id: string; code: string; status: string } | null;
  availableOffers: number;
  today: { delivered: number; earnings: number };
  pendingPayout: number;
}

@Injectable()
export class CouriersService {
  constructor(
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
    @InjectRepository(CourierLocation) private readonly locations: Repository<CourierLocation>,
    @InjectRepository(Delivery) private readonly deliveries: Repository<Delivery>,
    @InjectRepository(Payout) private readonly payouts: Repository<Payout>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(CONFIG_TOKEN) private readonly config: AppConfig,
  ) {}

  async findByUserId(userId: string): Promise<CourierProfile | null> {
    return this.couriers.findOne({ where: { userId } });
  }

  async requireCourier(userId: string): Promise<CourierProfile> {
    const courier = await this.findByUserId(userId);
    if (!courier) {
      throw new AppException('پروفایل پیک شما کامل نیست. ابتدا اطلاعات و مدارک را ثبت کنید.', ErrorCodes.PROFILE_INCOMPLETE, {
        statusCode: 409,
      });
    }
    return courier;
  }

  async requireVerifiedCourier(userId: string): Promise<CourierProfile> {
    const courier = await this.requireCourier(userId);
    if (courier.verificationStatus !== 'APPROVED') {
      throw new AppException(
        'حساب پیک شما هنوز تأیید نشده است. مدارک را تکمیل و برای بررسی ارسال کنید.',
        ErrorCodes.ACCOUNT_NOT_VERIFIED,
        { statusCode: 403 },
      );
    }
    if (!courier.isActive) {
      throw new AppException('حساب پیک غیرفعال است.', ErrorCodes.ACCOUNT_SUSPENDED, { statusCode: 403 });
    }
    return courier;
  }

  async getOrCreate(userId: string): Promise<CourierProfile> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;
    const user = await this.users.findOne({ where: { id: userId } });
    return this.couriers.save(
      this.couriers.create({
        userId,
        verificationStatus: 'DRAFT',
        availability: 'offline',
        serviceCity: user?.city ?? null,
        isActive: true,
      }),
    );
  }

  async upsert(userId: string, dto: UpsertCourierDto): Promise<CourierProfile> {
    const courier = await this.getOrCreate(userId);
    if (dto.fullName) {
      const user = await this.users.findOne({ where: { id: userId } });
      if (user) {
        user.fullName = dto.fullName;
        await this.users.save(user);
      }
    }
    const before = { nationalId: courier.nationalId, vehiclePlate: courier.vehiclePlate };
    Object.assign(courier, {
      nationalId: dto.nationalId ?? courier.nationalId,
      vehicleType: dto.vehicleType ?? courier.vehicleType,
      vehicleModel: dto.vehicleModel ?? courier.vehicleModel,
      vehiclePlate: dto.vehiclePlate ?? courier.vehiclePlate,
      capacityKg: dto.capacityKg ?? courier.capacityKg,
      capacityLiters: dto.capacityLiters ?? courier.capacityLiters,
      serviceCity: dto.serviceCity ?? courier.serviceCity,
      serviceRadiusKm: dto.serviceRadiusKm ?? courier.serviceRadiusKm,
    });
    if (dto.documents) {
      courier.documents = dto.documents.map((doc) => ({
        kind: doc.kind,
        fileUrl: doc.fileUrl,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded',
      }));
    }
    if (
      courier.verificationStatus === 'APPROVED' &&
      (before.nationalId !== courier.nationalId || before.vehiclePlate !== courier.vehiclePlate)
    ) {
      courier.verificationStatus = 'PENDING_REVIEW';
    }
    return this.couriers.save(courier);
  }

  async submitForReview(userId: string): Promise<CourierProfile> {
    const courier = await this.requireCourier(userId);
    if (!courier.nationalId || !courier.vehiclePlate || !courier.serviceCity) {
      throw new AppException('کد ملی، پلاک وسیله نقلیه و شهر فعالیت الزامی است.', ErrorCodes.PROFILE_INCOMPLETE, { statusCode: 409 });
    }
    if (!courier.documents?.length) {
      throw new AppException('حداقل یک مدرک (کارت ملی یا گواهینامه) بارگذاری کنید.', ErrorCodes.PROFILE_INCOMPLETE, { statusCode: 409 });
    }
    courier.verificationStatus = 'PENDING_REVIEW';
    return this.couriers.save(courier);
  }

  async setAvailability(userId: string, availability: 'online' | 'offline'): Promise<CourierProfile> {
    const courier = await this.requireVerifiedCourier(userId);
    courier.availability = availability;
    return this.couriers.save(courier);
  }

  async updateLocation(userId: string, dto: UpdateLocationDto): Promise<{ ok: true; recordedAt: string }> {
    const courier = await this.requireCourier(userId);
    const now = new Date();
    courier.currentLat = dto.lat;
    courier.currentLng = dto.lng;
    courier.locationUpdatedAt = now;
    await this.couriers.save(courier);

    // ذخیره نمونه موقعیت فقط در چارچوب مأموریت فعال (رعایت حریم خصوصی)
    if (dto.deliveryId) {
      const delivery = await this.deliveries.findOne({ where: { id: dto.deliveryId, courierId: courier.id } });
      if (delivery && !['DELIVERED', 'CANCELLED', 'FAILED'].includes(delivery.status)) {
        await this.locations.save(
          this.locations.create({
            courierId: courier.id,
            deliveryId: delivery.id,
            lat: dto.lat,
            lng: dto.lng,
            accuracyM: dto.accuracyM ?? null,
            speedKmh: dto.speedKmh ?? null,
            heading: dto.heading ?? null,
            recordedAt: now,
            source: 'app',
          }),
        );
      }
    }
    return { ok: true, recordedAt: now.toISOString() };
  }

  async updatePayoutInfo(userId: string, dto: CourierPayoutInfoDto): Promise<Record<string, string>> {
    const courier = await this.requireCourier(userId);
    courier.payoutInfoEncrypted = encryptSecret(JSON.stringify(dto), this.config.auth.encryptionKey);
    await this.couriers.save(courier);
    const info = this.payoutInfo(courier);
    if (!info) {
      throw new AppException('ذخیره اطلاعات تسویه ناموفق بود.', ErrorCodes.INTERNAL_ERROR, { statusCode: 500 });
    }
    return info;
  }

  payoutInfo(courier: CourierProfile): Record<string, string> | null {
    if (!courier.payoutInfoEncrypted) return null;
    try {
      const raw = JSON.parse(decryptSecret(courier.payoutInfoEncrypted, this.config.auth.encryptionKey)) as Record<string, string>;
      return {
        bankName: raw.bankName ?? '',
        ownerName: raw.ownerName ?? '',
        iban: raw.iban ? `IR****${raw.iban.slice(-4)}` : '',
      };
    } catch {
      return null;
    }
  }

  async dashboard(userId: string): Promise<CourierDashboard> {
    const courier = await this.requireCourier(userId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const activeMissions = await this.deliveries.find({ where: { courierId: courier.id } });
    const activeMission = activeMissions.find((mission) => ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_ATTEMPTED'].includes(mission.status)) ?? null;
    const availableOffers = activeMissions.filter((mission) => mission.status === 'OFFERED').length;
    const deliveredToday = activeMissions.filter(
      (mission) => mission.status === 'DELIVERED' && mission.deliveredAt && mission.deliveredAt >= startOfDay,
    );
    const earningsToday = deliveredToday.reduce((acc, mission) => acc + Number(mission.courierShare ?? 0), 0);

    const pendingRows = await this.payouts
      .createQueryBuilder('p')
      .select('SUM(p.netAmount)', 'total')
      .where('p.recipientType = :type', { type: 'courier' })
      .andWhere('p.recipientId = :id', { id: courier.id })
      .andWhere('p.status IN (:...statuses)', { statuses: ['PENDING', 'READY', 'PROCESSING'] })
      .getRawOne<{ total: string | null }>();

    return {
      profile: {
        id: courier.id,
        verificationStatus: courier.verificationStatus,
        availability: courier.availability,
        ratingAvg: courier.ratingAvg,
        completedDeliveries: courier.completedDeliveries,
      },
      activeMission: activeMission ? { id: activeMission.id, code: activeMission.code, status: activeMission.status } : null,
      availableOffers,
      today: { delivered: deliveredToday.length, earnings: earningsToday },
      pendingPayout: Number(pendingRows?.total ?? 0),
    };
  }

  async findById(id: string): Promise<CourierProfile | null> {
    return this.couriers.findOne({ where: { id } });
  }

  /** پاک‌سازی نمونه‌های موقعیت قدیمی (حریم خصوصی). */
  async cleanupLocations(retentionHours: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionHours * 3_600_000);
    const result = await this.locations.createQueryBuilder().delete().where('recordedAt < :cutoff', { cutoff }).execute();
    return result.affected ?? 0;
  }

  async locationsFor(deliveryId: string, requesterId: string, requesterRoles: string[]): Promise<CourierLocation[]> {
    const delivery = await this.deliveries.findOne({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('مأموریت');
    const isOwnerCourier = delivery.courierId === requesterId;
    const isStaff = requesterRoles.includes('admin') || requesterRoles.includes('operator');
    if (!isOwnerCourier && !isStaff) {
      // مکانیکِ همان سفارش هم مجاز است (بررسی در لایه کنترلر با شناسه سفارش انجام می‌شود)
      throw new AppException('دسترسی به موقعیت پیک برای شما مجاز نیست.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    return this.locations.find({ where: { deliveryId }, order: { recordedAt: 'DESC' }, take: 200 });
  }
}
