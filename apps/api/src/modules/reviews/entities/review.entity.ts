import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/** امتیاز و نظر کاربر درباره فروشنده یا پیک — فقط برای سفارش واقعی و یک‌بار. */
@Entity('reviews')
@Index(['orderId', 'targetType', 'authorId'], { unique: true })
@Index(['targetType', 'targetId', 'createdAt'])
export class Review extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  orderId!: string;

  @Index()
  @Column({ length: 36 })
  authorId!: string;

  @Column({ length: 16 })
  targetType!: 'seller' | 'courier';

  @Index()
  @Column({ length: 36 })
  targetId!: string;

  @Column()
  rating!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  /** آیا سفارش مغایرت/مشکل داشت؟ (ورودی شاخص کیفیت فروشنده) */
  @Column({ default: false })
  hadIssue!: boolean;

  @Column({ default: true })
  isPublished!: boolean;

  @Column({ type: 'varchar', length: 300, nullable: true })
  moderationNote!: string | null;
}
