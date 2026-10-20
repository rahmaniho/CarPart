import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer } from 'typeorm';

/** ستون پایه همه موجودیت‌ها: شناسه UUID و زمان ایجاد/به‌روزرسانی (همیشه UTC). */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * مبدل مبلغ: در پایگاه‌داده به‌صورت عدد صحیح (bigint در PostgreSQL) ذخیره می‌شود
 * و در کد همیشه number صحیح تومان است. هرگز مقدار اعشاری ذخیره نمی‌شود.
 */
export const moneyTransformer: ValueTransformer = {
  to(value?: number | null): string | null {
    if (value === null || value === undefined) return null;
    if (!Number.isFinite(Number(value))) return null;
    return String(Math.trunc(Number(value)));
  },
  from(value?: string | number | null): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? Math.trunc(num) : null;
  },
};

/** مبدل درصد با دقت دو رقم (ذخیره به‌صورت عدد صحیح صدم‌درصد تا خطای اعشار حذف شود). */
export const percentTransformer: ValueTransformer = {
  to(value?: number | null): number | null {
    if (value === null || value === undefined) return null;
    return Math.round(Number(value) * 100);
  },
  from(value?: number | null): number | null {
    if (value === null || value === undefined) return null;
    return Number(value) / 100;
  },
};

/** مبدل عدد صحیح (برای ستون‌هایی که در PostgreSQL bigint بازگردانده می‌شوند). */
export const intTransformer: ValueTransformer = {
  to(value?: number | null): number | null {
    return value === null || value === undefined ? null : Math.trunc(Number(value));
  },
  from(value?: string | number | null): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? Math.trunc(num) : null;
  },
};
