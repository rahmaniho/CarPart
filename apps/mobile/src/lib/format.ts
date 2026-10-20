import { formatJalali, formatToman } from '@carpart/contract';

export { formatToman };

/** تاریخ/زمان فارسی (جلالی) از رشته ISO */
export function dateFa(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '—';
  try {
    return formatJalali(new Date(iso), { withTime });
  } catch {
    return '—';
  }
}

/** فرمت باقی‌مانده به دقیقه/ثانیه برای شمارش معکوس */
export function countdownFa(targetIso: string | null | undefined, now = Date.now()): { text: string; expired: boolean } {
  if (!targetIso) return { text: '—', expired: true };
  const target = new Date(targetIso).getTime();
  const diff = target - now;
  if (Number.isNaN(target)) return { text: '—', expired: true };
  if (diff <= 0) return { text: 'مهلت گذشته', expired: true };
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return { text: `${hours} ساعت و ${minutes % 60} دقیقه`, expired: false };
  }
  return { text: `${toFaDigits(String(minutes))}:${toFaDigits(String(seconds).padStart(2, '0'))}`, expired: false };
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}
