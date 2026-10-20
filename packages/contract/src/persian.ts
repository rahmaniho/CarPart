/**
 * یکسان‌سازی متن فارسی برای جست‌وجو.
 * هدف: «دیस्क ترمز» و «دیسک ترمز» و «دیسک  ترمز» یک نتیجه بدهند.
 */

const ARABIC_TO_PERSIAN: Record<string, string> = {
  'ي': 'ی',
  'ى': 'ی',
  'ئ': 'ی',
  'ك': 'ک',
  'ڪ': 'ک',
  'گ': 'گ',
  'ة': 'ه',
  'ۀ': 'ه',
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ؤ': 'و',
  'ء': '',
  '​': '', // نیم‌فاصله
  'ـ': '', // کشیده
};

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toLatinDigits(input: string): string {
  let out = input;
  FA_DIGITS.forEach((d, i) => (out = out.replaceAll(d, String(i))));
  AR_DIGITS.forEach((d, i) => (out = out.replaceAll(d, String(i))));
  return out;
}

export function toPersianDigits(input: string | number): string {
  const text = String(input);
  return text.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** یکسان‌سازی برای ذخیره در ستون جست‌وجو (search_key) و برای عبارت ورودی کاربر. */
export function normalizeFa(input: string | null | undefined): string {
  if (!input) return '';
  let text = toLatinDigits(String(input)).trim();
  text = text.replace(/[\u064B-\u0652\u0670\u0640]/g, ''); // اعراب و کشیده
  text = text.split('').map((ch) => ARABIC_TO_PERSIAN[ch] ?? ch).join('');
  text = text.toLowerCase();
  text = text.replace(/[\u200c\u200d\u200e\u200f]/g, ' ');
  text = text.replace(/[‌]/g, ' ');
  text = text.replace(/["'`(){}[\]<>*#@$%^&+=|\\/!?؟.,:;-]+/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/** تولید کلیدهای جست‌وجو از یک متن (کل متن + کلمات). */
export function searchTokens(input: string): string[] {
  const normalized = normalizeFa(input);
  if (!normalized) return [];
  const tokens = new Set<string>([normalized]);
  for (const word of normalized.split(' ')) {
    if (word.length > 1) tokens.add(word);
  }
  return [...tokens];
}

/** بررسی تطابق ساده برای جست‌وجوی «شروع با» و «شامل» بدون نیاز به Full-Text Search. */
export function matchesFa(haystack: string | null | undefined, needle: string): boolean {
  const h = normalizeFa(haystack);
  const n = normalizeFa(needle);
  if (!n) return true;
  if (!h) return false;
  return h.includes(n);
}

/** اعتبارسنجی شماره موبایل ایران (۰۹xxxxxxxxx). */
export function normalizeIranMobile(input: string): string | null {
  const digits = toLatinDigits(String(input ?? '')).replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith('+98')) return normalizeIranMobile(digits);
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  if (digits.length === 11 && digits.startsWith('09')) return digits;
  return null;
}

export function isIranMobile(input: string): boolean {
  return normalizeIranMobile(input) !== null;
}

/** تبدیل ارقام به فارسی برای کدهای یکبارمصرف (نمایش). */
export function maskMobile(mobile: string): string {
  const digits = toLatinDigits(mobile).replace(/\D/g, '');
  if (digits.length < 7) return digits;
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}
