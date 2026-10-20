import { RankingService, DEFAULT_WEIGHTS, type OfferRankInput } from '../../src/modules/catalog/ranking.service';
import type { SystemSettingsService } from '../../src/modules/settings/system-settings.service';

function settingsStub(values: Record<string, unknown> = {}): SystemSettingsService {
  return {
    getNumber: async (key: string, fallback: number) => (key in values ? Number(values[key]) : fallback),
    getJson: async <T>(key: string, fallback: T) => (key in values ? (values[key] as T) : fallback),
  } as unknown as SystemSettingsService;
}

function offer(overrides: Partial<OfferRankInput> = {}): OfferRankInput {
  return {
    sellerProductId: 'sp-1',
    compatibility: 'exact',
    price: 700_000,
    deliveryFee: 25_000,
    preparationMinutes: 30,
    etaMinutes: 60,
    distanceKm: 5,
    sellerRating: 4.5,
    sellerRatingCount: 40,
    cancellationRate: 0,
    mismatchRate: 0,
    stock: 10,
    ...overrides,
  };
}

/**
 * آزمون ۴ — موتور رتبه‌بندی: شفاف، قابل پیکربندی، و مستقل از کارمزد پلتفرم.
 */
describe('موتور رتبه‌بندی پیشنهادها', () => {
  it('وزن‌ها همیشه به ۱۰۰ نرمال می‌شوند و از تنظیمات خوانده می‌گردند', async () => {
    const ranking = new RankingService(settingsStub({ 'ranking.weights': { price: 50, compatibility: 50 } }));
    const weights = await ranking.getWeights();
    const total = Object.values(weights).reduce((acc, value) => acc + value, 0);
    expect(Math.round(total)).toBe(100);
    expect(weights.price).toBeGreaterThan(DEFAULT_WEIGHTS.price);
  });

  it('وزن‌های نامعتبر/خالی به پیش‌فرض بازمی‌گردند', async () => {
    const ranking = new RankingService(settingsStub({ 'ranking.weights': { price: -5 } }));
    const weights = await ranking.getWeights();
    expect(Object.values(weights).every((value) => value >= 0)).toBe(true);
    expect(Math.round(Object.values(weights).reduce((acc, value) => acc + value, 0))).toBe(100);
  });

  it('سازگاری ناسازگار امتیاز صفر می‌گیرد و هشدار فارسی اجباری است', async () => {
    const ranking = new RankingService(settingsStub());
    const [exact, unknown, incompatible] = await ranking.rankOffers([
      offer({ sellerProductId: 'a', compatibility: 'exact' }),
      offer({ sellerProductId: 'b', compatibility: 'unknown' }),
      offer({ sellerProductId: 'c', compatibility: 'incompatible' }),
    ]);
    expect(exact.total).toBeGreaterThan(unknown.total);
    expect(unknown.total).toBeGreaterThan(incompatible.total);
    expect(unknown.warnings.join(' ')).toContain('تأیید نشده');
    expect(incompatible.warnings.join(' ')).toContain('ناسازگار');
    expect(exact.warnings).toHaveLength(0);
  });

  it('پیشنهاد بدون موجودی امتیاز کل صفر می‌گیرد', async () => {
    const ranking = new RankingService(settingsStub());
    const [out] = await ranking.rankOffers([offer({ stock: 0 }), offer({ stock: 3 })]);
    expect(out.total).toBe(0);
    expect(out.warnings.join(' ')).toContain('موجودی ندارد');
  });

  it('توضیح رتبه‌بندی شامل همه عوامل با وزن، امتیاز و سهم هر عامل است', async () => {
    const ranking = new RankingService(settingsStub());
    const [best] = await ranking.rankOffers([offer()]);
    expect(best.explanation.transparent).toBe(true);
    const keys = best.explanation.factors.map((factor) => factor.key);
    expect(keys).toEqual(
      expect.arrayContaining(['compatibility', 'price', 'deliveryFee', 'preparation', 'eta', 'distance', 'sellerRating', 'reliability']),
    );
    for (const factor of best.explanation.factors) {
      expect(factor.fa.length).toBeGreaterThan(2);
      expect(factor.contribution).toBeCloseTo((factor.score * factor.weight) / 1, 0);
    }
  });

  it('کارمزد پلتفرم هیچ‌گاه عامل رتبه‌بندی نیست (حتی با تغییر نرخ کارمزد)', async () => {
    const lowCommission = new RankingService(settingsStub({ 'ranking.weights': {} }));
    const highCommission = new RankingService(settingsStub({ 'ranking.weights': {} }));
    const offers = [offer({ sellerProductId: 'a', price: 600_000 }), offer({ sellerProductId: 'b', price: 900_000 })];
    const first = await lowCommission.rankOffers(offers);
    const second = await highCommission.rankOffers(offers);
    expect(first.map((item) => item.total)).toEqual(second.map((item) => item.total));
    for (const item of first) {
      expect(item.explanation.factors.some((factor) => /commission|کارمزد/.test(factor.key + factor.fa))).toBe(false);
    }
  });

  it('جایگاه ویژه (تبلیغ پرداخت‌شده) فقط با تنظیم فعال و به‌صورت شفاف اضافه می‌شود', async () => {
    const ranking = new RankingService(settingsStub({ 'ranking.featured_boost': 6 }));
    const [featured, normal] = await ranking.rankOffers([
      offer({ sellerProductId: 'featured', isFeatured: true, price: 900_000 }),
      offer({ sellerProductId: 'normal', price: 900_000 }),
    ]);
    const featuredFactor = featured.explanation.factors.find((factor) => factor.key === 'featured');
    expect(featuredFactor?.fa).toContain('جایگاه ویژه');
    expect(featured.total - normal.total).toBeCloseTo(6, 1);
  });

  it('سابقه لغو و مغایرت، امتیاز اعتبار را کاهش می‌دهد', async () => {
    const ranking = new RankingService(settingsStub());
    const [clean, risky] = await ranking.rankOffers([
      offer({ sellerProductId: 'clean' }),
      offer({ sellerProductId: 'risky', cancellationRate: 0.3, mismatchRate: 0.2 }),
    ]);
    expect(clean.total).toBeGreaterThan(risky.total);
  });
});
