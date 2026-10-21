import type { Role } from './roles';
import {
  DELIVERY_STATUSES,
  ORDER_STATUSES,
  type DeliveryStatus,
  type OrderStatus,
} from './statuses';

/** انجام‌دهنده یک تغییر وضعیت: یک نقش کاربری یا خودِ سامانه (فرایندهای زمان‌بندی‌شده/رویدادها). */
export type Actor = Role | 'system';

export interface Transition<S extends string> {
  to: S;
  actors: Actor[];
  /** عنوان فارسی عملیات برای نمایش در رابط کاربری */
  fa: string;
  /** نام گارد سمت سرویس (اختیاری) — فقط سرور می‌تواند آن را ارزیابی کند */
  guard?: string;
  /** این تغییر وضعیت باید همراه با دلیل ثبت شود */
  requiresReason?: boolean;
}

/**
 * ماشین وضعیت سفارش.
 * این نگاشت «تنها» مرجع تغییر وضعیت‌های مجاز است؛ سرویس پیش از هر تغییر آن را بررسی می‌کند
 * و در صورت نامجاز بودن، درخواست با خطای ۴۰۹ رد می‌شود. فرانت‌اند هیچ وضعیتی را مستقیم تنظیم نمی‌کند.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, Transition<OrderStatus>[]> = {
  DRAFT: [
    { to: 'WAITING_FOR_PAYMENT', actors: ['mechanic', 'system'], fa: 'ثبت نهایی و رفتن به پرداخت', guard: 'orderPriced' },
    { to: 'CANCELLED', actors: ['mechanic', 'admin', 'operator'], fa: 'لغو پیش‌نویس', requiresReason: true },
  ],
  WAITING_FOR_PAYMENT: [
    { to: 'PAID', actors: ['system'], fa: 'ثبت پرداخت موفق', guard: 'paymentVerified' },
    { to: 'PAYMENT_FAILED', actors: ['system'], fa: 'ثبت شکست پرداخت' },
    { to: 'CANCELLED', actors: ['mechanic', 'admin', 'operator', 'system'], fa: 'لغو سفارش', requiresReason: true },
  ],
  PAYMENT_FAILED: [
    { to: 'WAITING_FOR_PAYMENT', actors: ['mechanic', 'system'], fa: 'تلاش مجدد پرداخت' },
    { to: 'CANCELLED', actors: ['mechanic', 'admin', 'operator', 'system'], fa: 'لغو سفارش', requiresReason: true },
  ],
  PAID: [
    { to: 'SELLER_CONFIRMED', actors: ['seller', 'system'], fa: 'تأیید سفارش توسط فروشنده', guard: 'sellerOwnsOrder' },
    { to: 'CANCELLED', actors: ['seller', 'admin', 'operator'], fa: 'لغو پس از پرداخت', requiresReason: true, guard: 'startRefund' },
    { to: 'DISPUTED', actors: ['mechanic', 'admin', 'operator'], fa: 'ثبت اختلاف', requiresReason: true },
  ],
  SELLER_CONFIRMED: [
    { to: 'PREPARING', actors: ['seller'], fa: 'شروع آماده‌سازی', guard: 'sellerOwnsOrder' },
    { to: 'CANCELLED', actors: ['seller', 'admin', 'operator'], fa: 'لغو به‌دلیل ناموجودی', requiresReason: true, guard: 'startRefund' },
    { to: 'DISPUTED', actors: ['mechanic', 'admin', 'operator'], fa: 'ثبت اختلاف', requiresReason: true },
  ],
  PREPARING: [
    { to: 'READY_FOR_PICKUP', actors: ['seller'], fa: 'اعلام آماده بودن برای تحویل به پیک', guard: 'sellerOwnsOrder' },
    { to: 'CANCELLED', actors: ['seller', 'admin'], fa: 'لغو سفارش', requiresReason: true, guard: 'startRefund' },
    { to: 'DISPUTED', actors: ['mechanic', 'admin', 'operator'], fa: 'ثبت اختلاف', requiresReason: true },
  ],
  READY_FOR_PICKUP: [
    { to: 'WAITING_FOR_COURIER', actors: ['seller', 'system', 'admin'], fa: 'درخواست پیک', guard: 'sellerOwnsOrder' },
    { to: 'DISPUTED', actors: ['admin', 'operator'], fa: 'ثبت اختلاف', requiresReason: true },
  ],
  WAITING_FOR_COURIER: [
    { to: 'COURIER_ASSIGNED', actors: ['system', 'admin'], fa: 'تخصیص پیک' },
    { to: 'CANCELLED', actors: ['admin'], fa: 'لغو سفارش', requiresReason: true, guard: 'startRefund' },
  ],
  COURIER_ASSIGNED: [
    { to: 'PICKED_UP', actors: ['courier'], fa: 'ثبت دریافت از فروشگاه', guard: 'courierOwnsDelivery' },
    { to: 'WAITING_FOR_COURIER', actors: ['courier', 'system', 'admin'], fa: 'بازگرداندن به صف تخصیص', requiresReason: true },
    { to: 'CANCELLED', actors: ['admin'], fa: 'لغو سفارش', requiresReason: true, guard: 'startRefund' },
  ],
  PICKED_UP: [
    { to: 'IN_TRANSIT', actors: ['courier'], fa: 'شروع ارسال', guard: 'courierOwnsDelivery' },
    { to: 'DISPUTED', actors: ['courier', 'admin'], fa: 'گزارش مشکل در مسیر', requiresReason: true },
  ],
  IN_TRANSIT: [
    { to: 'DELIVERED', actors: ['courier'], fa: 'ثبت تحویل با کد تأیید', guard: 'deliveryOtp' },
    { to: 'DISPUTED', actors: ['courier', 'admin'], fa: 'گزارش مشکل تحویل', requiresReason: true },
  ],
  DELIVERED: [
    { to: 'COMPLETED', actors: ['mechanic', 'system', 'admin'], fa: 'تأیید نهایی دریافت' },
    { to: 'REFUND_REQUESTED', actors: ['mechanic'], fa: 'درخواست بازپرداخت', requiresReason: true, guard: 'withinRefundWindow' },
    { to: 'DISPUTED', actors: ['mechanic', 'admin', 'operator'], fa: 'ثبت مغایرت قطعه', requiresReason: true },
  ],
  COMPLETED: [
    { to: 'REFUND_REQUESTED', actors: ['mechanic', 'admin'], fa: 'درخواست بازپرداخت', requiresReason: true, guard: 'withinRefundWindow' },
    { to: 'DISPUTED', actors: ['mechanic', 'admin', 'operator'], fa: 'ثبت اختلاف', requiresReason: true, guard: 'withinDisputeWindow' },
  ],
  REFUND_REQUESTED: [
    { to: 'REFUNDED', actors: ['admin'], fa: 'اجرای بازپرداخت', guard: 'refundApproved' },
    { to: 'DISPUTED', actors: ['admin', 'operator'], fa: 'ارجاع به بررسی اختلاف', requiresReason: true },
    { to: 'COMPLETED', actors: ['admin'], fa: 'رد درخواست بازپرداخت', requiresReason: true },
  ],
  DISPUTED: [
    { to: 'REFUNDED', actors: ['admin'], fa: 'بازپرداخت پس از بررسی', guard: 'refundApproved' },
    { to: 'COMPLETED', actors: ['admin'], fa: 'بستن اختلاف به نفع فروشنده', requiresReason: true },
    { to: 'CANCELLED', actors: ['admin'], fa: 'لغو و بازپرداخت', requiresReason: true, guard: 'startRefund' },
  ],
  CANCELLED: [
    { to: 'REFUNDED', actors: ['admin'], fa: 'ثبت بازپرداخت سفارش لغوشده', guard: 'refundApproved' },
  ],
  REFUNDED: [],
};

/** ماشین وضعیت مأموریت ارسال. */
export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, Transition<DeliveryStatus>[]> = {
  PENDING_ASSIGNMENT: [
    { to: 'OFFERED', actors: ['system', 'admin'], fa: 'پیشنهاد به پیک' },
    { to: 'CANCELLED', actors: ['admin', 'system'], fa: 'لغو مأموریت', requiresReason: true },
  ],
  OFFERED: [
    { to: 'ACCEPTED', actors: ['courier'], fa: 'پذیرش مأموریت', guard: 'courierEligible' },
    { to: 'PENDING_ASSIGNMENT', actors: ['courier', 'system'], fa: 'رد پیشنهاد', requiresReason: true },
    { to: 'OFFER_EXPIRED', actors: ['system'], fa: 'پایان مهلت پذیرش' },
    { to: 'CANCELLED', actors: ['admin'], fa: 'لغو مأموریت', requiresReason: true },
  ],
  OFFER_EXPIRED: [
    { to: 'PENDING_ASSIGNMENT', actors: ['system', 'admin'], fa: 'بازگشت به صف تخصیص' },
    { to: 'CANCELLED', actors: ['admin'], fa: 'لغو مأموریت', requiresReason: true },
  ],
  ACCEPTED: [
    { to: 'PICKED_UP', actors: ['courier'], fa: 'ثبت دریافت از فروشگاه', guard: 'pickupCode' },
    { to: 'PENDING_ASSIGNMENT', actors: ['courier', 'admin', 'system'], fa: 'انصراف پیک', requiresReason: true },
    { to: 'FAILED', actors: ['courier', 'admin'], fa: 'گزارش عدم امکان دریافت', requiresReason: true },
    { to: 'CANCELLED', actors: ['admin'], fa: 'لغو مأموریت', requiresReason: true },
  ],
  PICKED_UP: [
    { to: 'IN_TRANSIT', actors: ['courier'], fa: 'شروع ارسال' },
    { to: 'FAILED', actors: ['courier', 'admin'], fa: 'گزارش مشکل', requiresReason: true },
  ],
  IN_TRANSIT: [
    { to: 'DELIVERED', actors: ['courier'], fa: 'ثبت تحویل با کد تأیید', guard: 'deliveryOtp' },
    { to: 'DELIVERY_ATTEMPTED', actors: ['courier'], fa: 'ثبت تلاش ناموفق تحویل', requiresReason: true },
    { to: 'FAILED', actors: ['courier', 'admin'], fa: 'گزارش مشکل', requiresReason: true },
  ],
  DELIVERY_ATTEMPTED: [
    { to: 'IN_TRANSIT', actors: ['courier'], fa: 'تلاش مجدد تحویل' },
    { to: 'DELIVERED', actors: ['courier'], fa: 'ثبت تحویل با کد تأیید', guard: 'deliveryOtp' },
    { to: 'FAILED', actors: ['courier', 'admin'], fa: 'لغو تحویل و بازگشت', requiresReason: true },
  ],
  FAILED: [
    { to: 'PENDING_ASSIGNMENT', actors: ['admin', 'system'], fa: 'تخصیص مجدد' },
    { to: 'CANCELLED', actors: ['admin'], fa: 'لغو مأموریت', requiresReason: true },
  ],
  DELIVERED: [],
  CANCELLED: [],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isDeliveryStatus(value: string): value is DeliveryStatus {
  return (DELIVERY_STATUSES as readonly string[]).includes(value);
}

export function findTransition<S extends string>(
  table: Record<S, Transition<S>[]>,
  from: S,
  to: S,
): Transition<S> | undefined {
  return (table[from] ?? []).find((t) => t.to === to);
}

/** تغییر وضعیت‌های مجاز برای یک انجام‌دهنده مشخص. */
export function allowedTransitions<S extends string>(
  table: Record<S, Transition<S>[]>,
  from: S,
  actor: Actor,
): Transition<S>[] {
  return (table[from] ?? []).filter((t) => t.actors.includes(actor) || t.actors.includes('system'));
}

export function canTransition<S extends string>(
  table: Record<S, Transition<S>[]>,
  from: S,
  to: S,
  actor: Actor,
): boolean {
  const transition = findTransition(table, from, to);
  if (!transition) return false;
  return transition.actors.includes(actor);
}
