import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { CourierAvailability, VerificationStatus } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';

export type CourierVehicleType = 'motorcycle' | 'car' | 'pickup' | 'van';

/** پروفایل پیک/راننده. */
@Entity('courier_profiles')
export class CourierProfile extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 36 })
  userId!: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 32, nullable: true })
  nationalId!: string | null;

  @Column({ length: 32, default: 'motorcycle' })
  vehicleType!: CourierVehicleType;

  @Column({ type: 'varchar', length: 120, nullable: true })
  vehicleModel!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  vehiclePlate!: string | null;

  /** ظرفیت بار (کیلوگرم) و حجم (لیتر) — برای تخصیص هوشمند مأموریت */
  @Column({ default: 15 })
  capacityKg!: number;

  @Column({ default: 40 })
  capacityLiters!: number;

  @Index()
  @Column({ length: 32, default: 'offline' })
  availability!: CourierAvailability;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  serviceCity!: string | null;

  @Column({ default: 20 })
  serviceRadiusKm!: number;

  @Column({ type: 'float', nullable: true })
  currentLat!: number | null;

  @Column({ type: 'float', nullable: true })
  currentLng!: number | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  locationUpdatedAt!: Date | null;

  @Column({ length: 32, default: 'DRAFT' })
  verificationStatus!: VerificationStatus;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  verifiedBy!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  documents!: Array<{ kind: string; fileUrl: string; uploadedAt: string; status?: string }> | null;

  /** اطلاعات حساب بانکی برای تسویه — رمزنگاری‌شده */
  @Column({ type: 'text', nullable: true })
  payoutInfoEncrypted!: string | null;

  @Column({ type: 'float', default: 0 })
  ratingAvg!: number;

  @Column({ default: 0 })
  ratingCount!: number;

  @Column({ default: 0 })
  completedDeliveries!: number;

  @Column({ default: 0 })
  rejectedOffers!: number;

  @Column({ default: 0 })
  cancelledDeliveries!: number;

  @Column({ default: 0 })
  activeDeliveries!: number;

  /** حداکثر مأموریت هم‌زمان */
  @Column({ default: 1 })
  maxConcurrentDeliveries!: number;

  @Column({ default: true })
  isActive!: boolean;
}
