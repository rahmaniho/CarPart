import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { RefundStatus } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';

/** درخواست/اجرای بازپرداخت. مبالغ همیشه عدد صحیح تومان و قابل حسابرسی هستند. */
@Entity('refunds')
@Index(['orderId', 'status'])
export class Refund extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  paymentId!: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'bigint', transformer: moneyTransformer })
  amount!: number;

  @Index()
  @Column({ length: 32, default: 'REQUESTED' })
  status!: RefundStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'uuid', nullable: true })
  requestedBy!: string | null;

  @Column({ type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  providerRef!: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  requestedAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  resolvedAt!: Date | null;

  /** کلید یکتاسازی برای جلوگیری از بازپرداخت تکراری */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160, nullable: true })
  idempotencyKey!: string | null;
}
