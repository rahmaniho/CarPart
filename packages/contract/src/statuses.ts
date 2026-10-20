/**
 * وضعیت‌های چرخه‌های مختلف سامانه + برچسب فارسی + لحن بصری (برای Badge).
 * این مقادیر در پایگاه‌داده به‌صورت رشته (varchar) ذخیره می‌شوند تا در SQLite و PostgreSQL یکسان کار کنند.
 */
export type Tone = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger';

export type LabeledStatus<T extends string> = Record<T, { fa: string; tone: Tone; hint?: string }>;

/* ------------------------------- درخواست تأمین ------------------------------ */
export const REQUEST_STATUSES = [
  'OPEN',
  'QUOTED',
  'EXPIRED',
  'UNFULFILLED',
  'CONVERTED',
  'CANCELLED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_META: LabeledStatus<RequestStatus> = {
  OPEN: { fa: 'در انتظار پیشنهاد', tone: 'progress', hint: 'برای فروشندگان مرتبط ارسال شده است' },
  QUOTED: { fa: 'پیشنهادها دریافت شد', tone: 'info', hint: 'می‌توانید پیشنهادها را مقایسه کنید' },
  EXPIRED: { fa: 'مهلت تمام شد', tone: 'warning', hint: 'پیشنهادی انتخاب نشد' },
  UNFULFILLED: { fa: 'بدون پیشنهاد', tone: 'warning', hint: 'هیچ فروشنده‌ای پیشنهاد نداد' },
  CONVERTED: { fa: 'تبدیل به سفارش', tone: 'success' },
  CANCELLED: { fa: 'لغو شد', tone: 'neutral' },
};

/* --------------------------------- پیشنهاد -------------------------------- */
export const QUOTE_STATUSES = ['SUBMITTED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN', 'CONVERTED'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_META: LabeledStatus<QuoteStatus> = {
  SUBMITTED: { fa: 'ثبت‌شده', tone: 'info' },
  ACCEPTED: { fa: 'انتخاب‌شده توسط مکانیک', tone: 'success' },
  DECLINED: { fa: 'رد شده توسط مکانیک', tone: 'neutral' },
  EXPIRED: { fa: 'منقضی', tone: 'warning' },
  WITHDRAWN: { fa: 'پس گرفته شده', tone: 'neutral' },
  CONVERTED: { fa: 'تبدیل به سفارش', tone: 'success' },
};

/* ---------------------------------- سفارش --------------------------------- */
export const ORDER_STATUSES = [
  'DRAFT',
  'WAITING_FOR_PAYMENT',
  'PAID',
  'SELLER_CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'WAITING_FOR_COURIER',
  'COURIER_ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'PAYMENT_FAILED',
  'REFUND_REQUESTED',
  'REFUNDED',
  'DISPUTED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_META: LabeledStatus<OrderStatus> = {
  DRAFT: { fa: 'پیش‌نویس', tone: 'neutral', hint: 'هنوز ثبت نهایی نشده است' },
  WAITING_FOR_PAYMENT: { fa: 'در انتظار پرداخت', tone: 'progress' },
  PAID: { fa: 'پرداخت شده', tone: 'success' },
  SELLER_CONFIRMED: { fa: 'تأیید فروشنده', tone: 'success' },
  PREPARING: { fa: 'در حال آماده‌سازی', tone: 'progress' },
  READY_FOR_PICKUP: { fa: 'آماده تحویل به پیک', tone: 'info' },
  WAITING_FOR_COURIER: { fa: 'در انتظار تخصیص پیک', tone: 'progress' },
  COURIER_ASSIGNED: { fa: 'پیک تعیین شد', tone: 'info' },
  PICKED_UP: { fa: 'تحویل گرفته از فروشگاه', tone: 'progress' },
  IN_TRANSIT: { fa: 'در حال ارسال', tone: 'progress' },
  DELIVERED: { fa: 'تحویل داده شد', tone: 'success' },
  COMPLETED: { fa: 'تکمیل شده', tone: 'success' },
  CANCELLED: { fa: 'لغو شده', tone: 'danger' },
  PAYMENT_FAILED: { fa: 'پرداخت ناموفق', tone: 'danger' },
  REFUND_REQUESTED: { fa: 'درخواست بازپرداخت', tone: 'warning' },
  REFUNDED: { fa: 'بازپرداخت شد', tone: 'warning' },
  DISPUTED: { fa: 'در حال بررسی اختلاف', tone: 'warning' },
};

/** مرحله‌های نمایشی برای نوار پیشرفت سفارش (تجمیع وضعیت‌های فنی). */
export const ORDER_PROGRESS_STEPS = [
  { key: 'paid', fa: 'پرداخت', statuses: ['WAITING_FOR_PAYMENT', 'PAID'] as OrderStatus[] },
  { key: 'confirmed', fa: 'تأیید فروشنده', statuses: ['SELLER_CONFIRMED'] as OrderStatus[] },
  { key: 'preparing', fa: 'آماده‌سازی', statuses: ['PREPARING', 'READY_FOR_PICKUP'] as OrderStatus[] },
  { key: 'shipping', fa: 'ارسال', statuses: ['WAITING_FOR_COURIER', 'COURIER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] as OrderStatus[] },
  { key: 'delivered', fa: 'تحویل', statuses: ['DELIVERED', 'COMPLETED'] as OrderStatus[] },
] as const;

export const ORDER_FINAL_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED', 'REFUNDED'];

/* ---------------------------------- ارسال --------------------------------- */
export const DELIVERY_STATUSES = [
  'PENDING_ASSIGNMENT',
  'OFFERED',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERY_ATTEMPTED',
  'DELIVERED',
  'OFFER_EXPIRED',
  'FAILED',
  'CANCELLED',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_STATUS_META: LabeledStatus<DeliveryStatus> = {
  PENDING_ASSIGNMENT: { fa: 'در انتظار تخصیص پیک', tone: 'progress' },
  OFFERED: { fa: 'به پیک پیشنهاد شد', tone: 'info' },
  ACCEPTED: { fa: 'پذیرفته شد', tone: 'success' },
  PICKED_UP: { fa: 'از فروشگاه دریافت شد', tone: 'progress' },
  IN_TRANSIT: { fa: 'در مسیر تحویل', tone: 'progress' },
  DELIVERY_ATTEMPTED: { fa: 'تلاش تحویل ناموفق', tone: 'warning' },
  DELIVERED: { fa: 'تحویل شد', tone: 'success' },
  OFFER_EXPIRED: { fa: 'مهلت پذیرش تمام شد', tone: 'warning' },
  FAILED: { fa: 'ناموفق', tone: 'danger' },
  CANCELLED: { fa: 'لغو شد', tone: 'neutral' },
};

/* ---------------------------------- پرداخت -------------------------------- */
export const PAYMENT_STATUSES = ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'EXPIRED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_META: LabeledStatus<PaymentStatus> = {
  CREATED: { fa: 'ایجاد شده', tone: 'neutral' },
  PENDING: { fa: 'در انتظار پاسخ درگاه', tone: 'progress' },
  SUCCESS: { fa: 'موفق', tone: 'success' },
  FAILED: { fa: 'ناموفق', tone: 'danger' },
  PARTIALLY_REFUNDED: { fa: 'بازپرداخت جزئی', tone: 'warning' },
  REFUNDED: { fa: 'بازپرداخت کامل', tone: 'warning' },
  EXPIRED: { fa: 'منقضی', tone: 'neutral' },
};

/** حالت درگاه پرداخت — باید در رابط کاربری به‌وضوح نمایش داده شود. */
export const PAYMENT_MODES = ['sandbox', 'live'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export const PAYMENT_MODE_META: Record<PaymentMode, { fa: string; tone: Tone }> = {
  sandbox: { fa: 'درگاه آزمایشی', tone: 'warning' },
  live: { fa: 'درگاه واقعی', tone: 'success' },
};

export const REFUND_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING', 'DONE', 'FAILED'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export const REFUND_STATUS_META: LabeledStatus<RefundStatus> = {
  REQUESTED: { fa: 'درخواست ثبت شد', tone: 'warning' },
  APPROVED: { fa: 'تأیید شد', tone: 'info' },
  REJECTED: { fa: 'رد شد', tone: 'danger' },
  PROCESSING: { fa: 'در حال اجرا', tone: 'progress' },
  DONE: { fa: 'انجام شد', tone: 'success' },
  FAILED: { fa: 'ناموفق', tone: 'danger' },
};

export const PAYOUT_STATUSES = ['PENDING', 'READY', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];
export const PAYOUT_STATUS_META: LabeledStatus<PayoutStatus> = {
  PENDING: { fa: 'در انتظار', tone: 'neutral' },
  READY: { fa: 'آماده تسویه', tone: 'info' },
  PROCESSING: { fa: 'در حال تسویه', tone: 'progress' },
  PAID: { fa: 'تسویه شد', tone: 'success' },
  FAILED: { fa: 'ناموفق', tone: 'danger' },
  CANCELLED: { fa: 'لغو شد', tone: 'neutral' },
};

export const PAYOUT_RECIPIENT_TYPES = ['seller', 'courier'] as const;
export type PayoutRecipientType = (typeof PAYOUT_RECIPIENT_TYPES)[number];

/* -------------------------------- تأیید هویت ------------------------------- */
export const VERIFICATION_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export const VERIFICATION_STATUS_META: LabeledStatus<VerificationStatus> = {
  DRAFT: { fa: 'پیش‌نویس', tone: 'neutral', hint: 'اطلاعات را کامل و ارسال کنید' },
  PENDING_REVIEW: { fa: 'در انتظار بررسی', tone: 'progress' },
  APPROVED: { fa: 'تأیید شده', tone: 'success' },
  REJECTED: { fa: 'رد شده', tone: 'danger' },
  SUSPENDED: { fa: 'تعلیق شده', tone: 'danger' },
};

/* -------------------------------- پشتیبانی -------------------------------- */
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_STATUS_META: LabeledStatus<TicketStatus> = {
  OPEN: { fa: 'باز', tone: 'info' },
  IN_PROGRESS: { fa: 'در حال بررسی', tone: 'progress' },
  WAITING_FOR_USER: { fa: 'در انتظار پاسخ شما', tone: 'warning' },
  RESOLVED: { fa: 'حل شد', tone: 'success' },
  CLOSED: { fa: 'بسته شد', tone: 'neutral' },
};

export const RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED', 'CLOSED'] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];
export const RETURN_STATUS_META: LabeledStatus<ReturnStatus> = {
  REQUESTED: { fa: 'درخواست ثبت شد', tone: 'info' },
  APPROVED: { fa: 'تأیید فروشنده', tone: 'success' },
  REJECTED: { fa: 'رد شد', tone: 'danger' },
  RECEIVED: { fa: 'قطعه دریافت شد', tone: 'progress' },
  REFUNDED: { fa: 'بازپرداخت شد', tone: 'warning' },
  CLOSED: { fa: 'بسته شد', tone: 'neutral' },
};

/* ------------------------------- مقادیر کمکی ------------------------------- */
export const URGENCY_LEVELS = ['normal', 'urgent', 'critical'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];
export const URGENCY_META: LabeledStatus<UrgencyLevel> = {
  normal: { fa: 'عادی', tone: 'neutral' },
  urgent: { fa: 'فوری', tone: 'warning' },
  critical: { fa: 'بحرانی (خواب خودرو)', tone: 'danger' },
};

export const QUALITY_GRADES = [
  'genuine',
  'oem',
  'aftermarket_high',
  'aftermarket_economy',
  'used',
  'unknown',
] as const;
export type QualityGrade = (typeof QUALITY_GRADES)[number];
export const QUALITY_META: LabeledStatus<QualityGrade> = {
  genuine: { fa: 'اصل (شرکتی)', tone: 'success' },
  oem: { fa: 'OEM / تأمین‌کننده اصلی', tone: 'success' },
  aftermarket_high: { fa: 'درجه یک (وارداتی)', tone: 'info' },
  aftermarket_economy: { fa: 'درجه دو (اقتصادی)', tone: 'warning' },
  used: { fa: 'استوک / دست دوم', tone: 'warning' },
  unknown: { fa: 'نامشخص', tone: 'neutral', hint: 'سازگاری و اصالت تأیید نشده است' },
};

export const COMPATIBILITY_LEVELS = ['exact', 'likely', 'unknown', 'incompatible'] as const;
export type CompatibilityLevel = (typeof COMPATIBILITY_LEVELS)[number];
export const COMPATIBILITY_META: LabeledStatus<CompatibilityLevel> = {
  exact: { fa: 'سازگاری تأییدشده', tone: 'success' },
  likely: { fa: 'احتمالاً سازگار', tone: 'info', hint: 'توسط سامانه تخمین زده شده، قطعی نیست' },
  unknown: { fa: 'سازگاری نامشخص', tone: 'warning', hint: 'پیش از خرید با فروشنده هماهنگ کنید' },
  incompatible: { fa: 'ناسازگار', tone: 'danger' },
};

export const COURIER_AVAILABILITY = ['offline', 'online'] as const;
export type CourierAvailability = (typeof COURIER_AVAILABILITY)[number];

export const VEHICLE_TYPES = ['car', 'pickup', 'van', 'truck', 'motorcycle', 'bus'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export const VEHICLE_TYPE_META: LabeledStatus<VehicleType> = {
  car: { fa: 'سواری', tone: 'neutral' },
  pickup: { fa: 'وانت', tone: 'neutral' },
  van: { fa: 'ون / مینی‌بوس', tone: 'neutral' },
  truck: { fa: 'کامیون', tone: 'neutral' },
  motorcycle: { fa: 'موتورسیکلت', tone: 'neutral' },
  bus: { fa: 'اتوبوس', tone: 'neutral' },
};

export const NOTIFICATION_CHANNELS = ['inapp', 'sms', 'email', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export const NOTIFICATION_CHANNEL_META: LabeledStatus<NotificationChannel> = {
  inapp: { fa: 'اعلان درون‌برنامه‌ای', tone: 'success' },
  sms: { fa: 'پیامک', tone: 'warning', hint: 'در این نسخه آزمایشی است' },
  email: { fa: 'ایمیل', tone: 'warning', hint: 'در این نسخه آزمایشی است' },
  push: { fa: 'اعلان مرورگر', tone: 'neutral', hint: 'پیاده‌سازی نشده' },
};

export const JOB_STATUSES = ['queued', 'running', 'done', 'failed', 'cancelled'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
