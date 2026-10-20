import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Seller } from './seller.entity';

export interface BusinessHour {
  /** ۰ = شنبه ... ۶ = جمعه */
  day: number;
  open: string | null;
  close: string | null;
  closed: boolean;
}

/** شعبه/انبار فروشنده — مبدأ ارسال سفارش‌ها و مرکز محاسبه فاصله و هزینه ارسال. */
@Entity('seller_branches')
@Index(['sellerId', 'isActive'])
export class SellerBranch extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  sellerId!: string;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller!: Seller;

  @Column({ length: 200 })
  name!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: string | null;

  @Column({ type: 'text', nullable: true })
  addressText!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Index()
  @Column({ type: 'float', nullable: true })
  lat!: number | null;

  @Column({ type: 'float', nullable: true })
  lng!: number | null;

  /** شعاع خدمات (کیلومتر) — بیرون از آن، پیشنهاد ارسال داده نمی‌شود */
  @Column({ default: 25 })
  serviceRadiusKm!: number;

  @Column({ type: 'simple-json', nullable: true })
  businessHours!: BusinessHour[] | null;

  /** زمان پیش‌فرض آماده‌سازی سفارش (دقیقه) */
  @Column({ default: 30 })
  prepTimeMinutes!: number;

  @Column({ default: true })
  isPrimary!: boolean;

  @Column({ default: true })
  isActive!: boolean;

  /** آیا فروشگاه در حال حاضر باز است؟ (محاسبه‌شده در سرویس، نه ذخیره‌شده) */
}
