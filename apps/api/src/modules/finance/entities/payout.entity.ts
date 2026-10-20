import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { PayoutRecipientType, PayoutStatus } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';

/** تسویه با فروشنده یا پیک بر اساس سیاست مالی و وضعیت واقعی تراکنش‌ها. */
@Entity('payouts')
@Index(['recipientType', 'recipientId', 'status'])
export class Payout extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 24 })
  code!: string;

  @Column({ length: 16 })
  recipientType!: PayoutRecipientType;

  @Index()
  @Column({ length: 36 })
  recipientId!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  recipientName!: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  periodFrom!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  periodTo!: Date | null;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  grossAmount!: number;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  deductions!: number;

  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  netAmount!: number;

  @Index()
  @Column({ length: 32, default: 'PENDING' })
  status!: PayoutStatus;

  @Column({ type: 'varchar', length: 32, nullable: true })
  method!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  reference!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  processedBy!: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  processedAt!: Date | null;

  /** کلید یکتاسازی برای جلوگیری از تسویه تکراری در یک دوره */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160, nullable: true })
  idempotencyKey!: string | null;
}
