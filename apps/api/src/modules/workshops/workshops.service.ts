import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { Workshop } from './entities/workshop.entity';
import { WorkshopAddress } from './entities/workshop-address.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Favorite, type FavoriteKind } from './entities/favorite.entity';
import { VehicleModel, VehicleVariant } from '../catalog/entities/vehicle-catalog.entity';
import { ToggleFavoriteDto, UpsertAddressDto, UpsertVehicleDto, UpsertWorkshopDto } from './dto/workshop.dto';

/** مدیریت پروفایل تعمیرگاه، آدرس‌های تحویل، خودروهای ذخیره‌شده و علاقه‌مندی‌ها. */
@Injectable()
export class WorkshopsService {
  constructor(
    @InjectRepository(Workshop) private readonly workshops: Repository<Workshop>,
    @InjectRepository(WorkshopAddress) private readonly addresses: Repository<WorkshopAddress>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(VehicleModel) private readonly models: Repository<VehicleModel>,
    @InjectRepository(VehicleVariant) private readonly variants: Repository<VehicleVariant>,
  ) {}

  async findByUserId(userId: string): Promise<Workshop | null> {
    return this.workshops.findOne({ where: { userId } });
  }

  async requireWorkshop(userId: string): Promise<Workshop> {
    const workshop = await this.workshops.findOne({ where: { userId } });
    if (!workshop) {
      throw new AppException(
        'پروفایل تعمیرگاه شما کامل نیست. ابتدا اطلاعات تعمیرگاه را ثبت کنید.',
        ErrorCodes.PROFILE_INCOMPLETE,
        { statusCode: 409 },
      );
    }
    return workshop;
  }

  async getOrCreate(userId: string): Promise<Workshop> {
    const existing = await this.workshops.findOne({ where: { userId } });
    if (existing) return existing;
    return this.workshops.save(
      this.workshops.create({
        userId,
        name: 'تعمیرگاه من',
        verificationStatus: 'DRAFT',
        isActive: true,
      }),
    );
  }

  async upsert(userId: string, dto: UpsertWorkshopDto): Promise<Workshop> {
    const workshop = await this.getOrCreate(userId);
    const before = { ...workshop };
    Object.assign(workshop, {
      name: dto.name,
      ownerName: dto.ownerName ?? workshop.ownerName,
      phone: dto.phone ?? workshop.phone,
      nationalId: dto.nationalId ?? workshop.nationalId,
      taxCode: dto.taxCode ?? workshop.taxCode,
      city: dto.city ?? workshop.city,
      addressText: dto.addressText ?? workshop.addressText,
      lat: dto.lat !== undefined ? dto.lat : workshop.lat,
      lng: dto.lng !== undefined ? dto.lng : workshop.lng,
      logoUrl: dto.logoUrl ?? workshop.logoUrl,
      description: dto.description ?? workshop.description,
      specialties: dto.specialties ?? workshop.specialties,
    });
    // پس از ویرایش اطلاعات هویتی/موقعیت، وضعیت تأیید به بررسی مجدد بازمی‌گردد
    if (workshop.verificationStatus === 'APPROVED' && this.needsReview(before, workshop)) {
      workshop.verificationStatus = 'PENDING_REVIEW';
    }
    return this.workshops.save(workshop);
  }

  private needsReview(before: Workshop, after: Workshop): boolean {
    return (
      before.nationalId !== after.nationalId ||
      before.lat !== after.lat ||
      before.lng !== after.lng ||
      before.city !== after.city ||
      before.name !== after.name
    );
  }

  /** ارسال پروفایل برای تأیید مدیر. */
  async submitForReview(userId: string): Promise<Workshop> {
    const workshop = await this.requireWorkshop(userId);
    if (!workshop.name || !workshop.city || !workshop.addressText || workshop.lat === null || workshop.lng === null) {
      throw new AppException(
        'برای ارسال درخواست تأیید، نام تعمیرگاه، شهر، آدرس و موقعیت روی نقشه باید کامل باشد.',
        ErrorCodes.PROFILE_INCOMPLETE,
        { statusCode: 409 },
      );
    }
    workshop.verificationStatus = 'PENDING_REVIEW';
    return this.workshops.save(workshop);
  }

  /* ------------------------------ آدرس‌ها ------------------------------ */

  async listAddresses(userId: string): Promise<WorkshopAddress[]> {
    const workshop = await this.requireWorkshop(userId);
    return this.addresses.find({ where: { workshopId: workshop.id, isActive: true }, order: { isDefault: 'DESC', createdAt: 'DESC' } });
  }

  async createAddress(userId: string, dto: UpsertAddressDto): Promise<WorkshopAddress> {
    const workshop = await this.requireWorkshop(userId);
    const count = await this.addresses.count({ where: { workshopId: workshop.id, isActive: true } });
    const entity = this.addresses.create({
      workshopId: workshop.id,
      title: dto.title,
      receiverName: dto.receiverName,
      phone: dto.phone,
      city: dto.city ?? workshop.city,
      addressText: dto.addressText,
      postalCode: dto.postalCode ?? null,
      lat: dto.lat ?? workshop.lat,
      lng: dto.lng ?? workshop.lng,
      isDefault: dto.isDefault ?? count === 0,
      isActive: true,
    });
    const saved = await this.addresses.save(entity);
    if (saved.isDefault) await this.clearOtherDefaults(workshop.id, saved.id);
    return saved;
  }

  async updateAddress(userId: string, addressId: string, dto: Partial<UpsertAddressDto> & { isActive?: boolean }): Promise<WorkshopAddress> {
    const workshop = await this.requireWorkshop(userId);
    const address = await this.addresses.findOne({ where: { id: addressId, workshopId: workshop.id } });
    if (!address) throw new NotFoundException('آدرس');
    Object.assign(address, dto);
    const saved = await this.addresses.save(address);
    if (saved.isDefault) await this.clearOtherDefaults(workshop.id, saved.id);
    return saved;
  }

  async deleteAddress(userId: string, addressId: string): Promise<{ ok: true }> {
    const workshop = await this.requireWorkshop(userId);
    const address = await this.addresses.findOne({ where: { id: addressId, workshopId: workshop.id } });
    if (!address) throw new NotFoundException('آدرس');
    address.isActive = false;
    await this.addresses.save(address);
    return { ok: true };
  }

  private async clearOtherDefaults(workshopId: string, keepId: string): Promise<void> {
    await this.addresses.update({ workshopId, id: Not(keepId), isDefault: true }, { isDefault: false });
  }

  async findAddress(userId: string, addressId: string): Promise<WorkshopAddress> {
    const workshop = await this.requireWorkshop(userId);
    const address = await this.addresses.findOne({ where: { id: addressId, workshopId: workshop.id, isActive: true } });
    if (!address) throw new NotFoundException('آدرس تحویل');
    return address;
  }

  /* ------------------------------ خودروها ------------------------------ */

  async listVehicles(userId: string): Promise<Vehicle[]> {
    const workshop = await this.requireWorkshop(userId);
    return this.vehicles.find({
      where: { workshopId: workshop.id, isActive: true },
      order: { isPrimary: 'DESC', createdAt: 'DESC' },
      relations: { model: { make: true }, variant: true },
    });
  }

  async createVehicle(userId: string, dto: UpsertVehicleDto): Promise<Vehicle> {
    const workshop = await this.requireWorkshop(userId);
    if (!dto.modelId && !dto.freeModelName) {
      throw new AppException('مدل خودرو را از فهرست انتخاب کنید یا نام آن را وارد کنید.', ErrorCodes.VALIDATION_FAILED);
    }
    if (dto.modelId) {
      const model = await this.models.findOne({ where: { id: dto.modelId } });
      if (!model) throw new NotFoundException('مدل خودرو');
    }
    if (dto.variantId) {
      const variant = await this.variants.findOne({ where: { id: dto.variantId } });
      if (!variant) throw new NotFoundException('تیپ خودرو');
    }
    const count = await this.vehicles.count({ where: { workshopId: workshop.id, isActive: true } });
    const entity = this.vehicles.create({
      workshopId: workshop.id,
      nickname: dto.nickname ?? null,
      modelId: dto.modelId ?? null,
      variantId: dto.variantId ?? null,
      freeMakeName: dto.freeMakeName ?? null,
      freeModelName: dto.freeModelName ?? null,
      vehicleType: dto.vehicleType ?? 'car',
      yearFrom: dto.yearFrom ?? null,
      yearTo: dto.yearTo ?? null,
      engine: dto.engine ?? null,
      gearbox: dto.gearbox ?? null,
      plate: dto.plate ?? null,
      vin: dto.vin ?? null,
      isPrimary: dto.isPrimary ?? count === 0,
      isActive: true,
    });
    const saved = await this.vehicles.save(entity);
    if (saved.isPrimary) await this.vehicles.update({ workshopId: workshop.id, id: Not(saved.id) }, { isPrimary: false });
    return saved;
  }

  async updateVehicle(userId: string, vehicleId: string, dto: Partial<UpsertVehicleDto> & { isActive?: boolean }): Promise<Vehicle> {
    const workshop = await this.requireWorkshop(userId);
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, workshopId: workshop.id } });
    if (!vehicle) throw new NotFoundException('خودرو');
    Object.assign(vehicle, dto);
    const saved = await this.vehicles.save(vehicle);
    if (saved.isPrimary) await this.vehicles.update({ workshopId: workshop.id, id: Not(saved.id) }, { isPrimary: false });
    return saved;
  }

  async deleteVehicle(userId: string, vehicleId: string): Promise<{ ok: true }> {
    const workshop = await this.requireWorkshop(userId);
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, workshopId: workshop.id } });
    if (!vehicle) throw new NotFoundException('خودرو');
    vehicle.isActive = false;
    await this.vehicles.save(vehicle);
    return { ok: true };
  }

  /* --------------------------- علاقه‌مندی‌ها --------------------------- */

  async listFavorites(userId: string, kind?: FavoriteKind): Promise<Favorite[]> {
    return this.favorites.find({
      where: kind ? { userId, kind } : { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async addFavorite(userId: string, dto: ToggleFavoriteDto): Promise<Favorite> {
    const existing = await this.favorites.findOne({ where: { userId, kind: dto.kind, refId: dto.refId } });
    if (existing) return existing;
    return this.favorites.save(
      this.favorites.create({
        userId,
        kind: dto.kind,
        refId: dto.refId,
        label: dto.label ?? null,
        snapshot: dto.snapshot ?? null,
      }),
    );
  }

  async removeFavorite(userId: string, kind: FavoriteKind, refId: string): Promise<{ ok: true }> {
    await this.favorites.delete({ userId, kind, refId });
    return { ok: true };
  }
}
