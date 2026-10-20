import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/** دسته‌بندی قطعات (درختی). */
@Entity('part_categories')
export class PartCategory extends BaseEntity {
  @Column({ length: 160 })
  nameFa!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  nameEn!: string | null;

  @Index({ unique: true })
  @Column({ length: 160 })
  slug!: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  parentId!: string | null;

  @ManyToOne(() => PartCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent!: PartCategory | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  icon!: string | null;

  @Column({ default: 0 })
  sortOrder!: number;

  /** کلید جست‌وجوی یکسان‌سازی‌شده (فارسی/عربی/ارقام) */
  @Column({ type: 'text', nullable: true })
  searchKey!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ default: true })
  isActive!: boolean;
}
