import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ProfileKind, RequestUser } from '../../common/types/auth';
import type { Role } from '@carpart/contract';
import { permissionsOf } from '@carpart/contract';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { Workshop } from '../workshops/entities/workshop.entity';
import { User } from '../users/entities/user.entity';

export interface ProfileSummary {
  profileId: string | null;
  profileKind: ProfileKind;
  verificationStatus: string | null;
  displayName: string | null;
  city: string | null;
  isActive: boolean;
}

/**
 * حل‌کننده پروفایل تجاری کاربر.
 * احراز هویت به یک نقطه واحد نیاز دارد تا بداند کاربر مکانیک/فروشنده/پیک است و وضعیت تأییدش چیست.
 */
@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Workshop) private readonly workshops: Repository<Workshop>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
  ) {}

  static primaryKind(roles: Role[]): ProfileKind {
    if (roles.includes('seller')) return 'seller';
    if (roles.includes('courier')) return 'courier';
    if (roles.includes('mechanic')) return 'workshop';
    return null;
  }

  async summaryFor(user: User): Promise<ProfileSummary> {
    const kind = ProfilesService.primaryKind(user.roles ?? []);
    if (kind === 'workshop') {
      const workshop = await this.workshops.findOne({ where: { userId: user.id } });
      return {
        profileId: workshop?.id ?? null,
        profileKind: 'workshop',
        verificationStatus: workshop?.verificationStatus ?? null,
        displayName: workshop?.name ?? null,
        city: workshop?.city ?? user.city ?? null,
        isActive: workshop?.isActive ?? true,
      };
    }
    if (kind === 'seller') {
      const seller = await this.sellers.findOne({ where: { userId: user.id } });
      return {
        profileId: seller?.id ?? null,
        profileKind: 'seller',
        verificationStatus: seller?.verificationStatus ?? null,
        displayName: seller?.storeName ?? null,
        city: seller?.city ?? user.city ?? null,
        isActive: seller?.isActive ?? true,
      };
    }
    if (kind === 'courier') {
      const courier = await this.couriers.findOne({ where: { userId: user.id } });
      return {
        profileId: courier?.id ?? null,
        profileKind: 'courier',
        verificationStatus: courier?.verificationStatus ?? null,
        displayName: courier?.vehicleModel ?? null,
        city: courier?.serviceCity ?? user.city ?? null,
        isActive: courier?.isActive ?? true,
      };
    }
    return {
      profileId: null,
      profileKind: null,
      verificationStatus: null,
      displayName: null,
      city: user.city ?? null,
      isActive: user.isActive,
    };
  }

  /** ساخت RequestUser کامل (برای JwtAuthGuard). */
  async toRequestUser(user: User, sessionId: string): Promise<RequestUser> {
    const summary = await this.summaryFor(user);
    return {
      id: user.id,
      mobile: user.mobile,
      fullName: user.fullName,
      roles: user.roles ?? [],
      permissions: permissionsOf(user.roles ?? []),
      sessionId,
      profileId: summary.profileId,
      profileKind: summary.profileKind,
      verificationStatus: summary.verificationStatus,
      isActive: user.isActive && summary.isActive,
      city: summary.city,
    };
  }
}
