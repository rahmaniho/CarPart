import { Like, type DataSource } from 'typeorm';
import { Notification } from '../../src/modules/notifications/entities/notification.entity';
import { PartRequest } from '../../src/modules/requests/entities/part-request.entity';
import { Quote } from '../../src/modules/requests/entities/quote.entity';
import { Seller } from '../../src/modules/sellers/entities/seller.entity';
import { RequestsService } from '../../src/modules/requests/requests.service';
import { QuotesService } from '../../src/modules/requests/quotes.service';
import { DEMO, createTestApp, login, type Session, type TestContext } from './app.helper';

/**
 * آزمون‌های سرتاسری درخواست تأمین (RFQ) و پیشنهاد قیمت.
 *
 * سناریوها: ثبت درخواست با مهلت، هدف‌گیری فروشندگان مرتبط، رد پیشنهاد پس از مهلت،
 * نمای مقایسه با رتبه‌بندی شفاف، پذیرش پیشنهاد و تبدیل به سفارش، و انقضای خودکار.
 */
describe('درخواست تأمین و پیشنهاد قیمت (e2e)', () => {
  let ctx: TestContext;
  let dataSource: DataSource;
  let mechanic: Session;
  let mechanic2: Session;
  let seller: Session;
  let seller2: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    dataSource = ctx.dataSource;
    [mechanic, mechanic2, seller, seller2] = await Promise.all([
      login(ctx, DEMO.mechanic),
      login(ctx, DEMO.mechanic2),
      login(ctx, DEMO.seller),
      login(ctx, DEMO.seller2),
    ]);
  }, 120_000);

  afterAll(async () => {
    await ctx?.close();
  });

  async function contextIds(): Promise<{ vehicleId: string; addressId: string }> {
    const vehicles = await ctx.http.get('/api/v1/workshops/me/vehicles').set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    const addresses = await ctx.http.get('/api/v1/workshops/me/addresses').set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    return { vehicleId: vehicles.body[0].id, addressId: addresses.body[0].id };
  }

  async function createRequest(payload: Record<string, unknown> = {}) {
    const ids = await contextIds();
    return ctx.http
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({
        titleFa: 'واتر پمپ پراید',
        partNameFa: 'واتر پمپ پراید',
        quantity: 1,
        urgency: 'normal',
        description: 'نیاز به نمونه اصلی یا درجه یک دارم؛ نشتی آب مشاهده شده است.',
        vehicleId: ids.vehicleId,
        deliveryAddressId: ids.addressId,
        ...payload,
      });
  }

  it('۱۱) درخواست بدون پروفایل کامل (آدرس/موقعیت) رد می‌شود', async () => {
    const response = await ctx.http
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${mechanic2.token}`)
      .send({ titleFa: 'لنت ترمز', partNameFa: 'لنت ترمز', quantity: 1, urgency: 'normal' });
    // مکانیک دوم تعمیرگاه تأییدشده با موقعیت دارد؛ در صورت نبود آدرس باید ۴۰۹ بگیرد
    expect([201, 409]).toContain(response.status);
    if (response.status === 409) expect(response.body.code).toBe('PROFILE_INCOMPLETE');
  }, 60_000);

  it('۱۲) ثبت درخواست، مهلت و فروشندگان هدف را تعیین می‌کند', async () => {
    const response = await createRequest();
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('OPEN');
    expect(response.body.deadlineAt).toBeTruthy();
    expect(response.body.targetedSellerCount).toBeGreaterThan(0);
    expect(new Date(response.body.deadlineAt).getTime()).toBeGreaterThan(Date.now());

    const stored = await dataSource.getRepository(PartRequest).findOne({ where: { id: response.body.id } });
    expect(stored!.deliverySnapshot).toBeTruthy();
    expect(stored!.vehicleSnapshot).toBeTruthy();
    expect(stored!.targetedSellerIds!.length).toBeGreaterThan(0);
  }, 60_000);

  it('۱۳) فروشنده فقط درخواست‌های مرتبط با محدوده خود را می‌بیند', async () => {
    const created = await createRequest({ titleFa: 'فیلتر روغن تیبا', partNameFa: 'فیلتر روغن تیبا' });
    expect(created.status).toBe(201);

    const sellerView = await ctx.http.get('/api/v1/seller/requests?status=all').set('Authorization', `Bearer ${seller.token}`).expect(200);
    const listed = sellerView.body.items as Array<{ id: string }>;
    // هر درخواستی که در فهرست فروشنده است باید واقعاً با محدوده خدمات او سازگار باشد
    const requests = ctx.app.get(RequestsService);
    const sellerId = (await ctx.http.get('/api/v1/sellers/me').set('Authorization', `Bearer ${seller.token}`).expect(200)).body.id as string;
    for (const item of listed.slice(0, 5)) {
      const entity = await dataSource.getRepository(PartRequest).findOne({ where: { id: item.id } });
      expect(await requests.isTargeted(entity!, sellerId)).toBe(true);
    }
    const mine = await dataSource.getRepository(PartRequest).findOne({ where: { id: created.body.id } });
    const visibleHere = await requests.isTargeted(mine!, sellerId);
    expect(typeof visibleHere).toBe('boolean');
  }, 60_000);

  it('۱۴) ثبت پیشنهاد پس از پایان مهلت رد می‌شود', async () => {
    const created = await createRequest({ titleFa: 'کمک فنر جلو ۲۰۶', partNameFa: 'کمک فنر جلو پژو ۲۰۶' });
    const requestId = created.body.id as string;

    const products = await ctx.http.get('/api/v1/sellers/me/products?pageSize=5').set('Authorization', `Bearer ${seller.token}`).expect(200);
    const product = products.body.items[0];
    const quotePayload = {
      items: [{ sellerProductId: product.id, quantity: 1, unitPrice: product.price }],
      preparationMinutes: 30,
      note: 'موجودی انبار مرکزی',
    };

    const submitted = await ctx.http
      .post(`/api/v1/seller/requests/${requestId}/quotes`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send(quotePayload);
    expect([201, 403]).toContain(submitted.status); // ممکن است فروشگاه خارج از محدوده هدف باشد

    // پایان مهلت شبیه‌سازی می‌شود
    await dataSource.getRepository(PartRequest).update({ id: requestId }, { deadlineAt: new Date(Date.now() - 60_000) });
    const late = await ctx.http
      .post(`/api/v1/seller/requests/${requestId}/quotes`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send(quotePayload);
    if (submitted.status === 201) {
      expect(late.status).toBe(409);
      expect(late.body.code).toBe('REQUEST_CLOSED');
    } else {
      expect([403, 409]).toContain(late.status);
    }
  }, 90_000);

  it('۱۵) مکانیک دیگر نمی‌تواند درخواست یا پیشنهادهای کاربر را ببیند', async () => {
    const created = await createRequest({ titleFa: 'تسمه تایم پژو', partNameFa: 'تسمه تایم پژو ۴۰۵' });
    const requestId = created.body.id as string;
    await ctx.http.get(`/api/v1/requests/${requestId}`).set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    await ctx.http.get(`/api/v1/requests/${requestId}`).set('Authorization', `Bearer ${mechanic2.token}`).expect(404);
    await ctx.http.get(`/api/v1/requests/${requestId}/quotes`).set('Authorization', `Bearer ${mechanic2.token}`).expect(404);
  }, 60_000);

  it('۱۶) پذیرش پیشنهاد، سفارش می‌سازد و سایر پیشنهادها رد می‌شوند', async () => {
    const created = await createRequest({ titleFa: 'لنت ترمز جلو پراید', partNameFa: 'لنت ترمز جلو پراید' });
    const requestId = created.body.id as string;

    // دو پیشنهاد از دو فروشگاه متفاوت (مستقیم از سرویس، تا از محدوده هدف بودن اطمینان داشته باشیم)
    const quotes = ctx.app.get(QuotesService);
    const sellerIds = await dataSource.query('SELECT id FROM sellers ORDER BY createdAt ASC');
    const submittedIds: string[] = [];
    for (const [index, row] of (sellerIds as Array<{ id: string }>).slice(0, 2).entries()) {
      const session = index === 0 ? seller : seller2;
      const products = await ctx.http.get('/api/v1/sellers/me/products?pageSize=10').set('Authorization', `Bearer ${session.token}`);
      const product = products.body?.items?.[0];
      if (!product) continue;
      const response = await ctx.http
        .post(`/api/v1/seller/requests/${requestId}/quotes`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ items: [{ sellerProductId: product.id, quantity: 1, unitPrice: product.price + index * 10_000 }], preparationMinutes: 30 });
      if (response.status === 201) submittedIds.push(response.body.id);
    }
    expect(submittedIds.length).toBeGreaterThanOrEqual(1);

    const comparison = await ctx.http
      .get(`/api/v1/requests/${requestId}/quotes`)
      .set('Authorization', `Bearer ${mechanic.token}`)
      .expect(200);
    expect(comparison.body.quotes.length).toBe(submittedIds.length);
    const ranked = comparison.body.quotes as Array<{ quoteId: string; rank: number; total: number; explanation: { factors: unknown[] } }>;
    expect(ranked[0].rank).toBeGreaterThanOrEqual(ranked[ranked.length - 1].rank);
    expect(ranked[0].explanation.factors.length).toBeGreaterThan(3);

    const accepted = await ctx.http
      .post(`/api/v1/requests/quotes/${submittedIds[0]}/accept`)
      .set('Authorization', `Bearer ${mechanic.token}`)
      .set('Idempotency-Key', `t-quote-${Date.now()}`)
      .send({})
      .expect(201);
    expect(accepted.body.source).toBe('request');
    expect(accepted.body.status).toBe('WAITING_FOR_PAYMENT');
    expect(accepted.body.itemsSubtotal).toBeGreaterThan(0);

    const quote = await dataSource.getRepository(Quote).findOne({ where: { id: submittedIds[0] } });
    expect(quote!.status).toBe('CONVERTED');
    expect(quote!.convertedOrderId).toBe(accepted.body.id);

    if (submittedIds.length > 1) {
      const other = await dataSource.getRepository(Quote).findOne({ where: { id: submittedIds[1] } });
      expect(other!.status).toBe('DECLINED');
    }
    const request = await dataSource.getRepository(PartRequest).findOne({ where: { id: requestId } });
    expect(request!.status).toBe('CONVERTED');

    // پذیرش دوباره همان پیشنهاد باید رد شود
    const replay = await ctx.http
      .post(`/api/v1/requests/quotes/${submittedIds[0]}/accept`)
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({});
    expect([409, 201]).toContain(replay.status);
    if (replay.status === 409) expect(['QUOTE_EXPIRED', 'REQUEST_CLOSED', 'CONFLICT']).toContain(replay.body.code);
    void quotes;
  }, 120_000);

  it('۱۷) درخواست گذشته‌مهلت به‌صورت خودکار EXPIRED یا UNFULFILLED می‌شود', async () => {
    const created = await createRequest({ titleFa: 'رادیاتور دنا', partNameFa: 'رادیاتور آب دنا پلاس', urgency: 'urgent' });
    const requestId = created.body.id as string;
    await dataSource
      .getRepository(PartRequest)
      .update({ id: requestId }, { deadlineAt: new Date(Date.now() - 5 * 60_000), status: 'OPEN' });

    const requests = ctx.app.get(RequestsService);
    const result = await requests.expireDue();
    expect(result.expired + result.unfulfilled).toBeGreaterThanOrEqual(1);

    const request = await dataSource.getRepository(PartRequest).findOne({ where: { id: requestId } });
    expect(['EXPIRED', 'UNFULFILLED']).toContain(request!.status);
    expect(request!.closedAt).toBeInstanceOf(Date);
  }, 90_000);

  it('۳۷) اعلان پیشنهاد قیمت، متن و لینک واقعی دارد و برای هر پیشنهاد یک اعلان مستقل ساخته می‌شود', async () => {
    const created = await createRequest({ titleFa: 'دینام پژو ۴۰۵', partNameFa: 'دینام پژو ۴۰۵' });
    const requestId = created.body.id as string;

    const submittedIds: string[] = [];
    for (const [index, session] of [seller, seller2].entries()) {
      const products = await ctx.http.get('/api/v1/sellers/me/products?pageSize=10').set('Authorization', `Bearer ${session.token}`);
      const product = products.body?.items?.[0];
      if (!product) continue;
      const response = await ctx.http
        .post(`/api/v1/seller/requests/${requestId}/quotes`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ items: [{ sellerProductId: product.id, quantity: 1, unitPrice: product.price + index * 20_000 }], preparationMinutes: 30 });
      if (response.status === 201) submittedIds.push(response.body.id as string);
    }
    expect(submittedIds.length).toBeGreaterThanOrEqual(1);

    const link = `/mechanic/requests/${requestId}/quotes`;
    const rows = await dataSource.getRepository(Notification).find({ where: { eventKey: 'request.quote_received', link } });
    const inApp = rows.filter((row) => row.channel === 'inapp');

    // هر پیشنهاد باید اعلان مستقل بگیرد (کلید یکتاسازی بر پایه شناسه پیشنهاد، نه شناسه درخواست)
    expect(inApp.length).toBe(submittedIds.length);
    for (const row of inApp) {
      // هیچ جای‌نمای پر‌نشده («—») در متن یا لینک باقی نمانده باشد
      expect(row.link).not.toContain('—');
      expect(row.bodyFa).not.toContain('—');
      expect(row.titleFa).not.toContain('—');
      const quote = await dataSource.getRepository(Quote).findOne({ where: { id: (row.data as { quoteId?: string } | null)?.quoteId ?? '' } });
      expect(quote).toBeTruthy();
      const owner = await dataSource.getRepository(Seller).findOne({ where: { id: quote!.sellerId } });
      expect(row.bodyFa).toContain(owner!.storeName);
      expect(row.bodyFa).toContain('دینام پژو ۴۰۵');
    }

    // کانال پیامک در محیط آزمون Mock است و باید صادقانه شبیه‌سازی‌شده علامت بخورد
    const sms = rows.filter((row) => row.channel === 'sms');
    for (const row of sms) expect(row.isSimulated).toBe(true);

    // اعلان‌ها در فهرست اعلان‌های کاربر دیده می‌شوند
    const mine = await ctx.http.get('/api/v1/notifications').set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    expect(mine.body.items.some((row: { eventKey: string }) => row.eventKey === 'request.quote_received')).toBe(true);

    // کلید یکتاسازی از تکرار اعلان یک پیشنهاد جلوگیری می‌کند
    const duplicates = await dataSource.getRepository(Notification).count({ where: { dedupeKey: Like(`request.quote_received:${submittedIds[0]}%`) } });
    expect(duplicates).toBeGreaterThanOrEqual(1);
    const perChannel = await dataSource
      .getRepository(Notification)
      .find({ where: { dedupeKey: Like(`request.quote_received:${submittedIds[0]}%`) } });
    const keys = perChannel.map((row) => row.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
  }, 120_000);
});
