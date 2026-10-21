import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { QualityGrade } from '@carpart/contract';
import { moneyTransformer, BaseEntity } from '../../../database/base.entity';
import { PartBrand } from './part-brand.entity';
import { PartCategory } from './part-category.entity';

/**
 * قطعه در کاتالوگ عمومی (مدل عمومی قطعه).
 * توجه: قیمت و موجودی اینجا ذخیره نمی‌شود؛ آن‌ها در SellerProduct (پیشنهاد فروش هر فروشنده) هستند.
 */
@Entity('parts')
@Index(['categoryId', 'isActive'])
export class Part extends BaseEntity {
  @Column({ length: 200 })
  nameFa!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  nameEn!: string | null;

  @Index()
  @Column({ type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => PartCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category!: PartCategory;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  brandId!: string | null;

  @ManyToOne(() => PartBrand, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'brandId' })
  brand!: PartBrand | null;

  /** کد فنی عمومی قطعه */
  @Index()
  @Column({ type: 'varchar', length: 96, nullable: true })
  technicalCode!: string | null;

  /** شماره قطعه سازنده خودرو (OEM) */
  @Index()
  @Column({ type: 'varchar', length: 96, nullable: true })
  oemCode!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  specs!: Record<string, string> | null;

  @Column({ type: 'simple-json', nullable: true })
  images!: string[] | null;

  @Column({ length: 32, default: 'unknown' })
  defaultQuality!: QualityGrade;

  /** واحد فروش: عدد، جفت، متر، لیتر */
  @Column({ length: 16, default: 'عدد' })
  unit!: string;

  /** حداقل موجودی قابل سفارش در هر قلم */
  @Column({ default: 1 })
  minOrderQty!: number;

  /** آیا این قطعه حساس به سازگاری است (مانند قطعات موتوری) */
  @Column({ default: true })
  isCompatibilityCritical!: boolean;

  /**
   * کلید جست‌وجوی یکسان‌سازی‌شده: نام فارسی + نام انگلیسی + کدها + برند + دسته
   * تمام «ی/ي»، «ک/ك»، ارقام عربی/فارسی و فاصله‌های اضافی در آن یکسان شده‌اند.
   */
  @Column({ type: 'text', nullable: true })
  searchKey!: string | null;

  /** کلیدهای کوتاه‌تر برای تطابق کلمه‌ای */
  @Column({ type: 'simple-json', nullable: true })
  searchTokens!: string[] | null;

  /** میانگین قیمت بازار (تومان) — فقط برای نمایش بازه قیمت، نه برای محاسبه سفارش */
  @Column({ type: 'bigint', nullable: true, transformer: moneyTransformer })
  referencePrice!: number | null;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;
}
