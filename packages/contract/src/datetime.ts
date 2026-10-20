/**
 * تاریخ و زمان: ذخیره همیشه UTC (ISO) است و نمایش با تقویم هجری شمسی.
 * از Intl با calendar=persian استفاده می‌شود (بدون وابستگی خارجی).
 */
const FA_LOCALE = 'fa-IR';

export function nowIso(): string {
  return new Date().toISOString();
}

export function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface JalaliFormatOptions {
  withTime?: boolean;
  latinDigits?: boolean;
  relative?: boolean;
}

export function formatJalali(value: Date | string | number | null | undefined, opts: JalaliFormatOptions = {}): string {
  const date = toDate(value);
  if (!date) return '—';
  const locale = opts.latinDigits ? 'fa-IR-u-nu-latn' : FA_LOCALE;
  try {
    const dateText = new Intl.DateTimeFormat(locale, {
      calendar: 'persian',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    if (!opts.withTime) return dateText;
    const timeText = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
    return `${dateText} - ${timeText}`;
  } catch {
    return date.toISOString();
  }
}

export function formatRelative(value: Date | string | number | null | undefined, now = new Date()): string {
  const date = toDate(value);
  if (!date) return '—';
  const diffMs = date.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat(FA_LOCALE, { numeric: 'auto' });
  if (abs < minute) return diffMs >= 0 ? 'کمتر از یک دقیقه دیگر' : 'هم‌اکنون';
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute');
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), 'day');
  return formatJalali(date);
}

export function durationFa(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '—';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'کمتر از ۱ دقیقه';
  if (minutes < 60) return `${minutes.toLocaleString('fa-IR')} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} ساعت و ${rest} دقیقه` : `${hours} ساعت`;
  const days = Math.floor(hours / 24);
  return `${days.toLocaleString('fa-IR')} روز و ${hours % 24} ساعت`;
}

export function countdownFa(target: Date | string | number, now = new Date()): string {
  const date = toDate(target);
  if (!date) return '—';
  const diff = date.getTime() - now.getTime();
  if (diff <= 0) return 'به پایان رسید';
  return durationFa(diff);
}

export function addMinutes(base: Date | string | number, minutes: number): Date {
  const date = toDate(base) ?? new Date();
  return new Date(date.getTime() + minutes * 60_000);
}

export function startOfDayUtc(value: Date | string | number = new Date()): Date {
  const date = toDate(value) ?? new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
