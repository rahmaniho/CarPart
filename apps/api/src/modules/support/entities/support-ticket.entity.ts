import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { TicketStatus } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';

/** درخواست پشتیبانی / شکایت. */
@Entity('support_tickets')
@Index(['userId', 'status'])
@Index(['status', 'createdAt'])
export class SupportTicket extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 24 })
  code!: string;

  @Index()
  @Column({ length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  orderId!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  deliveryId!: string | null;

  @Column({ length: 200 })
  subject!: string;

  @Column({ length: 48, default: 'general' })
  category!: 'general' | 'order' | 'payment' | 'delivery' | 'part_mismatch' | 'seller' | 'courier' | 'technical';

  @Index()
  @Column({ length: 32, default: 'OPEN' })
  status!: TicketStatus;

  @Column({ length: 16, default: 'normal' })
  priority!: 'low' | 'normal' | 'high' | 'critical';

  @Column({ type: 'varchar', length: 36, nullable: true })
  assignedTo!: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  lastMessageAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  closedAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  satisfactionRating!: number | null;
}
