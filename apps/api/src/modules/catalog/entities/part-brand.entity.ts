import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/** برند سازنده قطعه (مانند: ایساکو، عظام، بوش، ولو). */
@Entity('part_brands')
export class PartBrand extends BaseEntity {
  @Column({ length: 160 })
  nameFa!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  nameEn!: string | null;

  @Index({ unique: true })
  @Column({ length: 160 })
  slug!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  country!: string | null;

  /** برند اصلی/شرکتی است؟ (برای نمایش نشان اصالت) */
  @Column({ default: false })
  isOem!: boolean;

  @Column({ type: 'varchar', length: 300, nullable: true })
  logoUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  searchKey!: string | null;

  @Column({ default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;
}
