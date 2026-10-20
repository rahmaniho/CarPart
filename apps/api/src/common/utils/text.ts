import { normalizeFa, searchTokens, toLatinDigits } from '@carpart/contract';

export { normalizeFa, searchTokens, toLatinDigits };

/** ساخت اسلاگ لاتین از متن (برای URLهای عمومی مانند دسته‌بندی‌ها). */
export function slugify(input: string): string {
  return toLatinDigits(input)
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** پنهان‌سازی بخشی از داده حساس در لاگ (مانند شماره کارت یا توکن). */
export function redact(value: string | null | undefined, keep = 4): string {
  if (!value) return '';
  if (value.length <= keep) return '*'.repeat(value.length);
  return `${'*'.repeat(Math.max(0, value.length - keep))}${value.slice(-keep)}`;
}

/** خلاصه‌سازی متن برای فهرست‌ها. */
export function truncate(input: string | null | undefined, max = 120): string {
  if (!input) return '';
  const text = String(input).trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
