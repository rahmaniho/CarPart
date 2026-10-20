import { Like, type DataSource } from 'typeorm';
import { AuditLog } from '../../src/modules/audit/entities/audit-log.entity';
import { Notification } from '../../src/modules/notifications/entities/notification.entity';
import { Seller } from '../../src/modules/sellers/entities/seller.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { DEMO, createTestApp, login, waitFor, type Session, type TestContext } from './app.helper';

/**
 * آزمون‌های سرتاسری امنیت، دسترسی‌ها و پنل مدیریت.
 *
 * سناریوها: احراز هویت و چرخش رفرش توکن، کنترل دسترسی نقش‌ها (اپراتور ≠ مدیر مالی)،
 * ثبت گزارش ممیزی برای عملیات حساس، اعتبارسنجی ورودی و محدوده تنظیمات،
 * تأیید هویت فروشنده/پیک، محدودسازی داده عمومی و اعلان‌ها.
 */
describe('امنیت، دسترسی‌ها و مدیریت (e2e)', () => {
  let ctx: TestContext;
  let dataSource: DataSource;
  let admin: Session;
  let operator: Session;
  let mechanic: Session;
  let seller: Session;
  let courier: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    dataSource = ctx.dataSource;
    [admin, operator, mechanic, seller, courier] = await Promise.all([
      login(ctx, DEMO.admin),
      login(ctx, DEMO.operator),
      login(ctx, DEMO.mechanic),
      login(ctx, DEMO.seller),
      login(ctx, DEMO.courier),
    ]);
  }, 120_000);

  afterAll(async () => {
    await ctx?.close();
  });

  it('۲۳) دسترسی بدون توکن یا با توکن نامعتبر رد می‌شود', async () => {
    await ctx.http.get('/api/v1/orders').expect(401);
    const invalid = await ctx.http.get('/api/v1/orders').set('Authorization', 'Bearer not-a-real-token');
    expect(invalid.status).toBe(401);
    expect(invalid.body.code).toBe('TOKEN_INVALID');
    expect(invalid.body.requestId).toBeTruthy();
    expect(invalid.body.faMessage).toBeTruthy();

    // مسیرهای عمومی بدون توکن در دسترس‌اند
    await ctx.http.get('/api/v1/public/settings').expect(200);
    await ctx.http.get('/health').expect(200);
  }, 60_000);

  it('۲۴) چرخش رفرش توکن و ابطال نشست در استفاده مجدد', async () => {
    const requested = await ctx.http.post('/api/v1/auth/otp/request').send({ mobile: DEMO.mechanic2, purpose: 'login' }).expect(200);
    const first = await ctx.http
      .post('/api/v1/auth/otp/verify')
      .send({ mobile: DEMO.mechanic2, code: requested.body.devCode, purpose: 'login' })
      .expect(200);
    const refreshCookie = ((first.headers['set-cookie'] as unknown as string[] | undefined) ?? []).find((cookie) => cookie.startsWith('carpart_rt=')) as string;
    expect(refreshCookie).toBeTruthy();
    expect(refreshCookie).toContain('HttpOnly');
    const refreshToken = refreshCookie.split(';')[0].replace('carpart_rt=', '');

    const rotated = await ctx.http.post('/api/v1/auth/refresh').set('Cookie', `carpart_rt=${refreshToken}`).send({}).expect(200);
    expect(rotated.body.accessToken).toBeTruthy();
    const newCookie = ((rotated.headers['set-cookie'] as unknown as string[] | undefined) ?? []).find((cookie) => cookie.startsWith('carpart_rt=')) as string;
    const newToken = newCookie.split(';')[0].replace('carpart_rt=', '');
    expect(newToken).not.toBe(refreshToken);

    // استفاده مجدد از رفرش توکن قدیمی باید رد شود (نشانه سرقت نشست)
    const replay = await ctx.http.post('/api/v1/auth/refresh').set('Cookie', `carpart_rt=${refreshToken}`).send({});
    expect(replay.status).toBe(401);
  }, 90_000);

  it('۲۵) دسترسی‌های ریز: اپراتور پشتیبانی به مالی و تنظیمات دسترسی ندارد', async () => {
    await ctx.http.get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${operator.token}`).expect(200);
    const settingsRead = await ctx.http.get('/api/v1/admin/settings').set('Authorization', `Bearer ${operator.token}`);
    expect(settingsRead.status).toBe(403);
    const finance = await ctx.http.get('/api/v1/admin/finance/summary').set('Authorization', `Bearer ${operator.token}`);
    expect(finance.status).toBe(403);
    const payouts = await ctx.http.get('/api/v1/admin/finance/payouts').set('Authorization', `Bearer ${operator.token}`);
    expect(payouts.status).toBe(403);
    const audit = await ctx.http.get('/api/v1/admin/audit').set('Authorization', `Bearer ${operator.token}`);
    expect(audit.status).toBe(403);

    // مدیر به همه آن‌ها دسترسی دارد
    await ctx.http.get('/api/v1/admin/settings').set('Authorization', `Bearer ${admin.token}`).expect(200);
    await ctx.http.get('/api/v1/admin/finance/summary').set('Authorization', `Bearer ${admin.token}`).expect(200);
    await ctx.http.get('/api/v1/admin/audit').set('Authorization', `Bearer ${admin.token}`).expect(200);

    // نقش‌های غیرمدیر هیچ‌کدام را نمی‌بینند
    await ctx.http.get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${mechanic.token}`).expect(403);
    await ctx.http.get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${seller.token}`).expect(403);
  }, 90_000);

  it('۲۶) عملیات حساس مدیر در گزارش ممیزی ثبت می‌شود', async () => {
    const before = await dataSource.getRepository(AuditLog).count();
    await ctx.http
      .patch('/api/v1/admin/settings/finance.commission.percent')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ value: '8' })
      .expect(200);
    const after = await dataSource.getRepository(AuditLog).count();
    expect(after).toBeGreaterThan(before);

    const logs = await ctx.http
      .get('/api/v1/admin/audit?action=setting.update')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const entry = logs.body.items[0];
    expect(entry.action).toBe('setting.update');
    expect(entry.actorName || entry.actorMobile).toBeTruthy();
    expect(entry.faDescription).toBeTruthy();

    // بازگرداندن مقدار پیش‌فرض
    await ctx.http
      .patch('/api/v1/admin/settings/finance.commission.percent')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ value: '7' })
      .expect(200);
  }, 90_000);

  it('۲۷) تنظیمات بیرون از محدوده مجاز رد می‌شود و تغییر آن در قیمت‌گذاری اثر دارد', async () => {
    const invalid = await ctx.http
      .patch('/api/v1/admin/settings/finance.commission.percent')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ value: '95' });
    expect([400, 422]).toContain(invalid.status);

    const notFound = await ctx.http
      .patch('/api/v1/admin/settings/finance.unknown.key')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ value: '1' });
    expect(notFound.status).toBe(404);

    const before = await ctx.http.get('/api/v1/admin/finance/commission-rate').set('Authorization', `Bearer ${admin.token}`).expect(200);
    expect(before.body.ratePercent).toBe(7);
    await ctx.http
      .patch('/api/v1/admin/settings/finance.commission.percent')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ value: '10' })
      .expect(200);
    const after = await ctx.http.get('/api/v1/admin/finance/commission-rate').set('Authorization', `Bearer ${admin.token}`).expect(200);
    expect(after.body.ratePercent).toBe(10);
    await ctx.http
      .patch('/api/v1/admin/settings/finance.commission.percent')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ value: '7' })
      .expect(200);
  }, 90_000);

  it('۲۸) فروشنده تأییدنشده نمی‌تواند محصول ثبت کند و پس از تأیید مدیر می‌تواند', async () => {
    // ثبت‌نام فروشنده جدید؛ پروفایل او تا تأیید مدیر «در انتظار بررسی» می‌ماند
    const newMobile = '09124440001';
    const signup = await ctx.http
      .post('/api/v1/auth/register')
      .send({ mobile: newMobile, fullName: 'فروشنده آزمون', role: 'seller', storeName: 'فروشگاه آزمون', city: 'تهران' })
      .expect(201);
    expect(signup.body.otp.simulated).toBe(true);
    const registered = await ctx.http
      .post('/api/v1/auth/otp/verify')
      .send({ mobile: newMobile, code: signup.body.otp.devCode, purpose: 'mobile_verify' })
      .expect(200);
    expect(registered.body.user.roles).toContain('seller');

    // درخواست کد ورود برای شماره ثبت‌نشده باید راهنمای ثبت‌نام بدهد (نه پیام مبهم)
    const unknownLogin = await ctx.http.post('/api/v1/auth/otp/request').send({ mobile: '09124440099', purpose: 'login' });
    expect(unknownLogin.status).toBe(404);
    expect(unknownLogin.body.code).toBe('NOT_FOUND');
    const newSellerToken = registered.body.accessToken as string;

    await ctx.http
      .put('/api/v1/sellers/me')
      .set('Authorization', `Bearer ${newSellerToken}`)
      .send({ storeName: 'فروشگاه آزمون', city: 'تهران', phone: newMobile, nationalId: '1400123456' })
      .expect((res) => {
        if (![200, 201].includes(res.status)) throw new Error(`ثبت پروفایل فروشنده ناموفق: ${res.status}`);
      });

    // ارسال برای بررسی بدون شعبه باید رد شود (داده ناقص وارد صف تأیید نمی‌شود)
    const incomplete = await ctx.http.post('/api/v1/sellers/me/submit-review').set('Authorization', `Bearer ${newSellerToken}`);
    expect(incomplete.status).toBe(409);
    expect(incomplete.body.code).toBe('PROFILE_INCOMPLETE');

    await ctx.http
      .post('/api/v1/sellers/me/branches')
      .set('Authorization', `Bearer ${newSellerToken}`)
      .send({ name: 'شعبه مرکزی آزمون', city: 'تهران', addressText: 'تهران، خیابان آزادی', lat: 35.7, lng: 51.37 });
    const submitted = await ctx.http.post('/api/v1/sellers/me/submit-review').set('Authorization', `Bearer ${newSellerToken}`);
    expect([200, 201]).toContain(submitted.status);
    expect(submitted.body.verificationStatus).toBe('PENDING_REVIEW');

    const parts = await ctx.http.get('/api/v1/catalog/parts?pageSize=1').set('Authorization', `Bearer ${newSellerToken}`).expect(200);
    const blocked = await ctx.http
      .post('/api/v1/sellers/me/products')
      .set('Authorization', `Bearer ${newSellerToken}`)
      .send({ partId: parts.body.items[0].id, price: 500_000, stock: 5, quality: 'aftermarket_high' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('ACCOUNT_NOT_VERIFIED');

    // تأیید توسط مدیر از طریق صف تأیید هویت
    const queue = await ctx.http.get('/api/v1/admin/verifications/seller').set('Authorization', `Bearer ${admin.token}`).expect(200);
    const pending = queue.body.find((row: { userId: string }) => row.userId === registered.body.user.id);
    expect(pending).toBeTruthy();
    await ctx.http
      .post(`/api/v1/admin/verifications/seller/${pending.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ note: 'مدارک بررسی شد' })
      .expect(201);

    const approved = await ctx.http
      .post('/api/v1/sellers/me/products')
      .set('Authorization', `Bearer ${newSellerToken}`)
      .send({ partId: parts.body.items[0].id, price: 500_000, stock: 5, quality: 'aftermarket_high' });
    expect([200, 201]).toContain(approved.status);

    // اپراتور اجازه تأیید هویت فروشنده را ندارد
    const operatorAttempt = await ctx.http
      .post(`/api/v1/admin/verifications/seller/${pending.id}/reject`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ reason: 'تلاش نامجاز' });
    expect(operatorAttempt.status).toBe(403);
  }, 120_000);

  it('۲۹) داده عمومی فقط فروشگاه‌های تأییدشده را نشان می‌دهد و اطلاعات حساس ندارد', async () => {
    const approved = await dataSource.getRepository(Seller).find({ where: { verificationStatus: 'APPROVED' } });
    const target = approved[approved.length - 1];
    const approvedView = await ctx.http.get(`/api/v1/public/sellers/${target.id}`).expect(200);
    expect(approvedView.body.storeName).toBeTruthy();
    expect(approvedView.body.payoutInfoEncrypted).toBeUndefined();
    expect(approvedView.body.nationalId).toBeUndefined();

    await dataSource.getRepository(Seller).update({ id: target.id }, { verificationStatus: 'PENDING_REVIEW' });
    await ctx.http.get(`/api/v1/public/sellers/${target.id}`).expect(404);
    await dataSource.getRepository(Seller).update({ id: target.id }, { verificationStatus: target.verificationStatus });
  }, 60_000);

  it('۳۰) ورودی نامعتبر با پیام فارسی و کد ماشین‌خوان رد می‌شود', async () => {
    const response = await ctx.http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ items: [{ sellerProductId: 'not-a-uuid', quantity: 0 }] });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(response.body.errors.length).toBeGreaterThan(0);
    expect(response.body.errors[0].message).toBeTruthy();

    const unknownField = await ctx.http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ items: [], status: 'COMPLETED', payableTotal: 1 });
    expect(unknownField.status).toBe(400);
  }, 60_000);

  it('۳۱) اعلان درون‌برنامه‌ای برای رویداد سفارش ساخته می‌شود و پیامک شبیه‌سازی‌شده علامت می‌خورد', async () => {
    const addresses = await ctx.http.get('/api/v1/workshops/me/addresses').set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    const search = await ctx.http.get('/api/v1/catalog/search').query({ q: 'فیلتر روغن', pageSize: 10 }).expect(200);
    const offer = search.body.items.find((item: { stock: number }) => item.stock > 2);
    const created = await ctx.http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .set('Idempotency-Key', `t-notify-${Date.now()}`)
      .send({ items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], deliveryAddressId: addresses.body[0].id })
      .expect(201);

    const orderId = created.body.id as string;

    // اعلان درون‌برنامه‌ای «ثبت سفارش» برای مالک سفارش (کلید یکتاسازی شامل شناسه سفارش است)
    const ownerRows = await dataSource.getRepository(Notification).find({ where: { dedupeKey: Like(`order.created.owner:${orderId}%`) } });
    expect(ownerRows.length).toBe(1);
    const inApp = ownerRows[0];
    expect(inApp.channel).toBe('inapp');
    expect(inApp.titleFa).toBeTruthy();
    expect(inApp.status).toBe('sent');
    expect(inApp.isSimulated).toBe(false);
    expect((inApp.data as { orderId?: string } | null)?.orderId).toBe(orderId);

    // پرداخت آزمایشی، رویداد order.paid را روی کانال درون‌برنامه‌ای و پیامک منتشر می‌کند
    await ctx.http.post('/api/v1/payments').set('Authorization', `Bearer ${mechanic.token}`).send({ orderId }).expect(201);
    await ctx.http
      .post('/api/v1/payments/sandbox/confirm')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ orderId, decision: 'paid' })
      .expect(201);

    const paidRows = await waitFor(
      async () => dataSource.getRepository(Notification).find({ where: { userId: mechanic.user.id, eventKey: 'order.paid' } }),
      (rows) => rows.some((row) => row.channel === 'sms'),
      20_000,
    );
    const smsRows = paidRows.filter((row) => row.channel === 'sms');
    expect(smsRows.length).toBeGreaterThan(0);
    // ارائه‌دهنده پیامک در محیط آزمون Mock است، پس اعلان باید صادقانه «شبیه‌سازی‌شده» علامت بخورد
    for (const row of smsRows) expect(row.isSimulated).toBe(true);
    expect(paidRows.some((row) => row.channel === 'inapp')).toBe(true);

    // کلید یکتاسازی از ساخت اعلان تکراری جلوگیری می‌کند
    const duplicate = await dataSource.getRepository(Notification).count({ where: { dedupeKey: `order.created.owner:${orderId}:inapp` } });
    expect(duplicate).toBe(1);

    const mine = await ctx.http.get('/api/v1/notifications').set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    expect(mine.body.items.length).toBeGreaterThan(0);
  }, 90_000);

  it('۳۲) مدیر می‌تواند نقش کاربر را تغییر دهد و این عملیات ممیزی می‌شود', async () => {
    const target = await dataSource.getRepository(User).findOne({ where: { mobile: DEMO.mechanic2 } });
    const before = await dataSource.getRepository(AuditLog).count();
    const updated = await ctx.http
      .patch(`/api/v1/admin/users/${target!.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ roles: ['mechanic', 'courier'] });
    expect([200, 201]).toContain(updated.status);
    expect(updated.body.roles).toEqual(expect.arrayContaining(['mechanic', 'courier']));

    const after = await dataSource.getRepository(AuditLog).count();
    expect(after).toBeGreaterThan(before);

    // بازگرداندن نقش‌ها
    await ctx.http
      .patch(`/api/v1/admin/users/${target!.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ roles: ['mechanic'] })
      .expect(200);

    // اپراتور اجازه تغییر نقش ندارد
    const forbidden = await ctx.http
      .patch(`/api/v1/admin/users/${target!.id}`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ roles: ['admin'] });
    expect(forbidden.status).toBe(403);
  }, 90_000);

  it('۳۳) بارگذاری فایل با نوع یا حجم نامعتبر رد می‌شود', async () => {
    const info = await ctx.http.get('/api/v1/files/info').set('Authorization', `Bearer ${seller.token}`).expect(200);
    expect(info.body.allowedMime).toEqual(expect.arrayContaining(['image/jpeg', 'image/png']));
    expect(info.body.maxFileMb).toBeGreaterThan(0);

    // فایل متنی با پسوند jpg (امضای بایتی نامعتبر)
    const notAnImage = Buffer.from('این یک فایل متنی است و تصویر نیست', 'utf8');
    const rejected = await ctx.http
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${seller.token}`)
      .attach('file', notAnImage, { filename: 'fake.jpg', contentType: 'image/jpeg' })
      .field('kind', 'product');
    expect([400, 415]).toContain(rejected.status);

    const oversized = Buffer.alloc((info.body.maxFileMb + 1) * 1024 * 1024, 1);
    const tooLarge = await ctx.http
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${seller.token}`)
      .attach('file', oversized, { filename: 'big.png', contentType: 'image/png' })
      .field('kind', 'product');
    expect([400, 413]).toContain(tooLarge.status);
  }, 120_000);

  it('۳۴) پیک و فروشنده فقط به داده‌های خود دسترسی دارند', async () => {
    await ctx.http.get('/api/v1/couriers/me').set('Authorization', `Bearer ${courier.token}`).expect(200);
    await ctx.http.get('/api/v1/couriers/me').set('Authorization', `Bearer ${mechanic.token}`).expect(403);
    await ctx.http.get('/api/v1/sellers/me').set('Authorization', `Bearer ${seller.token}`).expect(200);
    await ctx.http.get('/api/v1/sellers/me').set('Authorization', `Bearer ${courier.token}`).expect(403);
  }, 60_000);
});
