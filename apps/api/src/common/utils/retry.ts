/** تلاش مجدد با پس‌رفت نمایی — برای سرویس‌های خارجی ناپایدار (پیامک، نقشه، درگاه). */
export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  signal?: { aborted: boolean };
}

export function computeBackoff(attempt: number, options: RetryOptions = {}): number {
  const base = options.baseDelayMs ?? 500;
  const factor = options.factor ?? 2;
  const max = options.maxDelayMs ?? 30_000;
  const delay = Math.min(max, base * factor ** Math.max(0, attempt - 1));
  return Math.round(delay + Math.random() * Math.min(delay * 0.2, 250));
}

export async function withRetry<T>(task: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (options.signal?.aborted) throw new Error('عملیات متوقف شد.');
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      const retryable = options.shouldRetry ? options.shouldRetry(error, attempt) : true;
      if (!retryable || attempt === attempts) throw error;
      const delay = computeBackoff(attempt, options);
      options.onRetry?.(error, attempt, delay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/** خطاهای برنامه‌ای که هرگز نباید دوباره تلاش شوند. */
export function isNonRetryable(error: unknown): boolean {
  const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500;
}
