import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { QualityGrade } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';
import { Quote } from './quote.entity';

/** قلم یک پیشنهاد قیمت — امکان پیشنهاد جایگزین (مثلاً برند متفاوت) را می‌دهد. */
@Entity('quote_items')
export class QuoteItem extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  quoteId!: string;

  @ManyToOne(() => Quote, (quote) => quote.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quoteId' })
  quote!: Quote;

  @Column({ type: 'uuid', nullable: true })
  sellerProductId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  partId!: string | null;

  @Column({ length: 200 })
  nameFa!: string;

  @Column({ type: 'varchar', length: 96, nullable: true })
  sku!: string | null;

  @Column({ length: 32, default: 'unknown' })
  quality!: QualityGrade;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ type: 'bigint', transformer: moneyTransformer })
  unitPrice!: number;

  @Column({ type: 'bigint', transformer: moneyTransformer })
  lineTotal!: number;

  /** موجودی واقعی در زمان ثبت پیشنهاد (برای شفافیت و جلوگیری از پیشنهاد ناموجود) */
  @Column({ type: 'int', nullable: true })
  stockAtQuote!: number | null;

  @Column({ default: false })
  isSubstitute!: boolean;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
