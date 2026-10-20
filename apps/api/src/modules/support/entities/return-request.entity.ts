import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { ReturnStatus } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';

/** درخواست مرجوعی / رسیدگی به قطعه مغایر یا معیوب. */
@Entity('return_requests')
@Index(['orderId', 'status'])
@Index(['userId', 'createdAt'])
export class ReturnRequest extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 24 })
  code!: string;

  @Index()
  @Column({ length: 36 })
  orderId!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  orderItemId!: string | null;

  @Index()
  @Column({ length: 36 })
  userId!: string;

  @Index()
  @Column({ length: 36 })
  sellerId!: string;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ length: 64 })
  reason!: 'mismatch' | 'defective' | 'wrong_part' | 'damaged' | 'not_needed' | 'late_delivery' | 'other';

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  images!: string[] | null;

  @Index()
  @Column({ length: 32, default: 'REQUESTED' })
  status!: ReturnStatus;

  @Column({ type: 'bigint', nullable: true, transformer: moneyTransformer })
  refundAmount!: number | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  sellerRespondedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  sellerResponseNote!: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  resolutionNote!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  refundId!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  handledBy!: string | null;
}
