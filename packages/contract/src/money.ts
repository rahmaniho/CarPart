/**
 * پول در سامانه همیشه به‌صورت «عدد صحیح تومان» نگهداری و منتقل می‌شود.
 * هیچ‌جا از اعشار یا تبدیل ریال/تومان در لایه محاسبات استفاده نمی‌شود تا خطای گردکردن ایجاد نشود.
 * نمایش ریال (در صورت نیاز) فقط در لایه ارائه و با ضرب در ۱۰ انجام می‌شود.
 */
export const CURRENCY = 'IRT' as const;
export const CURRENCY_UNIT_FA = 'تومان';
export const RIAL_PER_TOMAN = 10;
/** سقف امن برای عدد صحیح تومان در محاسبات JavaScript */
export const MONEY_MAX_SAFE = Number.MAX_SAFE_INTEGER;

export function assertMoney(value: unknown, field = 'مبلغ'): number {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw new Error(`${field} باید یک عدد باشد.`);
  }
  if (!Number.isInteger(num)) {
    throw new Error(`${field} باید عدد صحیح تومان باشد (مقدار اعشاری مجاز نیست).`);
  }
  if (num < 0) {
    throw new Error(`${field} نمی‌تواند منفی باشد.`);
  }
  if (num > MONEY_MAX_SAFE) {
    throw new Error(`${field} از حد مجاز بزرگ‌تر است.`);
  }
  return num;
}

/** گردکردن سهم‌ها به نزدیک‌ترین تومان صحیح (برای تقسیم کارمزد/تسویه). */
export function roundToman(value: number): number {
  return Math.round(value);
}

/**
 * محاسبه درصد به‌صورت امن: ابتدا ضرب، سپس گردکردن.
 * percent می‌تواند اعشاری باشد (مثلاً ۷.۵) اما نتیجه همیشه تومان صحیح است.
 */
export function percentOf(amount: number, percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) return 0;
  return roundToman((amount * percent) / 100);
}

export function sum(...values: number[]): number {
  return values.reduce((acc, value) => acc + (Number.isFinite(value) ? Math.trunc(value) : 0), 0);
}

export function subtract(a: number, b: number): number {
  return Math.trunc(a) - Math.trunc(b);
}

export function clampMoney(value: number, min = 0, max = MONEY_MAX_SAFE): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

/** جداکننده هزارگان با ارقام فارسی به‌صورت پیش‌فرض. */
export function formatToman(value: number | string | null | undefined, opts?: { latinDigits?: boolean; withUnit?: boolean }): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return '—';
  const latin = opts?.latinDigits ?? false;
  const withUnit = opts?.withUnit ?? true;
  const formatted = new Intl.NumberFormat(latin ? 'en-US' : 'fa-IR', { maximumFractionDigits: 0 }).format(
    Math.trunc(num),
  );
  return withUnit ? `${formatted} ${CURRENCY_UNIT_FA}` : formatted;
}

export function toRialDisplay(toman: number): number {
  return Math.trunc(toman) * RIAL_PER_TOMAN;
}

/** تبدیل ورودی متنی کاربر (ممکن است ریال یا تومان باشد) به تومان صحیح — فقط در لایه ورودی. */
export function parseTomanInput(input: string | number, unit: 'toman' | 'rial' = 'toman'): number {
  const raw = typeof input === 'string' ? input.replace(/[^\d.-]/g, '') : input;
  const num = Number(raw);
  if (!Number.isFinite(num)) throw new Error('مبلغ واردشده معتبر نیست.');
  const toman = unit === 'rial' ? num / RIAL_PER_TOMAN : num;
  return assertMoney(roundToman(toman), 'مبلغ');
}
