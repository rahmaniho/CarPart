import type { ObjectLiteral, Repository } from 'typeorm';
import { ORDER_TRANSITIONS } from '@carpart/contract';
import { AppException } from '../../src/common/errors/app-error';
import type { RequestUser } from '../../src/common/types/auth';
import type { Delivery } from '../../src/modules/delivery/entities/delivery.entity';
import type { Payment } from '../../src/modules/payments/entities/payment.entity';
import type { Refund } from '../../src/modules/payments/entities/refund.entity';
import type { SystemSettingsService } from '../../src/modules/settings/system-settings.service';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { OrderStateMachine } from '../../src/modules/orders/state-machine';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return Object.assign(new Order(), {
    id: 'order-1',
    code: 'ORD-TEST',
    userId: 'user-1',
    sellerId: 'seller-1',
    status: 'WAITING_FOR_PAYMENT',
    itemsSubtotal: 1_000_000,
    deliveryFee: 25_000,
    discountTotal: 0,
    payableTotal: 1_025_000,
    currency: 'IRT',
    ...overrides,
  });
}

function user(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'user-1',
    mobile: '09121110001',
    fullName: 'کاربر آزمون',
    roles: ['mechanic'],
    permissions: [],
    sessionId: 'session-1',
    profileId: null,
    profileKind: 'workshop',
    verificationStatus: 'APPROVED',
    isActive: true,
    city: 'تهران',
    ...overrides,
  } as RequestUser;
}

function stubRepo<T extends ObjectLiteral>(findOneResult: T | null = null): { repo: Repository<T>; save: jest.Mock } {
  const save = jest.fn(async (value: unknown) => value);
  const repo = {
    findOne: jest.fn(async () => findOneResult),
    save,
    create: (value: unknown) => value,
  } as unknown as Repository<T>;
  return { repo, save };
}

const settingsStub = {
  getNumber: async (_key: string, fallback: number) => fallback,
} as unknown as SystemSettingsService;

/**
 * آزمون ۵ — ماشین وضعیت سفارش در سمت سرور.
 * هر انتقال نامجاز یا کنش بدون صلاحیت باید با خطای مشخص رد شود.
 */
describe('ماشین وضعیت سفارش', () => {
  it('انتقال ناموجود در جدول با ۴۰۹ رد می‌شود', () => {
    const { repo: payments } = stubRepo<Payment>();
    const { repo: refunds } = stubRepo<Refund>();
    const { repo: deliveries } = stubRepo<Delivery>();
    const machine = new OrderStateMachine(payments, refunds, deliveries, settingsStub);
    expect(() => machine.assertAllowed('DRAFT', 'COMPLETED', 'mechanic')).toThrow(AppException);
    try {
      machine.assertAllowed('DRAFT', 'COMPLETED', 'mechanic');
      throw new Error('باید خطا می‌داد');
    } catch (error) {
      expect((error as AppException).getStatus()).toBe(409);
      expect((error as AppException).code).toBe('ORDER_TRANSITION_FORBIDDEN');
    }
  });

  it('انتقال مجاز با نقش غیرمجاز با ۴۰۳ رد می‌شود', () => {
    const { repo: payments } = stubRepo<Payment>();
    const { repo: refunds } = stubRepo<Refund>();
    const { repo: deliveries } = stubRepo<Delivery>();
    const machine = new OrderStateMachine(payments, refunds, deliveries, settingsStub);
    // مکانیک نمی‌تواند سفارش را PAID کند (فقط سامانه پس از تأیید درگاه)
    try {
      machine.assertAllowed('WAITING_FOR_PAYMENT', 'PAID', 'mechanic');
      throw new Error('باید خطا می‌داد');
    } catch (error) {
      expect((error as AppException).getStatus()).toBe(403);
      expect((error as AppException).details?.allowedActors).toContain('system');
    }
    expect(machine.assertAllowed('WAITING_FOR_PAYMENT', 'PAID', 'system').to).toBe('PAID');
    // فروشنده نمی‌تواند تحویل نهایی را ثبت کند
    expect(() => machine.assertAllowed('IN_TRANSIT', 'DELIVERED', 'seller')).toThrow(AppException);
  });

  it('عملیات مجاز هر نقش با عنوان فارسی برای رابط کاربری برگردانده می‌شود', () => {
    const { repo: payments } = stubRepo<Payment>();
    const { repo: refunds } = stubRepo<Refund>();
    const { repo: deliveries } = stubRepo<Delivery>();
    const machine = new OrderStateMachine(payments, refunds, deliveries, settingsStub);
    const sellerActions = machine.allowedActions('PAID', 'seller');
    expect(sellerActions.map((action) => action.to)).toEqual(expect.arrayContaining(['SELLER_CONFIRMED', 'CANCELLED']));
    expect(sellerActions.every((action) => action.fa.length > 2)).toBe(true);
    expect(machine.allowedActions('COMPLETED', 'courier')).toHaveLength(0);
  });

  it('گارد orderPriced: سفارش بدون مبلغ قابل پرداخت نهایی نمی‌شود', async () => {
    const { repo: payments } = stubRepo<Payment>();
    const { repo: refunds } = stubRepo<Refund>();
    const { repo: deliveries } = stubRepo<Delivery>();
    const machine = new OrderStateMachine(payments, refunds, deliveries, settingsStub);
    const transition = ORDER_TRANSITIONS.DRAFT.find((item) => item.to === 'WAITING_FOR_PAYMENT')!;
    await expect(
      machine.runGuards(transition, { order: makeOrder({ status: 'DRAFT', payableTotal: 0 }), actor: 'mechanic', user: user() }),
    ).rejects.toThrow(AppException);
    await expect(
      machine.runGuards(transition, { order: makeOrder({ status: 'DRAFT' }), actor: 'mechanic', user: user() }),
    ).resolves.toBeUndefined();
  });

  it('گارد paymentVerified: پرداخت موفق با مبلغ منطبق لازم است', async () => {
    const transition = ORDER_TRANSITIONS.WAITING_FOR_PAYMENT.find((item) => item.to === 'PAID')!;

    const noPayment = new OrderStateMachine(stubRepo<Payment>(null).repo, stubRepo<Refund>().repo, stubRepo<Delivery>().repo, settingsStub);
    await expect(noPayment.runGuards(transition, { order: makeOrder(), actor: 'system' })).rejects.toThrow('پرداخت موفق');

    const wrongAmount = new OrderStateMachine(
      stubRepo<Payment>({ amount: 10, orderId: 'order-1' } as Payment).repo,
      stubRepo<Refund>().repo,
      stubRepo<Delivery>().repo,
      settingsStub,
    );
    await expect(wrongAmount.runGuards(transition, { order: makeOrder(), actor: 'system' })).rejects.toMatchObject({
      code: 'PAYMENT_AMOUNT_MISMATCH',
    });

    const ok = new OrderStateMachine(
      stubRepo<Payment>({ amount: 1_025_000, orderId: 'order-1' } as Payment).repo,
      stubRepo<Refund>().repo,
      stubRepo<Delivery>().repo,
      settingsStub,
    );
    await expect(ok.runGuards(transition, { order: makeOrder(), actor: 'system' })).resolves.toBeUndefined();
  });

  it('گارد sellerOwnsOrder: فقط فروشنده همان سفارش، و سامانه مستثنی است', async () => {
    const { repo: payments } = stubRepo<Payment>();
    const { repo: refunds } = stubRepo<Refund>();
    const { repo: deliveries } = stubRepo<Delivery>();
    const machine = new OrderStateMachine(payments, refunds, deliveries, settingsStub);
    const transition = ORDER_TRANSITIONS.PAID.find((item) => item.to === 'SELLER_CONFIRMED')!;
    const order = makeOrder({ status: 'PAID' });

    await expect(
      machine.runGuards(transition, { order, actor: 'seller', user: user({ profileKind: 'seller', profileId: 'seller-other' }) }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    await expect(
      machine.runGuards(transition, { order, actor: 'seller', user: user({ profileKind: 'seller', profileId: 'seller-1' }) }),
    ).resolves.toBeUndefined();

    // کنش سامانه بدون کاربر اجرا می‌شود و گارد مالکیت آن را متوقف نمی‌کند
    await expect(machine.runGuards(transition, { order, actor: 'system', user: null })).resolves.toBeUndefined();
  });

  it('گارد startRefund: برای سفارش پرداخت‌شده درخواست بازپرداخت می‌سازد (بدون تکرار)', async () => {
    const { repo: refunds, save } = stubRepo<Refund>(null);
    const machine = new OrderStateMachine(stubRepo<Payment>().repo, refunds, stubRepo<Delivery>().repo, settingsStub);
    const transition = ORDER_TRANSITIONS.PAID.find((item) => item.to === 'CANCELLED')!;
    await machine.runGuards(transition, { order: makeOrder({ status: 'PAID', paidAt: new Date() }), actor: 'admin', user: user({ roles: ['admin'] }) });
    expect(save).toHaveBeenCalledTimes(1);

    // اگر درخواست بازپرداخت موجود باشد، دوباره ساخته نمی‌شود
    const { repo: refunds2, save: save2 } = stubRepo<Refund>({ id: 'r-1', status: 'REQUESTED' } as Refund);
    const machine2 = new OrderStateMachine(stubRepo<Payment>().repo, refunds2, stubRepo<Delivery>().repo, settingsStub);
    await machine2.runGuards(transition, { order: makeOrder({ status: 'PAID', paidAt: new Date() }), actor: 'admin', user: user({ roles: ['admin'] }) });
    expect(save2).not.toHaveBeenCalled();
  });

  it('گارد مهلت بازپرداخت پس از پایان پنجره configurable خطا می‌دهد', async () => {
    const { repo: payments } = stubRepo<Payment>();
    const { repo: refunds } = stubRepo<Refund>();
    const { repo: deliveries } = stubRepo<Delivery>();
    const machine = new OrderStateMachine(payments, refunds, deliveries, settingsStub);
    const transition = ORDER_TRANSITIONS.COMPLETED.find((item) => item.to === 'REFUND_REQUESTED')!;
    const recent = makeOrder({ status: 'COMPLETED', deliveredAt: new Date(Date.now() - 2 * 86_400_000) });
    const old = makeOrder({ status: 'COMPLETED', deliveredAt: new Date(Date.now() - 10 * 86_400_000) });
    await expect(machine.runGuards(transition, { order: recent, actor: 'mechanic', user: user() })).resolves.toBeUndefined();
    await expect(machine.runGuards(transition, { order: old, actor: 'mechanic', user: user() })).rejects.toMatchObject({
      code: 'REFUND_WINDOW_CLOSED',
    });
  });

  it('گارد deliveryOtp: تحویل سفارش فقط پس از ثبت تحویل مأموریت', async () => {
    const transition = ORDER_TRANSITIONS.IN_TRANSIT.find((item) => item.to === 'DELIVERED')!;
    const pending = new OrderStateMachine(
      stubRepo<Payment>().repo,
      stubRepo<Refund>().repo,
      stubRepo<Delivery>({ orderId: 'order-1', status: 'IN_TRANSIT' } as Delivery).repo,
      settingsStub,
    );
    await expect(pending.runGuards(transition, { order: makeOrder({ status: 'IN_TRANSIT' }), actor: 'courier', user: user() })).rejects.toMatchObject({
      code: 'DELIVERY_OTP_INVALID',
    });

    const delivered = new OrderStateMachine(
      stubRepo<Payment>().repo,
      stubRepo<Refund>().repo,
      stubRepo<Delivery>({ orderId: 'order-1', status: 'DELIVERED' } as Delivery).repo,
      settingsStub,
    );
    await expect(
      delivered.runGuards(transition, { order: makeOrder({ status: 'IN_TRANSIT' }), actor: 'courier', user: user() }),
    ).resolves.toBeUndefined();
  });

  it('وضعیت‌های پایانی هیچ انتقال خروجی ندارند', () => {
    expect(ORDER_TRANSITIONS.CANCELLED).toHaveLength(0);
    expect(ORDER_TRANSITIONS.REFUNDED).toHaveLength(0);
  });
});
