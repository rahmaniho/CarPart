import type { DataSource } from 'typeorm';
import { Notification } from '../../src/modules/notifications/entities/notification.entity';
import { DeviceToken } from '../../src/modules/notifications/entities/device-token.entity';
import { DEMO, createTestApp, login, waitFor, type Session, type TestContext } from './app.helper';

/**
 * اعلان فشاری (Push) — ثبت توکن دستگاه، ارسال با فراهم‌کننده آزمایشی و صداقت‌سازی.
 */
describe('اعلان فشاری (e2e)', () => {
  let ctx: TestContext;
  let dataSource: DataSource;
  let mechanic: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    dataSource = ctx.dataSource;
    mechanic = await login(ctx, DEMO.mechanic);
  }, 120_000);

  afterAll(async () => {
    await ctx?.close();
  });

  async function createOrder(): Promise<string> {
    const search = await ctx.http.get('/api/v1/catalog/search?q=%D9%84%D9%86%D8%AA&pageSize=20').expect(200);
    const offer = (search.body.items as Array<{ sellerProductId: string; stock: number }>).find((item) => item.stock > 0);
    expect(offer).toBeTruthy();
    const order = await ctx.http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ items: [{ sellerProductId: offer!.sellerProductId, quantity: 1 }] })
      .expect(201);
    return order.body.id as string;
  }

  it('۳۸) ثبت توکن دستگاه و دریافت اعلان فشاری با نشان شبیه‌سازی', async () => {
    const registered = await ctx.http
      .post('/api/v1/notifications/device-tokens')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ token: 'fcm-token-test-001', platform: 'android', appFlavor: 'mechanic' })
      .expect(201);
    expect(registered.body.platform).toBe('android');

    const listed = await ctx.http.get('/api/v1/notifications/device-tokens').set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    expect(listed.body.some((row: { id: string }) => row.id === registered.body.id)).toBe(true);

    // ثبت مجدد همان توکن نباید ردیف تکراری بسازد
    await ctx.http
      .post('/api/v1/notifications/device-tokens')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ token: 'fcm-token-test-001', platform: 'android', appFlavor: 'mechanic' })
      .expect(201);
    expect(await dataSource.getRepository(DeviceToken).count({ where: { token: 'fcm-token-test-001' } })).toBe(1);

    // با دستگاه فعال، رویداد order.created باید رکورد push هم بسازد
    await dataSource.getRepository(Notification).delete({ userId: mechanic.user.id, channel: 'push' });
    await createOrder();

    const pushRows = await waitFor(
      async () => dataSource.getRepository(Notification).find({ where: { userId: mechanic.user.id, channel: 'push' } }),
      (rows) => rows.length > 0,
      20_000,
    );
    expect(pushRows.length).toBeGreaterThan(0);
    // فراهم‌کننده آزمایشی: باید صادقانه «شبیه‌سازی‌شده» علامت بخورد
    for (const row of pushRows) expect(row.isSimulated).toBe(true);
    expect(pushRows[0].titleFa).toBeTruthy();
    expect(pushRows[0].eventKey).toBe('order.created');
  }, 120_000);

  it('۳۹) پس از حذف توکن دستگاه، اعلان فشاری جدید ساخته نمی‌شود', async () => {
    const removed = await ctx.http
      .delete('/api/v1/notifications/device-tokens/fcm-token-test-001')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .expect(200);
    expect(removed.body.removed).toBe(true);

    await dataSource.getRepository(Notification).delete({ userId: mechanic.user.id, channel: 'push' });
    await createOrder();

    // مهلت کافی برای صف اعلان؛ بدون دستگاه فعال نباید هیچ رکورد push ساخته شود
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pushRows = await dataSource.getRepository(Notification).count({ where: { userId: mechanic.user.id, channel: 'push' } });
    expect(pushRows).toBe(0);

    // اما اعلان درون‌برنامه‌ای همچنان ساخته می‌شود (کانال‌ها مستقل‌اند)
    const inApp = await dataSource.getRepository(Notification).count({ where: { userId: mechanic.user.id, channel: 'inapp', eventKey: 'order.created' } });
    expect(inApp).toBeGreaterThan(0);
  }, 90_000);
});
