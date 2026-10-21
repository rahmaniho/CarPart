import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, VersionColumn } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { OrderStatus, PaymentStatus } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';
import type { RequestDeliverySnapshot, RequestVehicleSnapshot } from '../../requests/entities/part-request.entity';

/**
 * سفارش. سفارش‌های `parent` تجمیع مالی مشتری هستند و فروشنده/شعبه ندارند؛
 * هر بسته‌ی `child` مرز مستقل موجودی، کمیسیون، وضعیت و ارسال یک فروشنده است.
 * سفارش‌های قدیمی و خریدهای تک‌فروشنده‌ای با نوع `single` سازگار می‌مانند.
 */
@Entity('orders')
@Check(
  'CHK_orders_kind_shape',
  `("orderKind" = 'parent' AND "sellerId" IS NULL AND "branchId" IS NULL AND "parentOrderId" IS NULL)
   OR ("orderKind" = 'child' AND "sellerId" IS NOT NULL AND "branchId" IS NOT NULL AND "parentOrderId" IS NOT NULL)
   OR ("orderKind" = 'single' AND "sellerId" IS NOT NULL AND "branchId" IS NOT NULL AND "parentOrderId" IS NULL)`,
)
@Index(['userId', 'createdAt'])
@Index(['sellerId', 'status'])
@Index(['branchId', 'status'])
@Index(['status', 'createdAt'])
export class Order extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 24 })
  code!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  workshopId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  sellerId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  branchId!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'single' })
  orderKind!: 'single' | 'parent' | 'child';

  @Index()
  @Column({ length: 32, default: 'DRAFT' })
  status!: OrderStatus;

  @Column({ type: 'uuid', nullable: true })
  requestId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  quoteId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  parentOrderId!: string | null;

  @ManyToOne(() => Order, (order) => order.childOrders, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parentOrderId', foreignKeyConstraintName: 'FK_orders_parent_order' })
  parentOrder?: Order | null;

  @OneToMany(() => Order, (order) => order.parentOrder)
  childOrders?: Order[];

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

  @Column({ type: 'uuid', nullable: true })
  couponId!: string | null;

  /* ------------------------------ پرداخت ------------------------------ */
  @Column({ type: 'varchar', length: 32, nullable: true })
  paymentStatus!: PaymentStatus | null;

  @Column({ type: 'uuid', nullable: true })
  paymentId!: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  paidAt!: Date | null;

  /** پایان اتمیک اثرهای محلی پرداخت: کسر موجودی و ثبت کمیسیون بسته. */
  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  paidEffectsAppliedAt!: Date | null;

  /* ------------------------- اطلاعات تحویل ------------------------- */
  @Column({ type: 'uuid', nullable: true })
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

  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;
}
