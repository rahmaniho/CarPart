import { Column, Entity, Index, VersionColumn } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { OrderStatus, PaymentStatus } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';
import type { RequestDeliverySnapshot, RequestVehicleSnapshot } from '../../requests/entities/part-request.entity';

/**
 * سفارش.
 *
 * محدودیت نسخه جاری (مستند): هر سفارش فقط از یک فروشگاه تأمین و با یک مأموریت ارسال تحویل می‌شود.
 * ستون parentOrderId برای ساختار آینده «سفارش اصلی + سفارش فروشگاهی فرعی» رزرو شده است
 * تا بدون شکستن داده‌های موجود، خرید چندفروشگاهی اضافه شود.
 */
@Entity('orders')
@Index(['userId', 'createdAt'])
@Index(['sellerId', 'status'])
@Index(['branchId', 'status'])
@Index(['status', 'createdAt'])
export class Order extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 24 })
  code!: string;

  @Index()
  @Column({ length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  workshopId!: string | null;

  @Index()
  @Column({ length: 36 })
  sellerId!: string;

  @Index()
  @Column({ length: 36 })
  branchId!: string;

  @Index()
  @Column({ length: 32, default: 'DRAFT' })
  status!: OrderStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  requestId!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  quoteId!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  parentOrderId!: string | null;

  /** منبع سفارش: خرید مستقیم از کاتالوگ یا انتخاب پیشنهاد */
  @Column({ length: 16, default: 'direct' })
  source!: 'direct' | 'request';

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: string | null;

  /* ------------------------------- مبالغ ------------------------------- */
  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  itemsSubtotal!: number;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  deliveryFee!: number;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  discountTotal!: number;

  /** کارمزد پلتفرم (سهم پلتفرم از این سفارش) — در زمان قطعی‌شدن قیمت محاسبه و ثبت می‌شود */
  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  platformFee!: number;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  payableTotal!: number;

  @Column({ length: 8, default: 'IRT' })
  currency!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  couponCode!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  couponId!: string | null;

  /* ------------------------------ پرداخت ------------------------------ */
  @Column({ type: 'varchar', length: 32, nullable: true })
  paymentStatus!: PaymentStatus | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  paymentId!: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  paidAt!: Date | null;

  /* ------------------------- اطلاعات تحویل ------------------------- */
  @Column({ type: 'varchar', length: 36, nullable: true })
  deliveryAddressId!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  addressSnapshot!: RequestDeliverySnapshot | null;

  @Column({ type: 'simple-json', nullable: true })
  vehicleSnapshot!: RequestVehicleSnapshot | null;

  @Column({ length: 16, default: 'normal' })
  urgency!: 'normal' | 'urgent' | 'critical';

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** زمان تقریبی آماده شدن نزد فروشنده */
  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  expectedReadyAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  expectedDeliveryAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  deliveredAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  completedAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cancelReason!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cancelActor!: string | null;

  /** کلید یکتاسازی برای جلوگیری از ثبت سفارش تکراری */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, nullable: true })
  idempotencyKey!: string | null;

  @VersionColumn()
  version!: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBy!: string | null;
}
