import type { NotificationChannel, Tone } from '@carpart/contract';

export interface NotificationEventDefinition {
  key: string;
  titleFa: string;
  bodyFa: string;
  channels: NotificationChannel[];
  tone: Tone;
  /** الگوی لینک داخلی (اختیاری) */
  link?: string;
  /** آیا در ساعات سکوت پیامکی، پیامک ارسال نشود؟ */
  respectQuietHours?: boolean;
}

/**
 * فهرست رویدادهای اعلان سامانه.
 * همه متن‌ها فارسی و با جای‌نما {placeholder} هستند تا یک نقطه ویرایش داشته باشند.
 */
export const NOTIFICATION_EVENTS: Record<string, NotificationEventDefinition> = {
  'request.created': {
    key: 'request.created',
    titleFa: 'درخواست تأمین ثبت شد',
    bodyFa: 'درخواست «{title}» با کد {code} ثبت شد و برای {sellerCount} فروشنده ارسال گردید. مهلت پاسخ: {deadline}',
    channels: ['inapp', 'sms'],
    tone: 'info',
    link: '/mechanic/requests/{id}',
  },
  'request.broadcast': {
    key: 'request.broadcast',
    titleFa: 'درخواست تأمین جدید در محدوده شما',
    bodyFa: '«{title}» — {quantity} عدد، فوریت: {urgency}. مهلت ارائه پیشنهاد: {deadline}',
    channels: ['inapp'],
    tone: 'info',
    link: '/seller/requests/{id}',
  },
  'request.quote_received': {
    key: 'request.quote_received',
    titleFa: 'پیشنهاد قیمت جدید دریافت کردید',
    bodyFa: '{sellerName} برای درخواست «{title}» پیشنهاد {total} ثبت کرد.',
    channels: ['inapp', 'sms'],
    tone: 'success',
    link: '/mechanic/requests/{id}/quotes',
  },
  'request.expired': {
    key: 'request.expired',
    titleFa: 'مهلت دریافت پیشنهاد به پایان رسید',
    bodyFa: 'درخواست «{title}» با {quoteCount} پیشنهاد بسته شد. می‌توانید پیشنهادهای معتبر را بررسی یا درخواست جدید ثبت کنید.',
    channels: ['inapp'],
    tone: 'warning',
    link: '/mechanic/requests/{id}',
  },
  'request.unfulfilled': {
    key: 'request.unfulfilled',
    titleFa: 'پیشنهادی برای درخواست شما ثبت نشد',
    bodyFa: 'برای «{title}» در مهلت مقرر پیشنهادی دریافت نشد. پیشنهاد می‌کنیم محدوده یا برند را تغییر دهید.',
    channels: ['inapp', 'sms'],
    tone: 'warning',
    link: '/mechanic/requests/{id}',
  },
  'quote.accepted': {
    key: 'quote.accepted',
    titleFa: 'پیشنهاد شما انتخاب شد',
    bodyFa: 'مکانیک پیشنهاد شما برای «{title}» را پذیرفت. سفارش {orderCode} در انتظار پرداخت است.',
    channels: ['inapp', 'sms'],
    tone: 'success',
    link: '/seller/orders/{orderId}',
  },
  'quote.declined': {
    key: 'quote.declined',
    titleFa: 'پیشنهاد شما انتخاب نشد',
    bodyFa: 'پیشنهاد شما برای درخواست «{title}» توسط مکانیک انتخاب نشد.',
    channels: ['inapp'],
    tone: 'neutral',
    link: '/seller/quotes',
  },
  'order.created': {
    key: 'order.created',
    titleFa: 'سفارش جدید ثبت شد',
    bodyFa: 'سفارش {code} به مبلغ {total} در انتظار پرداخت است.',
    channels: ['inapp'],
    tone: 'info',
    link: '/seller/orders/{orderId}',
  },
  'order.paid': {
    key: 'order.paid',
    titleFa: 'سفارش پرداخت شد',
    bodyFa: 'سفارش {code} پرداخت شد. لطفاً آماده‌سازی را آغاز کنید. ({mode})',
    channels: ['inapp', 'sms'],
    tone: 'success',
    link: '/seller/orders/{orderId}',
  },
  'order.payment_failed': {
    key: 'order.payment_failed',
    titleFa: 'پرداخت ناموفق بود',
    bodyFa: 'پرداخت سفارش {code} ناموفق ماند. می‌توانید دوباره تلاش کنید یا سفارش را لغو کنید.',
    channels: ['inapp', 'sms'],
    tone: 'danger',
    link: '/mechanic/orders/{orderId}',
  },
  'order.confirmed': {
    key: 'order.confirmed',
    titleFa: 'سفارش تأیید شد',
    bodyFa: 'فروشنده سفارش {code} را تأیید کرد.',
    channels: ['inapp'],
    tone: 'success',
    link: '/mechanic/orders/{orderId}',
  },
  'order.preparing': {
    key: 'order.preparing',
    titleFa: 'آماده‌سازی آغاز شد',
    bodyFa: 'سفارش {code} در حال آماده‌سازی است. زمان تقریبی: {eta}',
    channels: ['inapp'],
    tone: 'progress',
    link: '/mechanic/orders/{orderId}',
  },
  'order.ready': {
    key: 'order.ready',
    titleFa: 'سفارش آماده تحویل به پیک است',
    bodyFa: 'سفارش {code} آماده است و درخواست پیک ثبت شد.',
    channels: ['inapp'],
    tone: 'info',
    link: '/mechanic/orders/{orderId}',
  },
  'order.cancelled': {
    key: 'order.cancelled',
    titleFa: 'سفارش لغو شد',
    bodyFa: 'سفارش {code} لغو شد. دلیل: {reason}',
    channels: ['inapp', 'sms'],
    tone: 'danger',
    link: '/mechanic/orders/{orderId}',
  },
  'order.delivered': {
    key: 'order.delivered',
    titleFa: 'سفارش تحویل داده شد',
    bodyFa: 'سفارش {code} تحویل شد. در صورت مغایرت، تا {refundWindow} روز امکان ثبت رسیدگی دارید.',
    channels: ['inapp', 'sms'],
    tone: 'success',
    link: '/mechanic/orders/{orderId}',
  },
  'order.completed': {
    key: 'order.completed',
    titleFa: 'سفارش تکمیل شد',
    bodyFa: 'سفارش {code} تکمیل شد. می‌توانید به فروشنده و پیک امتیاز دهید.',
    channels: ['inapp'],
    tone: 'success',
    link: '/mechanic/orders/{orderId}',
  },
  'delivery.offered': {
    key: 'delivery.offered',
    titleFa: 'مأموریت ارسال جدید',
    bodyFa: 'مأموریت {code} — کرایه {fee}، مسافت تقریبی {distance}. مهلت پذیرش: {deadline}',
    channels: ['inapp', 'sms'],
    tone: 'info',
    link: '/courier/missions/{deliveryId}',
    respectQuietHours: false,
  },
  'delivery.accepted': {
    key: 'delivery.accepted',
    titleFa: 'پیک مأموریت را پذیرفت',
    bodyFa: 'پیک {courierName} مأموریت سفارش {code} را پذیرفت.',
    channels: ['inapp'],
    tone: 'success',
    link: '/mechanic/orders/{orderId}',
  },
  'delivery.picked_up': {
    key: 'delivery.picked_up',
    titleFa: 'بسته از فروشگاه دریافت شد',
    bodyFa: 'پیک سفارش {code} را از فروشگاه تحویل گرفت و در مسیر است.',
    channels: ['inapp'],
    tone: 'progress',
    link: '/mechanic/orders/{orderId}/tracking',
  },
  'delivery.in_transit': {
    key: 'delivery.in_transit',
    titleFa: 'ارسال آغاز شد',
    bodyFa: 'سفارش {code} در مسیر تحویل است. زمان تخمینی: {eta}',
    channels: ['inapp'],
    tone: 'progress',
    link: '/mechanic/orders/{orderId}/tracking',
  },
  'delivery.reassigned': {
    key: 'delivery.reassigned',
    titleFa: 'پیک مأموریت را نپذیرفت',
    bodyFa: 'مأموریت {code} برای پیک دیگری ارسال شد.',
    channels: ['inapp'],
    tone: 'warning',
    link: '/admin/deliveries/{deliveryId}',
  },
  'delivery.no_courier': {
    key: 'delivery.no_courier',
    titleFa: 'پیک واجد شرایط یافت نشد',
    bodyFa: 'برای سفارش {code} در حال حاضر پیک آنلاینی در محدوده پیدا نشد. موضوع به پشتیبانی ارجاع شد و وضعیت از همین صفحه پیگیری می‌شود.',
    channels: ['inapp'],
    tone: 'warning',
    link: '/mechanic/orders/{orderId}',
  },
  'delivery.no_courier.admin': {
    key: 'delivery.no_courier.admin',
    titleFa: 'مأموریت بدون پیک ماند',
    bodyFa: 'مأموریت {deliveryCode} برای سفارش {code} بدون پیک ماند. دلیل: {reason}',
    channels: ['inapp'],
    tone: 'danger',
    link: '/admin/deliveries/{deliveryId}',
  },
  'account.verified': {
    key: 'account.verified',
    titleFa: 'حساب شما تأیید شد',
    bodyFa: 'حساب {profileKind} شما تأیید شد و می‌توانید فعالیت خود را آغاز کنید.',
    channels: ['inapp', 'sms'],
    tone: 'success',
  },
  'account.rejected': {
    key: 'account.rejected',
    titleFa: 'حساب شما تأیید نشد',
    bodyFa: 'بررسی مدارک کامل نبود. دلیل: {reason}',
    channels: ['inapp', 'sms'],
    tone: 'danger',
  },
  'return.requested': {
    key: 'return.requested',
    titleFa: 'درخواست مرجوعی ثبت شد',
    bodyFa: 'برای سفارش {code} درخواست مرجوعی با کد {returnCode} و مبلغ بازپرداخت {amount} ثبت شد.',
    channels: ['inapp'],
    tone: 'warning',
    link: '/seller/returns/{returnId}',
  },
  'return.status_changed': {
    key: 'return.status_changed',
    titleFa: 'وضعیت درخواست مرجوعی تغییر کرد',
    bodyFa: 'درخواست {returnCode} به وضعیت «{status}» تغییر یافت.',
    channels: ['inapp', 'sms'],
    tone: 'info',
    link: '/mechanic/returns/{returnId}',
  },
  'ticket.created': {
    key: 'ticket.created',
    titleFa: 'درخواست پشتیبانی ثبت شد',
    bodyFa: 'تیکت {code} ثبت شد. تیم پشتیبانی به‌زودی پاسخ می‌دهد.',
    channels: ['inapp'],
    tone: 'info',
    link: '/support/tickets/{ticketId}',
  },
  'ticket.replied': {
    key: 'ticket.replied',
    titleFa: 'پاسخ پشتیبانی',
    bodyFa: 'برای تیکت {code} پاسخ جدیدی ثبت شد.',
    channels: ['inapp', 'sms'],
    tone: 'info',
    link: '/support/tickets/{ticketId}',
  },
  'payout.created': {
    key: 'payout.created',
    titleFa: 'تسویه ثبت شد',
    bodyFa: 'تسویه {code} به مبلغ {amount} ثبت شد و در وضعیت «{status}» است.',
    channels: ['inapp'],
    tone: 'success',
    link: '/finance/payouts',
  },
  'inventory.low_stock': {
    key: 'inventory.low_stock',
    titleFa: 'موجودی رو به پایان است',
    bodyFa: 'موجودی «{productName}» به {stock} رسیده است. برای جلوگیری از لغو سفارش، موجودی را به‌روزرسانی کنید.',
    channels: ['inapp'],
    tone: 'warning',
    link: '/seller/products/{productId}',
  },
};

/** جای‌گذاری متغیرها در الگوهای فارسی. */
export function renderTemplate(template: string, vars: Record<string, unknown> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? '—' : String(value);
  });
}

/** فهرست متغیرهای `{name}` به‌کاررفته در یک یا چند قالب. */
export function templateVars(...templates: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const template of templates) {
    if (!template) continue;
    for (const match of template.matchAll(/\{(\w+)\}/g)) found.add(match[1]);
  }
  return [...found];
}

/**
 * متغیرهای لازم یک رویداد (از قالب عنوان، متن و لینک استخراج می‌شود).
 * برای تشخیص زودهنگام خطای «نام متغیر اشتباه در فراخوانی notify» استفاده می‌شود؛
 * چنین خطایی پیش‌تر باعث شد لینک اعلان پیشنهاد قیمت به `/mechanic/requests/—/quotes` تبدیل شود.
 */
export function requiredVarsOf(event: NotificationEventDefinition): string[] {
  return templateVars(event.titleFa, event.bodyFa, event.link);
}

/** متغیرهای موردنیاز رویداد که در `vars` ارائه نشده‌اند (یا مقدارشان null/undefined است). */
export function missingVarsOf(event: NotificationEventDefinition, vars: Record<string, unknown>): string[] {
  return requiredVarsOf(event).filter((key) => vars[key] === undefined || vars[key] === null || vars[key] === '');
}

export function getEvent(key: string): NotificationEventDefinition | undefined {
  return NOTIFICATION_EVENTS[key];
}
