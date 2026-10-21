import { Column, Entity, Index } from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../database/column-types';
import type { Role } from '@carpart/contract';
import { BaseEntity, moneyTransformer } from '../../../database/base.entity';

/** کوپن تخفیف — مقادیر و محدودیت‌ها در پایگاه‌داده و از پنل مدیریت قابل تنظیم هستند. */
@Entity('coupons')
export class Coupon extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 48 })
  code!: string;

  @Column({ length: 16, default: 'percent' })
  type!: 'percent' | 'fixed';

  /** برای درصد: عدد درصد (مثلاً ۱۰) — برای مبلغ ثابت: تومان */
  @Column({ type: 'bigint', transformer: moneyTransformer })
  value!: number;

  @Column({ type: 'bigint', nullable: true, transformer: moneyTransformer })
  maxDiscount!: number | null;

  @Column({ type: 'bigint', nullable: true, transformer: moneyTransformer })
  minOrderAmount!: number | null;

  @Column({ type: 'int', nullable: true })
  usageLimit!: number | null;

  @Column({ default: 0 })
  usedCount!: number;

  @Column({ type: 'int', nullable: true })
  perUserLimit!: number | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  startsAt!: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  endsAt!: Date | null;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  audienceRoles!: Role[] | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;
}
