import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { JobStatus } from '@carpart/contract';
import { BaseEntity } from '../../../database/base.entity';

/**
 * صف کارهای پس‌زمینه مبتنی بر پایگاه‌داده (Outbox).
 *
 * چرا؟ در این نسخه Redis در دسترس نیست؛ صف مبتنی بر پایگاه‌داده تضمین می‌کند کارها
 * پس از راه‌اندازی مجدد از بین نروند و با کلید یکتا تکراری اجرا نشوند.
 * رابط JobRunner به‌گونه‌ای است که اجرای Redis/BullMQ بدون تغییر کد کسب‌وکاری قابل فعال‌سازی است.
 */
@Entity('jobs')
@Index(['status', 'nextRunAt'])
@Index(['type', 'dedupeKey'], { unique: true })
export class Job extends BaseEntity {
  @Column({ length: 96 })
  type!: string;

  @Column({ type: 'simple-json', nullable: true })
  payload!: Record<string, unknown> | null;

  /** کلید یکتاسازی (اختیاری) — از ایجاد کار تکراری برای یک رویداد جلوگیری می‌کند */
  @Column({ type: 'varchar', length: 190, nullable: true })
  dedupeKey!: string | null;

  @Index()
  @Column({ length: 16, default: 'queued' })
  status!: JobStatus;

  @Column({ default: 0 })
  attempts!: number;

  @Column({ default: 4 })
  maxAttempts!: number;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  nextRunAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  lockedAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lockedBy!: string | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  completedAt!: Date | null;

  @Column({ default: 0 })
  priority!: number;
}
