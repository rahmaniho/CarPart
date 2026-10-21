import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { QualityGrade, RequestStatus, UrgencyLevel } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';

export interface RequestVehicleSnapshot {
  makeName?: string | null;
  modelName?: string | null;
  variantName?: string | null;
  year?: number | null;
  engine?: string | null;
  plate?: string | null;
  vin?: string | null;
}

export interface RequestDeliverySnapshot {
  receiverName: string;
  phone: string;
  city?: string | null;
  addressText: string;
  lat?: number | null;
  lng?: number | null;
}

/**
 * درخواست تأمین قطعه (روش دوم سفارش‌گذاری).
 * مکانیک قطعه را توصیف می‌کند و سامانه آن را برای فروشندگان مرتبط ارسال می‌کند.
 * هر درخواست مهلت پاسخ دارد و پس از پایان مهلت به‌صورت شفاف بسته می‌شود.
 */
@Entity('part_requests')
@Index(['status', 'deadlineAt'])
@Index(['userId', 'createdAt'])
export class PartRequest extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 24 })
  code!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  workshopId!: string | null;

  @Index()
  @Column({ length: 32, default: 'OPEN' })
  status!: RequestStatus;

  @Column({ length: 200 })
  titleFa!: string;

  @Column({ length: 200 })
  partNameFa!: string;

  @Column({ type: 'varchar', length: 96, nullable: true })
  technicalCode!: string | null;

  @Column({ type: 'varchar', length: 96, nullable: true })
  oemCode!: string | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId!: string | null;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ length: 32, default: 'unknown' })
  qualityPreference!: QualityGrade;

  /** آیا فقط قطعه اصل پذیرفته می‌شود؟ */
  @Column({ default: false })
  onlyGenuine!: boolean;

  @Column({ length: 16, default: 'normal' })
  urgency!: UrgencyLevel;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  images!: string[] | null;

  @Column({ type: 'uuid', nullable: true })
  vehicleId!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  vehicleSnapshot!: RequestVehicleSnapshot | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: string | null;

  @Column({ type: 'uuid', nullable: true })
  deliveryAddressId!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  deliverySnapshot!: RequestDeliverySnapshot | null;

  /** زمان موردنیاز کاربر */
  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  neededBy!: Date | null;

  /** مهلت ارائه پیشنهاد توسط فروشندگان */
  @Index()
  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  deadlineAt!: Date | null;

  /** فروشندگانی که درخواست برای آن‌ها ارسال شد (برای حسابرسی و گزارش نرخ پاسخ) */
  @Column({ type: 'simple-json', nullable: true })
  targetedSellerIds!: string[] | null;

  @Column({ default: 0 })
  quoteCount!: number;

  @Column({ type: 'uuid', nullable: true })
  convertedOrderId!: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  closedAt!: Date | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  closeReason!: string | null;

  @Column({ type: 'text', nullable: true })
  searchKey!: string | null;
}
