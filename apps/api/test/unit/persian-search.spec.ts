import { isIranMobile, matchesFa, normalizeFa, normalizeIranMobile, searchTokens, toLatinDigits } from '@carpart/contract';

/**
 * آزمون ۲ — جست‌وجوی tolerant فارسی.
 * ی/ي، ک/ك، ارقام فارسی، نیم‌فاصله و فاصله‌های اضافی نباید نتیجه را از بین ببرند.
 */
describe('یکسان‌سازی متن فارسی برای جست‌وجو', () => {
  it('ی عربی و ک عربی به شکل فارسی یکسان می‌شوند', () => {
    expect(normalizeFa('لنت ترمز پرايد')).toBe(normalizeFa('لنت ترمز پراید'));
    expect(normalizeFa('قطعات يدكي')).toBe(normalizeFa('قطعات یدکی'));
  });

  it('نیم‌فاصله و فاصله‌های اضافی حذف/یکسان می‌شوند', () => {
    expect(normalizeFa('قطعه\u200cرسان')).toBe(normalizeFa('قطعه رسان'));
    expect(normalizeFa('  لنت   ترمز  ')).toBe(normalizeFa('لنت ترمز'));
  });

  it('ارقام فارسی/عربی به رقم لاتین تبدیل می‌شوند', () => {
    expect(toLatinDigits('۰۹۱۲۱۱۱۰۰۰۱')).toBe('09121110001');
    expect(toLatinDigits('١٢٣٤')).toBe('1234');
  });

  it('توکن‌های جست‌وجو بدون واژه‌های خالی ساخته می‌شوند', () => {
    expect(searchTokens('لنت  ترمز جلو')).toEqual(expect.arrayContaining(['لنت', 'ترمز', 'جلو']));
    expect(searchTokens('')).toEqual([]);
  });

  it('تطبیق فارسی نسبت به نویسه‌های معادل بی‌تفاوت است', () => {
    expect(matchesFa('لنت ترمز جلو پراید', 'لنت ترمز پرايد')).toBe(false); // ترتیب واژه‌ها مهم است (تطبیق رشته‌ای)
    expect(matchesFa('لنت ترمز جلو پراید', 'پرايد')).toBe(true);
    expect(matchesFa('قطعات یدکی', 'يدكي')).toBe(true);
    expect(matchesFa(null, 'لنت')).toBe(false);
  });

  it('شماره موبایل ایرانی اعتبارسنجی و یکدست می‌شود', () => {
    expect(normalizeIranMobile('+98 912-111-0001')).toBe('09121110001');
    expect(normalizeIranMobile('۰۹۱۲۱۱۱۰۰۰۱')).toBe('09121110001');
    expect(isIranMobile('09121110001')).toBe(true);
    expect(isIranMobile('02112345678')).toBe(false);
    expect(normalizeIranMobile('12345')).toBeNull();
  });
});
