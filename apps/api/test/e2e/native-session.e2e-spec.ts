import { DEMO, createTestApp, type TestContext } from './app.helper';

/** نشست اندروید: refreshToken در body فقط برای X-Client-Platform=native */
describe('نشست کلاینت نیتیو (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await ctx?.close();
  });

  it('۴۰) اندروید refreshToken می‌گیرد و بدون کوکی نشست را تمدید می‌کند', async () => {
    const login = await ctx.http
      .post('/api/v1/auth/login')
      .set('X-Client-Platform', 'android')
      .send({ mobile: DEMO.mechanic, password: 'CarPart!12345' })
      .expect(200);

    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.refreshToken).toBeTruthy();

    // عمداً هیچ Cookie ارسال نمی‌شود؛ توکن نیتیو در body است
    const refreshed = await ctx.http
      .post('/api/v1/auth/refresh')
      .set('X-Client-Platform', 'android')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.body.refreshToken).toBeTruthy();
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken); // rotation
  });

  it('۴۱) وب refreshToken را در body دریافت نمی‌کند (فقط کوکی httpOnly)', async () => {
    const login = await ctx.http
      .post('/api/v1/auth/login')
      .send({ mobile: DEMO.mechanic2, password: 'CarPart!12345' })
      .expect(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.refreshToken).toBeUndefined();
    expect(login.headers['set-cookie']).toBeTruthy();
  });
});
