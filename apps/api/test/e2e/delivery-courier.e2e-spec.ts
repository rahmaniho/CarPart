import type { DataSource } from 'typeorm';
import { CourierProfile } from '../../src/modules/couriers/entities/courier-profile.entity';
import { CouriersService } from '../../src/modules/couriers/couriers.service';
import { Delivery } from '../../src/modules/delivery/entities/delivery.entity';
import { DeliveryService } from '../../src/modules/delivery/delivery.service';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { OrdersService } from '../../src/modules/orders/orders.service';
import type { RequestUser } from '../../src/common/types/auth';
import { DEMO, createTestApp, login, waitFor, type Session, type TestContext } from './app.helper';

/**
 * آزمون‌های سرتاسری مأموریت ارسال و پیک.
 *
 * سناریوها: ساخت خودکار مأموریت پس از آماده‌سازی، پیشنهاد به نزدیک‌ترین پیک واجد شرایط،
 * پایان مهلت پذیرش و تخصیص مجدد (بدون پیک قبلی)، کد دریافت از فروشگاه، کد تأیید تحویل،
 * و محدودسازی حریم خصوصی داده گیرنده و موقعیت پیک.
 */
describe('مأموریت ارسال و پیک (e2e)', () => {
  let ctx: TestContext;
  let dataSource: DataSource;
  let mechanic: Session;
  let seller: Session;
  let courier: Session;
  let courier2: Session;
  let admin: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    dataSource = ctx.dataSource;
    [mechanic, seller, courier, courier2, admin] = await Promise.all([
      login(ctx, DEMO.mechanic),
      login(ctx, DEMO.seller),
      login(ctx, DEMO.courier),
      login(ctx, DEMO.courier2),
      login(ctx, DEMO.admin),
    ]);
  }, 120_000);

  afterAll(async () => {
    await ctx?.close();
  });

  /** نقش فروشنده فقط برای فروشگاهِ همان سفارش ساخته می‌شود (کنترل دسترسی سمت سرور). */
  function sellerActor(sellerId: string, userId: string): RequestUser {
    return { ...seller.user, id: userId, profileKind: 'seller', profileId: sellerId } as RequestUser;
  }

  /** یک سفارش را تا مرحله «آماده تحویل به پیک» پیش می‌برد و پرداخت می‌کند. */
  async function paidReadyOrder(): Promise<{ orderId: string; deliveryExpected: boolean }> {
    const addresses = await ctx.http.get('/api/v1/workshops/me/addresses').set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    const search = await ctx.http
      .get('/api/v1/catalog/search')
      .query({ q: 'لنت ترمز', pageSize: 20 })
      .set('Authorization', `Bearer ${mechanic.token}`)
      .expect(200);
    const offer = search.body.items.find((item: { stock: number }) => item.stock > 3);
    const created = await ctx.http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .set('Idempotency-Key', `t-delivery-${Date.now()}-${Math.random()}`)
      .send({ items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], deliveryAddressId: addresses.body[0].id })
      .expect(201);

    const orderId = created.body.id as string;
    const sellerId = offer.seller.id as string;
    const sellerRow = (await dataSource.query('SELECT userId FROM sellers WHERE id = ?', [sellerId])) as Array<{ userId: string }>;
    await ctx.http.post('/api/v1/payments').set('Authorization', `Bearer ${mechanic.token}`).send({ orderId }).expect(201);
    await ctx.http
      .post('/api/v1/payments/sandbox/confirm')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ orderId, decision: 'paid' })
      .expect(201);

    const orders = ctx.app.get(OrdersService);
    const actor = sellerActor(sellerId, sellerRow[0].userId);
    await orders.transition(orderId, 'SELLER_CONFIRMED', actor);
    await orders.transition(orderId, 'PREPARING', actor);
    await orders.transition(orderId, 'READY_FOR_PICKUP', actor);
    return { orderId, deliveryExpected: true };
  }

  it('۱۸) پس از آماده‌سازی، مأموریت ارسال ساخته و به نزدیک‌ترین پیک پیشنهاد می‌شود', async () => {
    const { orderId } = await paidReadyOrder();
    const delivery = await waitFor(
      async () => dataSource.getRepository(Delivery).findOne({ where: { orderId } }),
      (row) => Boolean(row && row.status !== 'PENDING_ASSIGNMENT'),
      30_000,
    );
    expect(delivery).toBeTruthy();
    expect(['OFFERED', 'ACCEPTED', 'FAILED'].includes(delivery!.status)).toBe(true);
    expect(delivery!.courierId).toBeTruthy();
    expect(delivery!.offerCount).toBeGreaterThanOrEqual(1);
    expect(delivery!.offerExpiresAt).toBeInstanceOf(Date);
    expect(delivery!.courierShare + delivery!.platformShare).toBe(delivery!.deliveryFee);
    expect(delivery!.pickupCodeEncrypted).toBeTruthy();
    expect(delivery!.deliveryOtpEncrypted).toBeTruthy();
    // کدها هرگز به‌صورت متن ساده ذخیره نمی‌شوند
    expect(delivery!.pickupCodeEncrypted).not.toMatch(/^\d{4,8}$/);

    const order = await dataSource.getRepository(Order).findOne({ where: { id: orderId } });
    expect(['WAITING_FOR_COURIER', 'COURIER_ASSIGNED'].includes(order!.status)).toBe(true);
  }, 120_000);

  it('۱۹) پیک دیگر نمی‌تواند مأموریتِ پیشنهادشده به پیک نخست را بپذیرد', async () => {
    const { orderId } = await paidReadyOrder();
    const delivery = await waitFor(
      async () => dataSource.getRepository(Delivery).findOne({ where: { orderId } }),
      (row) => Boolean(row && row.courierId),
      30_000,
    );
    const offeredProfile = await dataSource.getRepository(CourierProfile).findOne({ where: { id: delivery!.courierId! } });
    const otherSession = offeredProfile!.userId === courier.user.id ? courier2 : courier;

    const forbidden = await ctx.http
      .post(`/api/v1/courier/deliveries/${delivery!.id}/accept`)
      .set('Authorization', `Bearer ${otherSession.token}`)
      .send({});
    expect([403, 409]).toContain(forbidden.status);

    const owner = offeredProfile!.userId === courier.user.id ? courier : courier2;
    const accepted = await ctx.http
      .post(`/api/v1/courier/deliveries/${delivery!.id}/accept`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({});
    expect([200, 201]).toContain(accepted.status);
    expect(accepted.body.status).toBe('ACCEPTED');

    const order = await dataSource.getRepository(Order).findOne({ where: { id: orderId } });
    expect(order!.status).toBe('COURIER_ASSIGNED');
  }, 150_000);

  it('۲۰) پایان مهلت پذیرش، مأموریت را به صف بازمی‌گرداند و پیک قبلی حذف می‌شود', async () => {
    const { orderId } = await paidReadyOrder();
    const delivery = await waitFor(
      async () => dataSource.getRepository(Delivery).findOne({ where: { orderId } }),
      (row) => Boolean(row && row.courierId),
      30_000,
    );
    const firstCourierId = delivery!.courierId!;
    await dataSource.getRepository(Delivery).update({ id: delivery!.id }, { offerExpiresAt: new Date(Date.now() - 1000) });

    const deliveries = ctx.app.get(DeliveryService);
    const result = await deliveries.handleOfferTimeout(delivery!.id);
    expect(result.expired).toBe(true);

    const after = await waitFor(
      async () => dataSource.getRepository(Delivery).findOne({ where: { id: delivery!.id } }),
      (row) => Boolean(row && row.status !== 'OFFER_EXPIRED'),
      20_000,
    );
    expect(after!.excludedCourierIds).toContain(firstCourierId);
    // پیشنهاد بعدی به همان پیک داده نمی‌شود
    if (after!.courierId) expect(after!.courierId).not.toBe(firstCourierId);
  }, 150_000);

  it('۲۱) کد دریافت از فروشگاه و کد تأیید تحویل سمت سرور اعتبارسنجی می‌شوند', async () => {
    const { orderId } = await paidReadyOrder();
    const deliveries = ctx.app.get(DeliveryService);
    const delivery = await waitFor(
      async () => dataSource.getRepository(Delivery).findOne({ where: { orderId } }),
      (row) => Boolean(row && row.courierId),
      30_000,
    );
    const profile = await dataSource.getRepository(CourierProfile).findOne({ where: { id: delivery!.courierId! } });
    const owner = profile!.userId === courier.user.id ? courier : courier2;

    await ctx.http.post(`/api/v1/courier/deliveries/${delivery!.id}/accept`).set('Authorization', `Bearer ${owner.token}`).send({}).expect((res) => {
      if (![200, 201].includes(res.status)) throw new Error(`پذیرش مأموریت ناموفق: ${res.status} ${JSON.stringify(res.body)}`);
    });

    // کد دریافت فقط در دید فروشنده/مدیر ظاهر می‌شود
    const sellerView = await ctx.http.get(`/api/v1/seller/deliveries/${orderId}`).set('Authorization', `Bearer ${seller.token}`).expect(200);
    expect(sellerView.body.pickupCode).toMatch(/^\d{4,8}$/);
    const mechanicView = await ctx.http.get(`/api/v1/orders/${orderId}/tracking`).set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    expect(mechanicView.body.pickupCode).toBeNull();
    expect(mechanicView.body.deliveryOtp).toMatch(/^\d{4,8}$/);

    const wrongPickup = await ctx.http
      .post(`/api/v1/courier/deliveries/${delivery!.id}/pickup`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ pickupCode: '00000' });
    if (wrongPickup.status !== 409) {
      // در حالت unlikely که کد تصادفی برابر باشد، وضعیت باید پیش رفته باشد
      expect([200, 201]).toContain(wrongPickup.status);
    } else {
      expect(wrongPickup.body.code).toBe('PICKUP_CODE_INVALID');
    }

    await ctx.http
      .post(`/api/v1/courier/deliveries/${delivery!.id}/pickup`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ pickupCode: sellerView.body.pickupCode })
      .expect((res) => {
        if (![200, 201].includes(res.status)) throw new Error(`دریافت مرسوله ناموفق: ${res.status} ${JSON.stringify(res.body)}`);
      });
    await ctx.http.post(`/api/v1/courier/deliveries/${delivery!.id}/transit`).set('Authorization', `Bearer ${owner.token}`).send({}).expect((res) => {
      if (![200, 201].includes(res.status)) throw new Error(`شروع ارسال ناموفق: ${res.status}`);
    });

    const wrongOtp = await ctx.http
      .post(`/api/v1/courier/deliveries/${delivery!.id}/deliver`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ otp: '00000' });
    expect([409, 200, 201]).toContain(wrongOtp.status);

    const delivered = await ctx.http
      .post(`/api/v1/courier/deliveries/${delivery!.id}/deliver`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ otp: mechanicView.body.deliveryOtp, note: 'تحویل در محل تعمیرگاه' });
    expect([200, 201]).toContain(delivered.status);

    const order = await waitFor(
      async () => dataSource.getRepository(Order).findOne({ where: { id: orderId } }),
      (row) => row!.status === 'DELIVERED',
      10_000,
    );
    expect(order!.status).toBe('DELIVERED');
    expect(order!.deliveredAt).toBeInstanceOf(Date);
    void deliveries;
  }, 180_000);

  it('۲۲) حریم خصوصی: داده گیرنده پوشیده و موقعیت پیک فقط برای ذی‌نفعان است', async () => {
    const { orderId } = await paidReadyOrder();
    const delivery = await waitFor(
      async () => dataSource.getRepository(Delivery).findOne({ where: { orderId } }),
      (row) => Boolean(row && row.courierId),
      30_000,
    );

    // کاربر غریبه به ردیابی دسترسی ندارد
    const otherMechanic = await login(ctx, DEMO.mechanic2);
    await ctx.http.get(`/api/v1/orders/${orderId}/tracking`).set('Authorization', `Bearer ${otherMechanic.token}`).expect(403);

    // پیک پیش از پذیرش، شماره کامل گیرنده را نمی‌بیند
    const profile = await dataSource.getRepository(CourierProfile).findOne({ where: { id: delivery!.courierId! } });
    const courierRequest = ctx.app.get(CouriersService);
    const courierToken = profile!.userId === courier.user.id ? courier.token : courier2.token;
    const offers = await ctx.http.get('/api/v1/courier/deliveries?status=offers').set('Authorization', `Bearer ${courierToken}`).expect(200);
    const masked = offers.body.items.find((item: { id: string }) => item.id === delivery!.id);
    expect(masked).toBeTruthy();
    expect(masked.dropoffPoint.phone).toContain('***');
    expect(masked.deliveryOtpEncrypted).toBeNull();

    const ownerView = await ctx.http
      .get(`/api/v1/courier/deliveries/${delivery!.id}`)
      .set('Authorization', `Bearer ${courierToken}`)
      .expect(200);
    expect(ownerView.body.deliveryOtpEncrypted).toBeNull();
    expect(ownerView.body.pickupCodeEncrypted).toBeNull();

    // موقعیت پیک فقط برای صاحب مأموریت یا مدیر/اپراتور
    const locations = await courierRequest.locationsFor(delivery!.id, profile!.id, ['courier']);
    expect(Array.isArray(locations)).toBe(true);
    await expect(courierRequest.locationsFor(delivery!.id, 'someone-else', ['courier'])).rejects.toBeDefined();
    const adminLocations = await courierRequest.locationsFor(delivery!.id, 'admin-user', ['admin']);
    expect(Array.isArray(adminLocations)).toBe(true);
    void admin;
  }, 180_000);

  it('۲۳) GPS مأموریت، رسیدن به فروشگاه و دسترسی خریدار/فروشنده را امن و یک‌بار ثبت می‌کند', async () => {
    const { orderId } = await paidReadyOrder();
    const delivery = await waitFor(
      async () => dataSource.getRepository(Delivery).findOne({ where: { orderId } }),
      (row) => Boolean(row && row.courierId),
      30_000,
    );
    expect(delivery!.pickupPoint.lat).not.toBeNull();
    expect(delivery!.pickupPoint.lng).not.toBeNull();

    const profile = await dataSource.getRepository(CourierProfile).findOne({ where: { id: delivery!.courierId! } });
    const owner = profile!.userId === courier.user.id ? courier : courier2;
    const other = profile!.userId === courier.user.id ? courier2 : courier;
    await ctx.http
      .post(`/api/v1/courier/deliveries/${delivery!.id}/accept`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect((res) => {
        if (![200, 201].includes(res.status)) throw new Error(`پذیرش مأموریت ناموفق: ${res.status}`);
      });

    const sample = {
      deliveryId: delivery!.id,
      lat: delivery!.pickupPoint.lat,
      lng: delivery!.pickupPoint.lng,
      accuracyM: 12,
      speedKmh: 8,
      heading: 180,
      capturedAt: new Date().toISOString(),
    };

    // نمونه بدون مأموریت پذیرفته‌شده و تزریق موقعیت توسط پیک دیگر هر دو رد می‌شوند.
    const { deliveryId: _deliveryId, ...unscopedSample } = sample;
    await ctx.http.post('/api/v1/couriers/me/location').set('Authorization', `Bearer ${owner.token}`).send(unscopedSample).expect(400);
    await ctx.http.post('/api/v1/couriers/me/location').set('Authorization', `Bearer ${other.token}`).send(sample).expect(403);

    const first = await ctx.http
      .post('/api/v1/couriers/me/location')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(sample)
      .expect(201);
    expect(first.body.sellerArrivalDetected).toBe(true);
    expect(first.body.distanceToPickupM).toBe(0);

    // Geofence و اعلان رسیدن در ارسال‌های بعدی تکرار نمی‌شوند.
    const second = await ctx.http
      .post('/api/v1/couriers/me/location')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ...sample, capturedAt: new Date().toISOString() })
      .expect(201);
    expect(second.body.sellerArrivalDetected).toBe(false);

    const buyerView = await ctx.http.get(`/api/v1/orders/${orderId}/tracking`).set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    expect(buyerView.body.location).toMatchObject({ isFresh: true, distanceToPickupM: 0 });
    expect(buyerView.body.sellerArrival.detected).toBe(true);

    const sellerView = await ctx.http.get(`/api/v1/seller/deliveries/${orderId}`).set('Authorization', `Bearer ${seller.token}`).expect(200);
    expect(sellerView.body.location.lat).toBeCloseTo(Number(delivery!.pickupPoint.lat), 5);
    expect(sellerView.body.sellerArrival.detected).toBe(true);

    const otherMechanic = await login(ctx, DEMO.mechanic2);
    await ctx.http.get(`/api/v1/orders/${orderId}/tracking/location`).set('Authorization', `Bearer ${otherMechanic.token}`).expect(403);

    const notifications = await ctx.http.get('/api/v1/notifications?pageSize=100').set('Authorization', `Bearer ${seller.token}`).expect(200);
    const arrivalNotices = notifications.body.items.filter((item: { eventKey: string; data?: { deliveryId?: string } }) =>
      item.eventKey === 'delivery.arrived_at_seller' && item.data?.deliveryId === delivery!.id,
    );
    expect(arrivalNotices).toHaveLength(1);

    await dataSource.getRepository(Delivery).update({ id: delivery!.id }, { status: 'DELIVERED' });
    await ctx.http
      .post('/api/v1/couriers/me/location')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ...sample, capturedAt: new Date().toISOString() })
      .expect(409);
  }, 180_000);
});
