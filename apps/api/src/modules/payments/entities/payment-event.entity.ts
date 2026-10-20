import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/** رویدادهای درگاه پرداخت — برای پیگیری و رفع اختلاف (تکرار پاسخ درگاه، تأخیر و ...). */
@Entity('payment_events')
@Index(['paymentId', 'createdAt'])
export class PaymentEvent extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  paymentId!: string;

  @Column({ length: 64 })
  event!: string;

  @Column({ length: 16, default: 'internal' })
  source!: 'gateway' | 'internal' | 'webhook';

  @Column({ type: 'simple-json', nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
