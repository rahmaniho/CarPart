import { Column, Entity, Index } from 'typeorm';
import type { CompatibilityLevel } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';

/**
 * سازگاری قطعه با خودرو — ساختاریافته و قابل حسابرسی.
 * هر سطر می‌تواند در سطح سازنده، مدل یا تیپ تعریف شود؛ هرچه سطح دقیق‌تر، اعتماد بالاتر.
 */
@Entity('part_compatibilities')
@Index(['partId', 'variantId'])
@Index(['partId', 'modelId'])
@Index(['modelId', 'level'])
export class PartCompatibility extends BaseEntity {
  @Index()
  @Column({ length: 36 })
  partId!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  makeId!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  modelId!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  variantId!: string | null;

  @Column({ type: 'int', nullable: true })
  yearFrom!: number | null;

  @Column({ type: 'int', nullable: true })
  yearTo!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  engine!: string | null;

  @Column({ length: 32, default: 'unknown' })
  level!: CompatibilityLevel;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** منبع داده: ثبت فروشنده، تأیید مدیر، یا تخمین سامانه */
  @Column({ length: 32, default: 'seller' })
  source!: 'seller' | 'admin' | 'system';

  @Column({ default: true })
  isActive!: boolean;
}
