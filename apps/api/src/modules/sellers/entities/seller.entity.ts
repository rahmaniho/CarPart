import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { VerificationStatus } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';

/** فروشنده لوازم یدکی (شخص حقوقی/حقیقی دارای فروشگاه). */
@Entity('sellers')
export class Seller extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId!: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ length: 200 })
  storeName!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  legalName!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  nationalId!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  taxCode!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  logoUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** مدارک و اطلاعات هویتی/تجاری (فایل‌های بارگذاری‌شده) */
  @Column({ type: 'simple-json', nullable: true })
  documents!: Array<{ kind: string; fileUrl: string; uploadedAt: string; status?: string }> | null;

  /** اطلاعات دریافت تسویه — رمزنگاری‌شده نگهداری می‌شود */
  @Column({ type: 'text', nullable: true })
  payoutInfoEncrypted!: string | null;

  @Index()
  @Column({ length: 32, default: 'DRAFT' })
  verificationStatus!: VerificationStatus;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason!: string | null;

  /**
   * کارمزد اختصاصی این فروشنده (درصد). اگر null باشد، کارمزد پیش‌فرض سامانه اعمال می‌شود.
   * شفافیت: رتبه‌بندی پیشنهادها بر اساس کارمزد تغییر پنهانی نمی‌کند (موتور رتبه‌بندی مستند است).
   */
  @Column({ type: 'float', nullable: true })
  commissionPercent!: number | null;

  @Column({ type: 'float', default: 0 })
  ratingAvg!: number;

  @Column({ default: 0 })
  ratingCount!: number;

  @Column({ default: 0 })
  completedOrders!: number;

  @Column({ default: 0 })
  cancelledOrders!: number;

  /** میانگین زمان پاسخ به درخواست تأمین (دقیقه) — از داده واقعی محاسبه می‌شود */
  @Column({ type: 'float', nullable: true })
  avgResponseMinutes!: number | null;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  subscriptionExpiresAt!: Date | null;
}
