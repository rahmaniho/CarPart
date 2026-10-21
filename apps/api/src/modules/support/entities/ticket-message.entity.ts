import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/** پیام‌های یک تیکت — شامل پیام‌های داخلی که به کاربر نمایش داده نمی‌شوند. */
@Entity('ticket_messages')
@Index(['ticketId', 'createdAt'])
export class TicketMessage extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  ticketId!: string;

  @Column({ type: 'uuid', nullable: true })
  authorId!: string | null;

  @Column({ length: 16, default: 'user' })
  authorType!: 'user' | 'staff' | 'system';

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments!: string[] | null;

  @Column({ default: false })
  isInternal!: boolean;
}
