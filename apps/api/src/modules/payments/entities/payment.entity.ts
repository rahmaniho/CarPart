import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { PaymentMode, PaymentStatus } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';

/**
 * تراکنش پرداخت.
 * هیچ داده محرمانه کارت بانکی ذخیره نمی‌شود؛ فقط شناسه‌های مرجع درگاه.
 */
@Entity('payments')
@Index(['orderId', 'status'])
export class Payment extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  orderId!: string;

  @Index()
  @Column({ length: 36 })
  userId!: string;

  /** شناسه درگاه: sandbox | zarinpal | ... */
  @Column({ length: 32 })
  provider!: string;

  /**
   * حالت درگاه. این مقدار باید در همه رابط‌ها نمایش داده شود تا
   * پرداخت آزمایشی هرگز با پرداخت واقعی اشتباه گرفته نشود.
   */
  @Column({ length: 16, default: 'sandbox' })
  mode!: PaymentMode;

  @Column({ type: 'bigint', transformer: moneyTransformer })
  amount!: number;

  @Index()
  @Column({ length: 32, default: 'CREATED' })
  status!: PaymentStatus;

  /** شناسه یکتای تراکنش در درگاه (تا پیش از تأیید، خالی است) */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  referenceId!: string | null;

  /** شناسه/authority درگاه پرداخت */
  @Column({ type: 'varchar', length: 128, nullable: true })
  gatewayAuthority!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gatewayTrackingNumber!: string | null;

  /** کلید یکتاسازی برای جلوگیری از ایجاد پرداخت تکراری */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160, nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  requestPayload!: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  verifyPayload!: Record<string, unknown> | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  expiresAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  failureCode!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  failureReason!: string | null;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  refundedAmount!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  cardPanMasked!: string | null;
}
