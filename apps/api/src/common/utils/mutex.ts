/**
 * قفل‌های ناهم‌زمان درون‌فرایندی.
 *
 * چرا لازم است؟ درایور sql.js (محیط توسعه/تست) تنها یک اتصال به پایگاه‌داده دارد و
 * اجرای هم‌زمان دو تراکنش روی آن ممکن نیست. این قفل تراکنش‌ها را در محیط توسعه
 * به‌صورت متوالی اجرا می‌کند. در PostgreSQL تراکنش‌ها واقعاً هم‌زمان‌اند و این قفل
 * فقط برای عملیات حساس کلیدمحور (مانند ایجاد پرداخت یک سفارش) استفاده می‌شود.
 */
export class AsyncMutex {
  private tail: Promise<unknown> = Promise.resolve();

  async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
    }
  }
}

/** قفل سراسری تراکنش‌ها (برای درایورهای تک‌اتصال). */
export const transactionMutex = new AsyncMutex();

interface LockEntry {
  promise: Promise<void>;
  waiters: number;
}

/** قفل کلیدمحور: دو فراخوانی با کلید یکسان هرگز هم‌زمان اجرا نمی‌شوند. */
export class KeyedLock {
  private entries = new Map<string, LockEntry>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key) ?? { promise: Promise.resolve(), waiters: 0 };
    entry.waiters += 1;
    this.entries.set(key, entry);

    const previous = entry.promise;
    let release!: () => void;
    entry.promise = previous.then(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
      entry.waiters -= 1;
      if (entry.waiters <= 0) this.entries.delete(key);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
