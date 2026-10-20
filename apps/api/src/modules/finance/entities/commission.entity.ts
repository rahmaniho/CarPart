import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';

/**
 * کارمزد و تسهیم مالی یک سفارش — در زمان قطعی‌شدن پرداخت ثبت می‌شود.
 * این جدول مبنای گزارش درآمد پلتفرم، سهم فروشنده و سهم پیک است و
 * «ارزش کل سفارش» با «درآمد پلتفرم» در آن تفکیک شده‌اند.
 */
@Entity('commissions')
export class Commission extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 36 })
  orderId!: string;

  @Index()
  @Column({ length: 36 })
  sellerId!: string;

  @Column({ length: 36 })
  branchId!: string;

  /** جمع اقلام سفارش (بدون ارسال و تخفیف) */
  @Column({ type: 'bigint', transformer: moneyTransformer })
  itemsTotal!: number;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  discountTotal!: number;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  deliveryFee!: number;

  /** مبلغ مبنای محاسبه کارمزد = اقلام - تخفیف */
  @Column({ type: 'bigint', transformer: moneyTransformer })
  commissionBase!: number;

  @Column({ type: 'float' })
  ratePercent!: number;

  /** سهم پلتفرم از فروش */
  @Column({ type: 'bigint', transformer: moneyTransformer })
  platformAmount!: number;

  /** خالص فروشنده از اقلام */
  @Column({ type: 'bigint', transformer: moneyTransformer })
  sellerNetAmount!: number;

  /** سهم پیک از هزینه ارسال */
  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  courierAmount!: number;

  /** سهم پلتفرم از هزینه ارسال */
  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  deliveryPlatformAmount!: number;

  @Column({ length: 16, default: 'recorded' })
  status!: 'recorded' | 'reversed' | 'pending';

  @Column({ type: 'varchar', length: 36, nullable: true })
  payoutId!: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  reversedAt!: Date | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  reversalReason!: string | null;

  /** شرح محاسبه برای حسابرسی (قاعده و منبع تنظیمات در زمان محاسبه) */
  @Column({ type: 'simple-json', nullable: true })
  calculation!: Record<string, unknown> | null;
}
