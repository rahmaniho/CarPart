import { assertMoney, clampMoney, formatToman, parseTomanInput, percentOf, roundToman, sum } from '@carpart/contract';

/**
 * آزمون ۱ — پول فقط عدد صحیح تومان.
 * هیچ مقدار اعشاری یا تبدیل ریال/تومان اشتباهی نباید وارد محاسبات مالی شود.
 */
describe('قواعد پول (تومان، عدد صحیح)', () => {
  it('درصد از مبلغ همیشه به عدد صحیح تومان گرد می‌شود', () => {
    expect(percentOf(685_000, 7)).toBe(47_950);
    expect(percentOf(1, 7)).toBe(0);
    expect(Number.isInteger(percentOf(123_457, 3.5))).toBe(true);
  });

  it('گردکردن تومان همیشه عدد صحیح می‌سازد', () => {
    expect(roundToman(1000.7)).toBe(1001);
    expect(roundToman(-0.4)).toBe(-0);
    expect(Number.isInteger(roundToman(99999.99))).toBe(true);
    expect(Number.isInteger(roundToman(1 / 3))).toBe(true);
  });

  it('جمع مبالغ صحیح باقی می‌ماند (بدون خطای اعشار شناور)', () => {
    expect(sum(685_000, 25_000, -50_000)).toBe(660_000);
    expect(sum(0.1 as unknown as number, 0.2 as unknown as number)).toBe(0);
  });

  it('مبلغ نامعتبر (منفی/غیرعددی/بیش از حد بزرگ) رد می‌شود', () => {
    expect(() => assertMoney(-1)).toThrow();
    expect(() => assertMoney(Number.NaN)).toThrow();
    expect(() => assertMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(assertMoney(1500)).toBe(1500);
  });

  it('محدودسازی مبلغ بین حداقل و حداکثر', () => {
    expect(clampMoney(-50)).toBe(0);
    expect(clampMoney(500, 0, 300)).toBe(300);
  });

  it('قالب‌بندی فارسی با جداکننده هزارگان و واحد تومان', () => {
    expect(formatToman(1_421_880)).toContain('۱٬۴۲۱٬۸۸۰');
    expect(formatToman(1_421_880, { withUnit: true })).toContain('تومان');
    expect(formatToman(1500, { latinDigits: true, withUnit: false })).toBe('1,500');
    expect(formatToman(null)).toBe('—');
  });

  it('ورودی ریالی به تومان تبدیل می‌شود (بدون اشتباه ضریب ۱۰)', () => {
    expect(parseTomanInput('25000', 'toman')).toBe(25_000);
    expect(parseTomanInput(250_000, 'rial')).toBe(25_000);
  });
});
