import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

export type SettingValueType = 'number' | 'string' | 'boolean' | 'json';

/**
 * تنظیمات سامانه — همه تعرفه‌ها و قوانین تجاری اینجا نگهداری می‌شوند
 * تا هیچ مقداری در کد ثابت (hard-code) نماند و مدیر بتواند آن را تغییر دهد.
 */
@Entity('system_settings')
export class SystemSetting extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 128 })
  key!: string;

  @Column({ length: 16, default: 'string' })
  valueType!: SettingValueType;

  @Column({ type: 'simple-json', nullable: true })
  value!: unknown;

  @Column({ type: 'simple-json', nullable: true })
  defaultValue!: unknown;

  @Index()
  @Column({ length: 64 })
  group!: string;

  @Column({ length: 200 })
  faLabel!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  constraints!: { min?: number; max?: number; enum?: string[] } | null;

  /** آیا مقدار بدون احراز هویت قابل خواندن است (مانند نام سامانه) */
  @Column({ default: false })
  isPublic!: boolean;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
