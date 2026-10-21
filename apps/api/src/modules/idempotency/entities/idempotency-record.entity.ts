import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import { BaseEntity } from '../../../database/base.entity';

/**
 * رکورد یکتاسازی درخواست‌های حساس (ثبت سفارش، ایجاد پرداخت، تسویه).
 * اگر همان کلید دوباره ارسال شود، پاسخ قبلی بازگردانده می‌شود و عملیات تکرار نمی‌گردد.
 */
@Entity('idempotency_records')
@Index(['scope', 'key', 'userId'], { unique: true })
export class IdempotencyRecord extends BaseEntity {
  @Column({ length: 64 })
  scope!: string;

  @Column({ length: 128 })
  key!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  method!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  path!: string | null;

  /** هش بدنه درخواست — برای تشخیص استفاده نادرست از یک کلید با بدنه متفاوت */
  @Column({ type: 'varchar', length: 128, nullable: true })
  requestHash!: string | null;

  @Column({ length: 16, default: 'processing' })
  status!: 'processing' | 'completed' | 'failed';

  @Column({ type: 'int', nullable: true })
  responseStatus!: number | null;

  @Column({ type: 'simple-json', nullable: true })
  responseBody!: Record<string, unknown> | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  expiresAt!: Date | null;
}
