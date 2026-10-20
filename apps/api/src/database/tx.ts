import type { DataSource, EntityManager } from 'typeorm';
import { transactionMutex } from '../common/utils/mutex';

/**
 * اجرای یک تابع در تراکنش.
 *
 * درایور sql.js فقط یک اتصال دارد، بنابراین تراکنش‌های هم‌زمان باید صف شوند؛
 * این کمک‌تابع در آن حالت از قفل سراسری استفاده می‌کند. در PostgreSQL تراکنش‌ها
 * به‌صورت طبیعی هم‌زمان اجرا می‌شوند و قفل اضافی اعمال نمی‌شود.
 */
export async function runInTransaction<T>(
  dataSource: DataSource,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  if (dataSource.options.type === 'sqljs' || dataSource.options.type === 'sqlite') {
    return transactionMutex.runExclusive(() => dataSource.transaction(work));
  }
  return dataSource.transaction(work);
}
