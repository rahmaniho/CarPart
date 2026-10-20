import type { DataSource } from 'typeorm';
import { CouponsService } from '../../src/modules/coupons/coupons.service';
import { Commission } from '../../src/modules/finance/entities/commission.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { SellerProduct } from '../../src/modules/sellers/entities/seller-product.entity';
import { DEMO, createTestApp, login, waitFor, type Session, type TestContext } from './app.helper';

/**
 * آزمون‌های سرتاسری چرخه سفارش و پول.
 *
 * سناریوها: قیمت‌گذاری سمت سرور، رزرو اتمیک موجودی، یکتاسازی، پرداخت موفق/ناموفق/منقضی،
 * ثبت کارمزد، تغییر وضعیت نامجاز، جداسازی دسترسی کاربران و کوپن تخفیف.
 */
describe('چرخه سفارش و منطق مالی (e2e)', () => {
  let ctx: TestContext;
  let mechanic: Session;
  let mechanic2: Session;
  let seller: Session;
  let admin: Session;
  let dataSource: DataSource;

  beforeAll(async () => {
    ctx = await createTestApp();
    dataSource = ctx.dataSource;
    [mechanic, mechanic2, seller, admin] = await Promise.all([
      login(ctx, DEMO.mechanic),
      login(ctx, DEMO.mechanic2),
      login(ctx, DEMO.seller),
      login(ctx, DEMO.admin),
    ]);
  }, 120_000);

  afterAll(async () => {
    await ctx?.close();
  });

  async function pickOffer(quantity = 1): Promise<{ sellerProductId: string; price: number; stock: number; nameFa: string }> {
    const response = await ctx.http
      .get('/api/v1/catalog/search')
      .query({ q: 'لنت ترمز', pageSize: 20, inStockOnly: 'true' })
      .set('Authorization', `Bearer ${mechanic.token}`)
      .expect(200);
    const offer = response.body.items.find((item: { stock: number }) => item.stock >= quantity);
    if (!offer) throw new Error('پیشنهادی با موجودی کافی یافت نشد');
    return { sellerProductId: offer.sellerProductId, price: offer.price, stock: offer.stock, nameFa: offer.part.nameFa };
  }

  async function createOrder(
    session: Session,
    payload: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) {
    return ctx.http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${session.token}`)
      .set(headers)
      .send(payload);
  }

  async function defaultAddressId(): Promise<string> {
    const response = await ctx.http.get('/api/v1/workshops/me/addresses').set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    return (response.body as Array<{ id: string; isDefault: boolean }>).find((item) => item.isDefault)?.id ?? response.body[0].id;
  }

  it('۱) مبلغ سفارش همیشه سمت سرور محاسبه می‌شود و فیلد ناشناخته رد می‌گردد', async () => {
    const offer = await pickOffer(2);
    const addressId = await defaultAddressId();

    const tampered = await createOrder(mechanic, {
      items: [{ sellerProductId: offer.sellerProductId, quantity: 2, unitPrice: 1 }],
      deliveryAddressId: addressId,
    });
    expect(tampered.status).toBe(400);

    const created = await createOrder(
      mechanic,
      { items: [{ sellerProductId: offer.sellerProductId, quantity: 2 }], deliveryAddressId: addressId, urgency: 'normal' },
      { 'Idempotency-Key': `t-price-${Date.now()}` },
    );
    expect(created.status).toBe(201);
    expect(created.body.itemsSubtotal).toBe(offer.price * 2);
    expect(created.body.payableTotal).toBe(created.body.itemsSubtotal + created.body.deliveryFee - created.body.discountTotal);
    expect(Number.isInteger(created.body.payableTotal)).toBe(true);
    expect(created.body.currency).toBe('IRT');
  }, 60_000);

  it('۲) موجودی به‌صورت اتمیک رزرو می‌شود و بیش‌فروشی رد می‌گردد', async () => {
    const offer = await pickOffer(1);
    const addressId = await defaultAddressId();
    const before = await dataSource.getRepository(SellerProduct).findOne({ where: { id: offer.sellerProductId } });
    expect(before).not.toBeNull();

    const created = await createOrder(
      mechanic,
      { items: [{ sellerProductId: offer.sellerProductId, quantity: before!.availableStock }], deliveryAddressId: addressId },
      { 'Idempotency-Key': `t-stock-${Date.now()}` },
    );
    expect(created.status).toBe(201);

    const after = await dataSource.getRepository(SellerProduct).findOne({ where: { id: offer.sellerProductId } });
    expect(after!.availableStock).toBe(0);
    expect(after!.reservedStock - before!.reservedStock).toBe(before!.availableStock);
    expect(after!.stock).toBe(before!.stock); // موجودی فیزیکی تا زمان فروش قطعی تغییر نمی‌کند

    const oversell = await createOrder(mechanic, {
      items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }],
      deliveryAddressId: addressId,
    });
    expect(oversell.status).toBe(409);
    expect(oversell.body.code).toBe('INSUFFICIENT_STOCK');
  }, 60_000);

  it('۳) کلید یکتاسازی از ایجاد سفارش تکراری جلوگیری می‌کند', async () => {
    const offer = await pickOffer(1);
    const addressId = await defaultAddressId();
    const key = `t-idem-${Date.now()}`;
    const first = await createOrder(mechanic, { items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], deliveryAddressId: addressId }, { 'Idempotency-Key': key });
    const second = await createOrder(mechanic, { items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], deliveryAddressId: addressId }, { 'Idempotency-Key': key });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    const count = await dataSource.getRepository(Order).count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  }, 60_000);

  it('۴) پرداخت آزمایشی سفارش را PAID می‌کند و کارمزد پلتفرم ثبت می‌شود', async () => {
    const offer = await pickOffer(1);
    const addressId = await defaultAddressId();
    const created = await createOrder(
      mechanic,
      { items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], deliveryAddressId: addressId },
      { 'Idempotency-Key': `t-pay-${Date.now()}` },
    );
    const orderId = created.body.id as string;
    const productBefore = await dataSource.getRepository(SellerProduct).findOne({ where: { id: offer.sellerProductId } });

    const initiation = await ctx.http
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ orderId })
      .expect(201);
    expect(initiation.body.mode).toBe('sandbox');
    expect(initiation.body.amount).toBe(created.body.payableTotal);
    expect(initiation.body.sandboxNotice).toContain('آزمایشی');

    const confirmed = await ctx.http
      .post('/api/v1/payments/sandbox/confirm')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ orderId, decision: 'paid' })
      .expect(201);
    expect(confirmed.body.orderStatus).toBe('PAID');
    expect(confirmed.body.simulated).toBe(true);

    const order = await dataSource.getRepository(Order).findOne({ where: { id: orderId } });
    expect(order!.status).toBe('PAID');
    expect(order!.paymentStatus).toBe('SUCCESS');
    expect(order!.paidAt).toBeInstanceOf(Date);

    const commission = await dataSource.getRepository(Commission).findOne({ where: { orderId } });
    expect(commission).not.toBeNull();
    expect(commission!.platformAmount).toBe(Math.round((order!.itemsSubtotal * 7) / 100));
    expect(commission!.sellerNetAmount + commission!.platformAmount).toBe(commission!.commissionBase);
    expect(commission!.status).toBe('recorded');

    // موجودی رزروشده پس از پرداخت قطعی می‌شود (کسر از موجودی فیزیکی)
    const product = await dataSource.getRepository(SellerProduct).findOne({ where: { id: offer.sellerProductId } });
    expect(product!.reservedStock).toBe(productBefore!.reservedStock - 1);
    expect(product!.stock).toBe(productBefore!.stock - 1);
    expect(product!.availableStock).toBe(productBefore!.availableStock);
  }, 90_000);

  it('۵) تأیید پرداخت با امضای دستکاری‌شده رد می‌شود (تأیید سمت سرور)', async () => {
    const offer = await pickOffer(1);
    const addressId = await defaultAddressId();
    const created = await createOrder(
      mechanic,
      { items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], deliveryAddressId: addressId },
      { 'Idempotency-Key': `t-sig-${Date.now()}` },
    );
    const orderId = created.body.id as string;
    const initiation = await ctx.http
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ orderId })
      .expect(201);

    const forged = await ctx.http
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ paymentId: initiation.body.paymentId, signature: 'forged-signature', gatewayStatus: 'paid' })
      .expect(201);
    expect(forged.body.status).toBe('FAILED');
    expect(forged.body.orderStatus).toBe('PAYMENT_FAILED');

    const order = await dataSource.getRepository(Order).findOne({ where: { id: orderId } });
    expect(order!.status).toBe('PAYMENT_FAILED');
    expect(order!.paidAt).toBeNull();
  }, 90_000);

  it('۶) سفارش پرداخت‌نشده پس از مهلت لغو و موجودی آزاد می‌شود', async () => {
    const offer = await pickOffer(1);
    const addressId = await defaultAddressId();
    const created = await createOrder(
      mechanic,
      { items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], deliveryAddressId: addressId },
      { 'Idempotency-Key': `t-expire-${Date.now()}` },
    );
    const orderId = created.body.id as string;
    const before = await dataSource.getRepository(SellerProduct).findOne({ where: { id: offer.sellerProductId } });

    // مهلت پرداخت از تنظیمات خوانده می‌شود؛ برای آزمون، «اکنون» یک ساعت جلوتر می‌رود
    // تا انقضای مهلت بدون انتظار واقعی بررسی شود.
    const orders = ctx.app.get(OrdersService);
    const cancelled = await orders.expireOrderIfUnpaid(orderId, new Date(Date.now() + 60 * 60_000));
    expect(cancelled).toBe(true);


    const order = await dataSource.getRepository(Order).findOne({ where: { id: orderId } });
    expect(order!.status).toBe('CANCELLED');
    expect(order!.cancelReason).toContain('انقضای مهلت پرداخت');
    const after = await dataSource.getRepository(SellerProduct).findOne({ where: { id: offer.sellerProductId } });
    expect(after!.availableStock).toBe(before!.availableStock + 1);
    expect(after!.reservedStock).toBe(before!.reservedStock - 1);
    expect(after!.stock).toBe(before!.stock);
  }, 90_000);

  it('۷) تغییر وضعیت نامجاز و نقش نامجاز از سمت کاربر رد می‌شود', async () => {
    const offer = await pickOffer(1);
    const addressId = await defaultAddressId();
    const created = await createOrder(
      mechanic,
      { items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], deliveryAddressId: addressId },
      { 'Idempotency-Key': `t-trans-${Date.now()}` },
    );
    const orderId = created.body.id as string;

    const jump = await ctx.http
      .post(`/api/v1/orders/${orderId}/transition`)
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ to: 'COMPLETED' })
      .expect(409);
    expect(jump.body.code).toBe('ORDER_TRANSITION_FORBIDDEN');

    const wrongRole = await ctx.http
      .post(`/api/v1/orders/${orderId}/transition`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ to: 'CANCELLED', reason: 'تلاش نامجاز' });
    expect([403, 409]).toContain(wrongRole.status);

    const cancel = await ctx.http
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ reason: 'انصراف از خرید' })
      .expect(201);
    expect(cancel.body.status).toBe('CANCELLED');
  }, 90_000);

  it('۸) کاربر دیگر به سفارش دسترسی ندارد و مدیر دسترسی کامل دارد', async () => {
    const offer = await pickOffer(1);
    const addressId = await defaultAddressId();
    const created = await createOrder(
      mechanic,
      { items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], deliveryAddressId: addressId },
      { 'Idempotency-Key': `t-acl-${Date.now()}` },
    );
    const orderId = created.body.id as string;

    await ctx.http.get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${mechanic2.token}`).expect(403);
    await ctx.http.get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${mechanic.token}`).expect(200);
    const adminView = await ctx.http.get(`/api/v1/admin/orders/${orderId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
    expect(adminView.body.id).toBe(orderId);
  }, 90_000);

  it('۹) کوپن تخفیف با قواعد پیکربندی‌شده اعمال و در لغو برگردانده می‌شود', async () => {
    const coupons = ctx.app.get(CouponsService);
    const addressId = await defaultAddressId();
    const offer = await pickOffer(1);

    await expect(coupons.validate('NOT-EXIST', mechanic.user.id, 1_000_000, {})).rejects.toMatchObject({ code: 'COUPON_INVALID' });
    await expect(coupons.validate('WELCOME10', mechanic.user.id, 100_000, {})).rejects.toMatchObject({ code: 'COUPON_MIN_NOT_MET' });

    const valid = await coupons.validate('WELCOME10', mechanic.user.id, 2_000_000, {});
    expect(valid.discount).toBe(200_000); // ۱۰٪ با سقف ۲۰۰ هزار تومان

    const created = await createOrder(
      mechanic,
      { items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], deliveryAddressId: addressId, couponCode: 'WELCOME10' },
      { 'Idempotency-Key': `t-coupon-${Date.now()}` },
    );
    if (created.status === 201 && created.body.itemsSubtotal >= 300_000) {
      expect(created.body.discountTotal).toBe(Math.min(200_000, Math.round(created.body.itemsSubtotal * 0.1)));
      expect(created.body.payableTotal).toBe(created.body.itemsSubtotal + created.body.deliveryFee - created.body.discountTotal);

      await ctx.http.post(`/api/v1/orders/${created.body.id}/cancel`).set('Authorization', `Bearer ${mechanic.token}`).send({ reason: 'لغو آزمون کوپن' }).expect(201);
      const redemption = await dataSource.query(
        'SELECT status FROM coupon_redemptions WHERE orderId = ? ORDER BY createdAt DESC LIMIT 1',
        [created.body.id],
      );
      expect((redemption as Array<{ status: string }>)[0]?.status).toBe('reversed');
    }
  }, 90_000);

  it('۱۰) درخواست بازپرداخت فقط در پنجره زمانی مجاز پذیرفته می‌شود', async () => {
    const orders = ctx.app.get(OrdersService);
    const offer = await pickOffer(1);
    const addressId = await defaultAddressId();
    const created = await createOrder(
      mechanic,
      { items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], deliveryAddressId: addressId },
      { 'Idempotency-Key': `t-refund-${Date.now()}` },
    );
    const orderId = created.body.id as string;
    const payments = ctx.app.get(PaymentsService);
    await ctx.http.post('/api/v1/payments').set('Authorization', `Bearer ${mechanic.token}`).send({ orderId }).expect(201);
    await ctx.http.post('/api/v1/payments/sandbox/confirm').set('Authorization', `Bearer ${mechanic.token}`).send({ orderId, decision: 'paid' }).expect(201);

    // پیشروی وضعیت تا تحویل با کنش‌های مجاز هر نقش
    await orders.systemTransition(orderId, 'SELLER_CONFIRMED', 'تأیید فروشنده (آزمون)');
    const sellerUser = { ...seller.user, profileKind: 'seller', profileId: (await dataSource.getRepository(Order).findOne({ where: { id: orderId } }))!.sellerId } as never;
    await orders.transition(orderId, 'PREPARING', sellerUser);
    await orders.transition(orderId, 'READY_FOR_PICKUP', sellerUser);

    const delivered = await waitFor(
      async () => dataSource.getRepository(Order).findOne({ where: { id: orderId } }),
      (order) => Boolean(order && ['WAITING_FOR_COURIER', 'COURIER_ASSIGNED'].includes(order.status)),
      20_000,
    );
    expect(delivered!.status).not.toBe('PREPARING');

    // تحویل توسط سامانه ثبت می‌شود تا سناریوی بازپرداخت آزمون شود
    await orders.systemTransition(orderId, 'COURIER_ASSIGNED', 'تخصیص پیک (آزمون)');
    await dataSource.getRepository(Order).update({ id: orderId }, { status: 'DELIVERED', deliveredAt: new Date() });
    const refundRequest = await ctx.http
      .post('/api/v1/payments/refunds')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ orderId, reason: 'قطعه مطابق سفارش نبود' })
      .expect(201);
    expect(refundRequest.body.status).toBe('REQUESTED');

    // خارج از پنجره زمانی
    await dataSource.getRepository(Order).update({ id: orderId }, { deliveredAt: new Date(Date.now() - 30 * 86_400_000) });
    const late = await ctx.http
      .post('/api/v1/payments/refunds')
      .set('Authorization', `Bearer ${mechanic.token}`)
      .send({ orderId, reason: 'دیر اقدام کردم' });
    expect([409, 400]).toContain(late.status);
  }, 120_000);
});
