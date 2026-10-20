import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { VerificationStatus } from '@carpart/contract';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import type { RequestUser } from '../../common/types/auth';
import { AuditService } from '../audit/audit.service';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Seller } from '../sellers/entities/seller.entity';
import { Workshop } from '../workshops/entities/workshop.entity';

export type VerificationKind = 'seller' | 'courier' | 'workshop';

export interface VerificationRow {
  kind: VerificationKind;
  id: string;
  userId: string;
  displayName: string;
  city: string | null;
  status: VerificationStatus;
  submittedAt: string;
  documents: Array<{ kind: string; fileUrl: string }> | null;
  summary: Record<string, unknown>;
}

/**
 * صف تأیید هویت فروشگاه‌ها، پیک‌ها و تعمیرگاه‌ها.
 *
 * هر تصمیم (تأیید/رد/تعلیق) در گزارش ممیزی با نام و نقش مدیر ثبت می‌شود و
 * نتیجه به‌صورت اعلان درون‌برنامه‌ای به کاربر اطلاع داده می‌شود.
 */
@Injectable()
export class VerificationsService {
  private readonly logger = new Logger(VerificationsService.name);

  constructor(
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
    @InjectRepository(Workshop) private readonly workshops: Repository<Workshop>,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async queue(kind: VerificationKind, status: VerificationStatus = 'PENDING_REVIEW'): Promise<VerificationRow[]> {
    if (kind === 'seller') {
      const rows = await this.sellers.find({ where: { verificationStatus: status }, order: { updatedAt: 'ASC' }, take: 100 });
      return rows.map((seller) => ({
        kind,
        id: seller.id,
        userId: seller.userId,
        displayName: seller.storeName,
        city: seller.city,
        status: seller.verificationStatus,
        submittedAt: seller.updatedAt.toISOString(),
        documents: seller.documents?.map((doc) => ({ kind: doc.kind, fileUrl: doc.fileUrl })) ?? null,
        summary: {
          // داده حساس به‌صورت پوشیده نمایش داده می‌شود
          nationalId: seller.nationalId ? `${seller.nationalId.slice(0, 4)}****` : null,
          phone: seller.phone,
          ratingAvg: seller.ratingAvg,
          commissionPercent: seller.commissionPercent,
        },
      }));
    }
    if (kind === 'courier') {
      const rows = await this.couriers.find({ where: { verificationStatus: status }, order: { updatedAt: 'ASC' }, take: 100 });
      return rows.map((courier) => ({
        kind,
        id: courier.id,
        userId: courier.userId,
        displayName: courier.vehiclePlate ? `پیک با پلاک ${courier.vehiclePlate}` : 'پیک',
        city: courier.serviceCity,
        status: courier.verificationStatus,
        submittedAt: courier.updatedAt.toISOString(),
        documents: courier.documents?.map((doc) => ({ kind: doc.kind, fileUrl: doc.fileUrl })) ?? null,
        summary: {
          vehicleType: courier.vehicleType,
          vehicleModel: courier.vehicleModel,
          capacityKg: courier.capacityKg,
          serviceRadiusKm: courier.serviceRadiusKm,
        },
      }));
    }
    const rows = await this.workshops.find({ where: { verificationStatus: status }, order: { updatedAt: 'ASC' }, take: 100 });
    return rows.map((workshop) => ({
      kind,
      id: workshop.id,
      userId: workshop.userId,
      displayName: workshop.name,
      city: workshop.city,
      status: workshop.verificationStatus,
      submittedAt: workshop.updatedAt.toISOString(),
      documents: null,
      summary: {
        ownerName: workshop.ownerName,
        phone: workshop.phone,
        addressText: workshop.addressText,
        hasLocation: workshop.lat !== null && workshop.lng !== null,
      },
    }));
  }

  async counts(): Promise<Record<VerificationKind, number>> {
    const [sellers, couriers, workshops] = await Promise.all([
      this.sellers.count({ where: { verificationStatus: In(['PENDING_REVIEW', 'DRAFT']) } }),
      this.couriers.count({ where: { verificationStatus: In(['PENDING_REVIEW', 'DRAFT']) } }),
      this.workshops.count({ where: { verificationStatus: In(['PENDING_REVIEW', 'DRAFT']) } }),
    ]);
    return { seller: sellers, courier: couriers, workshop: workshops };
  }

  async approve(actor: RequestUser, kind: VerificationKind, id: string, note?: string): Promise<{ ok: true; status: VerificationStatus }> {
    const target = await this.resolve(kind, id);
    target.verificationStatus = 'APPROVED';
    await this.persist(kind, target, note);
    await this.record(actor, `${kind}.verify_approve`, kind, id, `تأیید هویت ${this.kindFa(kind)}`, { note: note ?? null });
    await this.notify(target.userId, 'account.verified', id, note ?? 'حساب شما تأیید شد.');
    return { ok: true, status: 'APPROVED' };
  }

  async reject(actor: RequestUser, kind: VerificationKind, id: string, reason: string): Promise<{ ok: true; status: VerificationStatus }> {
    if (!reason?.trim()) {
      throw new AppException('دلیل رد درخواست الزامی است.', ErrorCodes.VALIDATION_FAILED);
    }
    const target = await this.resolve(kind, id);
    target.verificationStatus = 'REJECTED';
    await this.persist(kind, target, reason);
    await this.record(actor, `${kind}.verify_reject`, kind, id, `رد تأیید هویت ${this.kindFa(kind)}`, { reason });
    await this.notify(target.userId, 'account.rejected', id, reason);
    return { ok: true, status: 'REJECTED' };
  }

  async suspend(actor: RequestUser, kind: VerificationKind, id: string, reason: string): Promise<{ ok: true; status: VerificationStatus }> {
    if (!reason?.trim()) {
      throw new AppException('دلیل تعلیق الزامی است.', ErrorCodes.VALIDATION_FAILED);
    }
    const target = await this.resolve(kind, id);
    target.verificationStatus = 'SUSPENDED';
    await this.persist(kind, target, reason);
    await this.record(actor, `${kind}.suspend`, kind, id, `تعلیق ${this.kindFa(kind)}`, { reason });
    await this.notify(target.userId, 'account.rejected', id, reason);
    return { ok: true, status: 'SUSPENDED' };
  }

  private kindFa(kind: VerificationKind): string {
    if (kind === 'seller') return 'فروشگاه';
    if (kind === 'courier') return 'پیک';
    return 'تعمیرگاه';
  }

  private async resolve(kind: VerificationKind, id: string): Promise<Seller | CourierProfile | Workshop> {
    if (kind === 'seller') {
      const seller = await this.sellers.findOne({ where: { id } });
      if (!seller) throw new NotFoundException('فروشگاه');
      return seller;
    }
    if (kind === 'courier') {
      const courier = await this.couriers.findOne({ where: { id } });
      if (!courier) throw new NotFoundException('پیک');
      return courier;
    }
    const workshop = await this.workshops.findOne({ where: { id } });
    if (!workshop) throw new NotFoundException('تعمیرگاه');
    return workshop;
  }

  private async persist(kind: VerificationKind, target: Seller | CourierProfile | Workshop, note?: string): Promise<void> {
    if (kind === 'workshop') {
      const workshop = target as Workshop;
      workshop.verificationNote = note ?? workshop.verificationNote;
      await this.workshops.save(workshop);
      return;
    }
    if (kind === 'seller') {
      const seller = target as Seller;
      seller.verifiedAt = seller.verificationStatus === 'APPROVED' ? new Date() : seller.verifiedAt;
      seller.rejectionReason = seller.verificationStatus === 'APPROVED' ? null : (note ?? null);
      await this.sellers.save(seller);
      return;
    }
    const courier = target as CourierProfile;
    courier.verifiedAt = courier.verificationStatus === 'APPROVED' ? new Date() : courier.verifiedAt;
    courier.rejectionReason = courier.verificationStatus === 'APPROVED' ? null : (note ?? null);
    await this.couriers.save(courier);
  }

  private async record(
    actor: RequestUser,
    action: string,
    resource: string,
    resourceId: string,
    faDescription: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      action,
      resource,
      resourceId,
      faDescription,
      actor: { id: actor.id, mobile: actor.mobile, fullName: actor.fullName, roles: actor.roles },
      metadata,
    });
  }

  private async notify(userId: string, eventKey: string, subjectId: string, message: string): Promise<void> {
    await this.notifications
      .notify({ userId, eventKey, subjectId, vars: { message }, data: { verificationId: subjectId } })
      .catch((error) => this.logger.warn(`اعلان نتیجه تأیید ناموفق بود: ${(error as Error).message}`));
  }
}
