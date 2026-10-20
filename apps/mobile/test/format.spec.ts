import { describe, expect, it } from 'vitest';
import { countdownFa, dateFa, toFaDigits } from '../src/lib/format';

describe('ابزارهای قالب‌بندی فارسی', () => {
  it('ارقام فارسی را درست تبدیل می‌کند', () => {
    expect(toFaDigits('12:05')).toBe('۱۲:۰۵');
    expect(toFaDigits(42)).toBe('۴۲');
  });

  it('شمارش معکوس تا مهلت را نشان می‌دهد و انقضا را تشخیص می‌دهد', () => {
    const now = Date.now();
    const in90s = new Date(now + 90_000).toISOString();
    const result = countdownFa(in90s, now);
    expect(result.expired).toBe(false);
    expect(result.text).toContain('۱:۳۰');

    expect(countdownFa(new Date(now - 1000).toISOString(), now).expired).toBe(true);
    expect(countdownFa(null).expired).toBe(true);
  });

  it('بازه‌های ساعتی را خوانا نشان می‌دهد', () => {
    const now = Date.now();
    const in2Hours = new Date(now + 2 * 3600_000 + 30 * 60_000).toISOString();
    expect(countdownFa(in2Hours, now).text).toContain('ساعت');
  });

  it('تاریخ نامعتبر یا خالی «—» برمی‌گرداند', () => {
    expect(dateFa(null)).toBe('—');
    expect(dateFa('not-a-date')).toBe('—');
  });

  it('تاریخ معتبر را به جلالی تبدیل می‌کند', () => {
    const out = dateFa('2026-10-20T10:30:00.000Z', false);
    expect(out).not.toBe('—');
    expect(out.length).toBeGreaterThan(4);
  });
});
