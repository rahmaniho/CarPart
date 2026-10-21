import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { QuoteStatus } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';
import { PartRequest } from './part-request.entity';
import { QuoteItem } from './quote-item.entity';

/**
 * پیشنهاد قیمت فروشنده روی یک درخواست تأمین.
 * همه مبالغ عدد صحیح تومان هستند تا امکان مقایسه دقیق و بدون خطای گردکردن وجود داشته باشد.
 */
@Entity('quotes')
@Index(['requestId', 'status'])
@Index(['sellerId', 'createdAt'])
export class Quote extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  requestId!: string;

  @ManyToOne(() => PartRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request!: PartRequest;

  @Index()
  @Column({ type: 'uuid' })
  sellerId!: string;

  @Column({ type: 'uuid' })
  branchId!: string;

  @Index()
  @Column({ length: 32, default: 'SUBMITTED' })
  status!: QuoteStatus;

  @OneToMany(() => QuoteItem, (item) => item.quote, { cascade: true })
  items!: QuoteItem[];

  /** جمع قیمت اقلام (تومان) */
  @Column({ type: 'bigint', transformer: moneyTransformer })
  itemsTotal!: number;

  /** هزینه ارسال پیشنهادی فروشنده یا محاسبه‌شده توسط سامانه (تومان) */
  @Column({ type: 'bigint', default: 0, transformer: moneyTransformer })
  deliveryFee!: number;

  /** مبلغ نهایی = اقلام + ارسال */
  @Column({ type: 'bigint', transformer: moneyTransformer })
  total!: number;

  @Column({ default: 30 })
  preparationMinutes!: number;

  /** تخمین زمان تحویل (دقیقه) — از لایه نقشه/مسیر، نه فاصله مستقیم */
  @Column({ type: 'int', nullable: true })
  estimatedDeliveryMinutes!: number | null;

  @Column({ type: 'float', nullable: true })
  distanceKm!: number | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  validUntil!: Date | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** آیا فروشنده امکان ارسال با پیک سامانه را دارد؟ */
  @Column({ default: true })
  supportsPlatformDelivery!: boolean;

  /** توضیح شفاف رتبه‌بندی در زمان ثبت (برای حسابرسی رتبه‌بندی) */
  @Column({ type: 'simple-json', nullable: true })
  rankSnapshot!: Record<string, unknown> | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  submittedAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  decidedAt!: Date | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  decisionNote!: string | null;

  @Column({ type: 'uuid', nullable: true })
  convertedOrderId!: string | null;
}
