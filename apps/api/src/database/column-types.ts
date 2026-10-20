/**
 * نوع ستون‌های تاریخ متناسب با موتور پایگاه‌داده.
 *
 * TypeORM نوع `datetime` را در SQLite/sql.js و `timestamp` را در PostgreSQL می‌پذیرد؛
 * چون ستون‌های nullable باید نوع صریح داشته باشند (متادیتای دکوراتور برای
 * اتحاد `Date | null` به Object تبدیل می‌شود)، این ثابت یک نقطه یکتا برای انتخاب نوع است.
 */
export const DATE_COLUMN_TYPE: 'timestamp' | 'datetime' = process.env.DB_TYPE === 'postgres' ? 'timestamp' : 'datetime';

/** نوع ستون برای داده‌های ساخت‌یافته (JSON) — در هر دو موتور پشتیبانی می‌شود. */
export const JSON_COLUMN_TYPE = 'simple-json' as const;
