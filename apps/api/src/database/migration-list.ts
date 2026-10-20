/**
 * فهرست migrationها.
 * در این مخزن فایل migration برای PostgreSQL باید با دستور زیر تولید شود (نیاز به Postgres در دسترس):
 *   docker compose up -d db
 *   npm run db:migration:generate -w @carpart/api -- InitialSchema
 * محیط توسعه/تست از sql.js با synchronize استفاده می‌کند (فقط غیرعملیاتی).
 */
export const MIGRATIONS: Function[] = [];
