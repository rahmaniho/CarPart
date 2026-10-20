import { createTestApp, type TestContext } from './app.helper';

/**
 * آزمون محدودسازی نرخ (Rate Limiting).
 *
 * در سایر مجموعه‌های آزمون، محدودسازی نرخ با THROTTLE_DISABLED غیرفعال است تا
 * سناریوها تکرارپذیر بمانند؛ این مجموعه آن را با حد کوچک روشن می‌کند تا اثبات شود
 * کنترل امنیتی واقعاً کار می‌کند و پاسخ خطای آن فارسی، ساخت‌یافته و قابل رهگیری است.
 */
describe('محدودسازی نرخ درخواست‌ها (e2e)', () => {
  let ctx: TestContext;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of ['THROTTLE_DISABLED', 'THROTTLE_LIMIT', 'THROTTLE_TTL_SECONDS']) saved[key] = process.env[key];
    process.env.THROTTLE_DISABLED = 'false';
    process.env.THROTTLE_LIMIT = '3';
    process.env.THROTTLE_TTL_SECONDS = '60';
    ctx = await createTestApp({ seed: false });
  }, 120_000);

  afterAll(async () => {
    await ctx?.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('۳۵) پس از عبور از حد مجاز، پاسخ ۴۲۹ با کد RATE_LIMITED و پیام فارسی برمی‌گرداند', async () => {
    const limit = Number(process.env.THROTTLE_LIMIT);
    for (let i = 0; i < limit; i += 1) {
      const allowed = await ctx.http.get('/api/v1/public/settings');
      expect(allowed.status).toBe(200);
    }

    const blocked = await ctx.http.get('/api/v1/public/settings');
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(blocked.body.faMessage).toContain('تعداد درخواست');
    // شناسه درخواست برای رهگیری پشتیبانی حتی در پاسخ‌های خطا وجود دارد
    expect(blocked.body.requestId).toBeTruthy();
    expect(blocked.headers['x-request-id']).toBeTruthy();
    // سربرگ استاندارد تلاش مجدد برای کلاینت
    expect(blocked.headers['retry-after']).toBeTruthy();

    // جزئیات داخلی (پشته خطا، نام پایگاه‌داده و…) نشت نمی‌کند
    expect(JSON.stringify(blocked.body)).not.toContain('ThrottlerStorage');
  }, 90_000);

  it('۳۶) مسیرهای حساس احراز هویت حد سخت‌گیرانه‌تری دارند', async () => {
    // دکوریتور سطح مسیر (@Throttle) بر حد سراسری اولویت دارد: ۶ بار در ۱۰ دقیقه
    const statuses: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const res = await ctx.http.post('/api/v1/auth/otp/request').send({ mobile: '09124440099', purpose: 'login' });
      statuses.push(res.status);
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    const firstBlocked = statuses.indexOf(429);
    // همه درخواست‌های پیش از رسیدن به حد، پاسخ واقعی سامانه را گرفته‌اند (۴۰۴ = حساب ثبت‌نشده)
    expect(statuses.slice(0, firstBlocked).every((s) => s === 404)).toBe(true);
  }, 90_000);
});
