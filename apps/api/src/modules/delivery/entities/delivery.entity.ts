import { Column, Entity, Index, VersionColumn } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { DeliveryStatus } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';

export interface DeliveryPoint {
  title: string;
  receiverName?: string | null;
  phone?: string | null;
  city?: string | null;
  addressText: string;
  lat: number | null;
  lng: number | null;
}

/**
 * مأموریت ارسال (لجستیک).
 * اطلاعات تماس گیرنده تا زمان پذیرش مأموریت به پیک نمایش داده نمی‌شود (حریم خصوصی حداقلی).
 */
@Entity('deliveries')
@Index(['status', 'createdAt'])
@Index(['courierId', 'status'])
export class Delivery extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 24 })
  code!: string;

  /** در نسخه جاری هر سفارش یک مأموریت فعال دارد. */
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  orderId!: string;

  @Index()
  @Column({ type: 'uuid' })
  sellerBranchId!: string;

  @Column({ type: 'uuid' })
  sellerId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  courierId!: string | null;

  @Index()
  @Column({ length: 32, default: 'PENDING_ASSIGNMENT' })
  status!: DeliveryStatus;

  @Column({ type: 'simple-json' })
  pickupPoint!: DeliveryPoint;

  @Column({ type: 'simple-json' })
  dropoffPoint!: DeliveryPoint;

  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: string | null;

  /** مسافت تخمینی مسیر (کیلومتر) — از لایه نقشه، نه فاصله مستقیم */
  @Column({ type: 'float', nullable: true })
  distanceKm!: number | null;

  @Column({ type: 'int', nullable: true })
  estimatedMinutes!: number | null;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  deliveryFee!: number;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  courierShare!: number;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  platformShare!: number;

  @Column({ default: 0 })
  offerCount!: number;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  offeredAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  offerExpiresAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  arrivedAtSellerAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  pickedUpAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  deliveredAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  cancelledAt!: Date | null;

  /** کد دریافت از فروشگاه (رمزنگاری‌شده) — پیک برای تحویل گرفتن بسته آن را وارد می‌کند */
  @Column({ type: 'text', nullable: true })
  pickupCodeEncrypted!: string | null;

  /** کد تأیید تحویل (رمزنگاری‌شده) — گیرنده به پیک می‌دهد تا تحویل جعل نشود */
  @Column({ type: 'text', nullable: true })
  deliveryOtpEncrypted!: string | null;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  lastFailureReason!: string | null;

  @Column({ type: 'text', nullable: true })
  proofImageUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  proofNote!: string | null;

  /** وزن/حجم تقریبی محموله برای بررسی ظرفیت پیک */
  @Column({ type: 'float', default: 2 })
  estimatedWeightKg!: number;

  @Column({ default: false })
  isUrgent!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** پیک‌هایی که پیش‌تر پیشنهاد را رد کرده یا مهلتشان تمام شده است (برای تخصیص مجدد) */
  @Column({ type: 'simple-json', nullable: true })
  excludedCourierIds!: string[] | null;

  @VersionColumn()
  version!: number;
}
