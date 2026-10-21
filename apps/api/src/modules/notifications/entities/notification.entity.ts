import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { NotificationChannel, Tone } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';

/** اعلان درون‌برنامه‌ای کاربر. */
@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['userId', 'createdAt'])
export class Notification extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ length: 16, default: 'inapp' })
  channel!: NotificationChannel;

  /** کلید رویداد، مانند order.status_changed */
  @Index()
  @Column({ length: 96 })
  eventKey!: string;

  @Column({ length: 200 })
  titleFa!: string;

  @Column({ type: 'text', nullable: true })
  bodyFa!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  data!: Record<string, unknown> | null;

  /** لینک داخلی برای کلیک روی اعلان */
  @Column({ type: 'varchar', length: 300, nullable: true })
  link!: string | null;

  @Column({ length: 16, default: 'info' })
  tone!: Tone;

  @Column({ default: false })
  isRead!: boolean;

  /** وضعیت ارسال برای کانال‌های برون‌سازمانی (پیامک/ایمیل) */
  @Column({ length: 16, default: 'sent' })
  status!: 'pending' | 'sent' | 'failed';

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  sentAt!: Date | null;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  error!: string | null;

  /** آیا این اعلان در حالت آزمایشی ارسال شده است (پیامک/ایمیل Mock) */
  @Column({ default: false })
  isSimulated!: boolean;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  readAt!: Date | null;

  /**
   * کلید یکتاسازی برای جلوگیری از اعلان تکراری هنگام پردازش مجدد یک رویداد.
   * مثال: order:ORDER_ID:status:PICKED_UP
   */
  @Index({ unique: true })
  @Column({ length: 190 })
  dedupeKey!: string;
}
