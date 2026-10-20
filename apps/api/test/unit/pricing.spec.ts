import { PricingService } from '../../src/modules/finance/pricing.service';
import type { SystemSettingsService } from '../../src/modules/settings/system-settings.service';

function settingsStub(values: Record<string, unknown> = {}): SystemSettingsService {
  return {
    getNumber: async (key: string, fallback: number) => (key in values ? Number(values[key]) : fallback),
    getJson: async <T>(key: string, fallback: T) => (key in values ? (values[key] as T) : fallback),
    getString: async (key: string, fallback: string) => (key in values ? String(values[key]) : fallback),
    getBoolean: async (key: string, fallback: boolean) => (key in values ? Boolean(values[key]) : fallback),
  } as unknown as SystemSettingsService;
}

/**
 * آزمون ۳ — منطق مالی: کارمزد از سهم فروشنده کسر می‌شود نه از جیب مشتری،
 * و همه پارامترها از تنظیمات خوانده می‌شوند (هیچ عددی در کد ثابت نیست).
 */
describe('سرویس قیمت‌گذاری و کارمزد', () => {
  const baseSettings = {
    'finance.delivery.base_fee': 25_000,
    'finance.delivery.per_km_fee': 6_000,
    'finance.delivery.urgency_multiplier': { normal: 1, urgent: 1.25, critical: 1.5 },
    'finance.delivery.free_over_amount': 0,
    'finance.commission.percent': 7,
    'finance.commission.min_amount': 0,
    'finance.courier.share_percent': 85,
  };

  it('هزینه ارسال = پایه + مسافت × نرخ، با ضریب فوریت', async () => {
    const pricing = new PricingService(settingsStub(baseSettings));
    const normal = await pricing.estimateDeliveryFee({ distanceKm: 8, urgency: 'normal', itemsTotal: 500_000 });
    expect(normal.total).toBe(25_000 + 8 * 6_000);
    expect(normal.breakdown.length).toBeGreaterThan(0);

    const urgent = await pricing.estimateDeliveryFee({ distanceKm: 8, urgency: 'urgent', itemsTotal: 500_000 });
    expect(urgent.total).toBe(Math.round((25_000 + 8 * 6_000) * 1.25));
    expect(urgent.urgencyMultiplier).toBe(1.25);
  });

  it('ارسال رایگان بالای سقف تنظیم‌شده اعمال می‌شود', async () => {
    const pricing = new PricingService(settingsStub({ ...baseSettings, 'finance.delivery.free_over_amount': 1_000_000 }));
    const result = await pricing.estimateDeliveryFee({ distanceKm: 12, urgency: 'normal', itemsTotal: 1_500_000 });
    expect(result.total).toBe(0);
    expect(result.freeDeliveryApplied).toBe(true);
  });

  it('کارمزد از سهم فروشنده کسر می‌شود و به مبلغ مشتری اضافه نمی‌گردد', async () => {
    const pricing = new PricingService(settingsStub(baseSettings));
    const commission = await pricing.calculateCommission({
      itemsTotal: 1_000_000,
      discountTotal: 100_000,
      deliveryFee: 73_000,
      ratePercent: 7,
      courierSharePercent: 85,
    });
    expect(commission.commissionBase).toBe(900_000);
    expect(commission.platformAmount).toBe(63_000);
    expect(commission.sellerNetAmount).toBe(837_000);
    expect(commission.sellerNetAmount + commission.platformAmount).toBe(commission.commissionBase);
    expect(commission.courierAmount).toBe(Math.round((73_000 * 85) / 100));
    expect(commission.deliveryPlatformAmount).toBe(73_000 - commission.courierAmount);

    const payable = pricing.payableBreakdown({ itemsSubtotal: 1_000_000, deliveryFee: 73_000, discountTotal: 100_000 });
    // مشتری کارمزد پلتفرم را پرداخت نمی‌کند
    expect(payable.payable).toBe(973_000);
    expect(payable.payable).toBe(payable.itemsTotal + payable.deliveryFee - payable.discountTotal);
    expect(payable.currency).toBe('IRT');
  });

  it('حداقل کارمزد تنظیم‌شده رعایت می‌شود', async () => {
    const pricing = new PricingService(settingsStub({ ...baseSettings, 'finance.commission.min_amount': 15_000 }));
    const commission = await pricing.calculateCommission({
      itemsTotal: 50_000,
      discountTotal: 0,
      deliveryFee: 0,
      ratePercent: 7,
      courierSharePercent: 85,
    });
    expect(commission.platformAmount).toBe(15_000);
    expect(commission.sellerNetAmount).toBe(35_000);
  });

  it('تغییر تنظیمات، نتیجه را تغییر می‌دهد (اثبات پیکربندی‌پذیر بودن)', async () => {
    const before = new PricingService(settingsStub(baseSettings));
    const after = new PricingService(settingsStub({ ...baseSettings, 'finance.commission.percent': 12, 'finance.delivery.base_fee': 40_000 }));
    const input = { itemsTotal: 1_000_000, discountTotal: 0, deliveryFee: 25_000, ratePercent: 0, courierSharePercent: 85 };
    expect((await before.calculateCommission({ ...input, ratePercent: await before.commissionRatePercent() })).platformAmount).toBe(70_000);
    expect((await after.calculateCommission({ ...input, ratePercent: await after.commissionRatePercent() })).platformAmount).toBe(120_000);
    expect((await before.estimateDeliveryFee({ distanceKm: 0 })).total).toBe(25_000);
    expect((await after.estimateDeliveryFee({ distanceKm: 0 })).total).toBe(40_000);
  });

  it('نرخ کارمزد اختصاصی فروشنده بر تنظیمات سراسری اولویت دارد', async () => {
    const pricing = new PricingService(settingsStub(baseSettings));
    expect(await pricing.commissionRatePercent(null)).toBe(7);
    expect(await pricing.commissionRatePercent(4.5)).toBe(4.5);
  });

  it('همه مبالغ خروجی عدد صحیح هستند', async () => {
    const pricing = new PricingService(settingsStub({ ...baseSettings, 'finance.commission.percent': 3.33 }));
    const commission = await pricing.calculateCommission({
      itemsTotal: 123_457,
      discountTotal: 1234,
      deliveryFee: 45_678,
      ratePercent: 3.33,
      courierSharePercent: 85,
    });
    for (const value of [commission.commissionBase, commission.platformAmount, commission.sellerNetAmount, commission.courierAmount]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
