import { InitialPostgresSchema1761011200000 } from './migrations/1761011200000-InitialPostgresSchema';
import { MultiSellerOrderHierarchy1792540800000 } from './migrations/1792540800000-MultiSellerOrderHierarchy';

/**
 * فهرست صریح مهاجرت‌ها تا خروجی TypeScript و اجرای Docker رفتار یکسانی داشته باشند.
 *
 * نکته: مهاجرت baseline برای پایگاه PostgreSQL تازه است. پایگاه‌هایی که قبلاً با
 * synchronize ساخته شده‌اند باید مطابق راهنمای استقرار ابتدا snapshot و baseline شوند.
 */
export const MIGRATIONS: Function[] = [
  InitialPostgresSchema1761011200000,
  MultiSellerOrderHierarchy1792540800000,
];
