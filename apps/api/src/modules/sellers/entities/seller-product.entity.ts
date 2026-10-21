import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { QualityGrade } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';
import { Part } from '../../catalog/entities/part.entity';
import { SellerBranch } from './seller-branch.entity';
import { Seller } from './seller.entity';

/**
 * پیشنهاد فروش یک فروشنده روی یک قطعه کاتالوگ.
 *
 * طراحی مهم: مدل عمومی قطعه (Part) با موجودی/قیمت فروشنده یکی گرفته نشده است.
 * یک Part می‌تواند چند SellerProduct از فروشندگان مختلف داشته باشد و هر کدام
 * قیمت، موجودی، کیفیت اعلام‌شده، زمان آماده‌سازی و زمان آخرین به‌روزرسانی مستقل دارند.
 */
@Entity('seller_products')
@Index(['partId', 'isActive', 'price'])
@Index(['sellerId', 'isActive'])
@Index(['branchId', 'isActive'])
export class SellerProduct extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  sellerId!: string;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller!: Seller;

  @Index()
  @Column({ type: 'uuid' })
  branchId!: string;

  @ManyToOne(() => SellerBranch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch!: SellerBranch;

  @Index()
  @Column({ type: 'uuid' })
  partId!: string;

  @ManyToOne(() => Part, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partId' })
  part!: Part;

  /** SKU اختصاصی فروشنده */
  @Column({ type: 'varchar', length: 96, nullable: true })
  sku!: string | null;

  /** قیمت فروش به ازای هر واحد — عدد صحیح تومان */
  @Column({ type: 'bigint', transformer: moneyTransformer })
  price!: number;

  /** قیمت قبلی برای نمایش تخفیف (اختیاری) */
  @Column({ type: 'bigint', nullable: true, transformer: moneyTransformer })
  listPrice!: number | null;

  /** موجودی کل */
  @Column({ default: 0 })
  stock!: number;

  /** موجودی رزروشده در سفارش‌های در جریان (برای جلوگیری از فروش بیش از موجودی) */
  @Column({ default: 0 })
  reservedStock!: number;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  priceUpdatedAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  stockUpdatedAt!: Date | null;

  @Column({ length: 32, default: 'unknown' })
  quality!: QualityGrade;

  /** فروشنده اصالت قطعه را اعلام کرده است (مسئولیت اعلام با فروشنده است) */
  @Column({ default: false })
  isGenuineClaimed!: boolean;

  @Column({ default: 30 })
  preparationMinutes!: number;

  @Column({ type: 'text', nullable: true })
  warrantyNote!: string | null;

  @Column({ type: 'text', nullable: true })
  returnPolicy!: string | null;

  @Column({ default: 7 })
  returnWindowDays!: number;

  @Column({ type: 'simple-json', nullable: true })
  images!: string[] | null;

  @Column({ type: 'text', nullable: true })
  conditionNote!: string | null;

  /** کلید جست‌وجوی denormalize (نام قطعه + برند + SKU) برای جست‌وجوی سریع */
  @Column({ type: 'text', nullable: true })
  searchKey!: string | null;

  @Column({ default: false })
  isFeatured!: boolean;

  @Column({ default: true })
  isActive!: boolean;

  /** قفل خوش‌بینانه برای تغییرات هم‌زمان موجودی */
  @VersionColumn()
  version!: number;

  /** موجودی قابل فروش */
  get availableStock(): number {
    return Math.max(0, (this.stock ?? 0) - (this.reservedStock ?? 0));
  }
}
