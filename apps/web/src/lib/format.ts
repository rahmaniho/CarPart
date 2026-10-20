import { formatJalali, formatToman } from '@carpart/contract';

export { formatToman };

export function dateFa(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '—';
  try {
    return formatJalali(new Date(iso), { withTime });
  } catch {
    return '—';
  }
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function compactMoney(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} میلیون`;
  if (Math.abs(amount) >= 1_000) return `${Math.round(amount / 1_000)} هزار`;
  return String(amount);
}
