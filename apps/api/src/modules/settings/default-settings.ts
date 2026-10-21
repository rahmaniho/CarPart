import type { SettingValueType } from './entities/system-setting.entity';

export interface DefaultSetting {
  key: string;
  group: string;
  valueType: SettingValueType;
  value: unknown;
  faLabel: string;
  description?: string;
  unit?: string;
  constraints?: { min?: number; max?: number; enum?: string[] };
  isPublic?: boolean;
}

/**
 * تنظیمات پیش‌فرض تجاری.
 * هیچ تعرفه یا قانون تجاری در کد ثابت نیست؛ همه از این جدول خوانده می‌شوند
 * و مدیر می‌تواند از پنل مدیریت آن‌ها را تغییر دهد.
 */
export const DEFAULT_SETTINGS: DefaultSetting[] = [
  // --- پلتفرم ---
  { key: 'platform.name', group: 'platform', valueType: 'string', value: 'قطعه‌رسان', faLabel: 'نام پلتفرم', isPublic: true },
  { key: 'platform.support_phone', group: 'platform', valueType: 'string', value: '021-91000000', faLabel: 'تلفن پشتیبانی', isPublic: true },
  { key: 'platform.default_city', group: 'platform', valueType: 'string', value: 'تهران', faLabel: 'شهر پیش‌فرض', isPublic: true },

  // --- مالی ---
  {
    key: 'finance.commission.percent',
    group: 'finance',
    valueType: 'number',
    value: 7,
    faLabel: 'کارمزد پیش‌فرض پلتفرم (درصد)',
    description: 'درصد کارمزد از مبلغ خالص اقلام سفارش (پس از کسر تخفیف).',
    unit: 'percent',
    constraints: { min: 0, max: 30 },
  },
  {
    key: 'finance.commission.min_amount',
    group: 'finance',
    valueType: 'number',
    value: 0,
    faLabel: 'حداقل کارمزد هر سفارش',
    unit: 'toman',
    constraints: { min: 0, max: 10000000 },
  },
  {
    key: 'finance.delivery.base_fee',
    group: 'finance',
    valueType: 'number',
    value: 25000,
    faLabel: 'هزینه پایه ارسال',
    description: 'مبلغ ثابت شروع هزینه ارسال برای هر مأموریت.',
    unit: 'toman',
    constraints: { min: 0, max: 5000000 },
  },
  {
    key: 'finance.delivery.per_km_fee',
    group: 'finance',
    valueType: 'number',
    value: 6000,
    faLabel: 'هزینه ارسال به ازای هر کیلومتر',
    unit: 'toman',
    constraints: { min: 0, max: 500000 },
  },
  {
    key: 'finance.delivery.urgency_multiplier',
    group: 'finance',
    valueType: 'json',
    value: { normal: 1, urgent: 1.25, critical: 1.5 },
    faLabel: 'ضریب فوریت در هزینه ارسال',
    description: 'ضریب‌ها پیش از پرداخت به کاربر نمایش داده می‌شوند.',
  },
  {
    key: 'finance.delivery.free_over_amount',
    group: 'finance',
    valueType: 'number',
    value: 0,
    faLabel: 'ارسال رایگان برای سفارش بالای (صفر = غیرفعال)',
    unit: 'toman',
    constraints: { min: 0, max: 1000000000 },
  },
  {
    key: 'finance.courier.share_percent',
    group: 'finance',
    valueType: 'number',
    value: 85,
    faLabel: 'سهم پیک از هزینه ارسال (درصد)',
    unit: 'percent',
    constraints: { min: 0, max: 100 },
  },
  {
    key: 'finance.payout.min_amount',
    group: 'finance',
    valueType: 'number',
    value: 100000,
    faLabel: 'حداقل مبلغ تسویه',
    unit: 'toman',
    constraints: { min: 0, max: 100000000 },
  },
  {
    key: 'finance.payout.auto_schedule_cron',
    group: 'finance',
    valueType: 'string',
    value: '0 6 * * *',
    faLabel: 'زمان‌بندی تسویه خودکار (cron)',
    description: 'خالی = تسویه فقط دستی توسط مدیر انجام می‌شود.',
  },

  // --- درخواست تأمین و پیشنهاد ---
  {
    key: 'request.quote.deadline_minutes',
    group: 'request',
    valueType: 'number',
    value: 45,
    faLabel: 'مهلت پاسخ فروشندگان (دقیقه)',
    description: 'پس از پایان مهلت، درخواست به‌صورت شفاف بسته می‌شود.',
    constraints: { min: 5, max: 1440 },
  },
  {
    key: 'request.quote.urgent_deadline_minutes',
    group: 'request',
    valueType: 'number',
    value: 15,
    faLabel: 'مهلت پاسخ برای درخواست فوری (دقیقه)',
    constraints: { min: 3, max: 240 },
  },
  { key: 'search.max_candidates', group: 'search', valueType: 'number', value: 300, faLabel: 'حداکثر نامزد بررسی‌شده در هر جست‌وجو', description: 'برای حفظ پاسخ‌دهی، رتبه‌بندی دقیق روی این تعداد از بهترین نامزدها انجام می‌شود.', constraints: { min: 50, max: 2000 } },
  { key: 'request.quote.max_target_sellers', group: 'request', valueType: 'number', value: 12, faLabel: 'حداکثر فروشندگان هدف هر درخواست', constraints: { min: 1, max: 100 } },
  { key: 'request.quote.validity_minutes', group: 'request', valueType: 'number', value: 60, faLabel: 'اعتبار پیشنهاد قیمت (دقیقه)', constraints: { min: 5, max: 1440 } },

  // --- سفارش ---
  { key: 'order.payment_expire_minutes', group: 'order', valueType: 'number', value: 15, faLabel: 'مهلت پرداخت سفارش (دقیقه)', description: 'پس از این مهلت، سفارش پرداخت‌نشده به‌صورت خودکار لغو و موجودی آزاد می‌شود.', constraints: { min: 1, max: 240 } },
  { key: 'order.preparation_timeout_minutes', group: 'order', valueType: 'number', value: 120, faLabel: 'حداکثر زمان آماده‌سازی (دقیقه)', constraints: { min: 10, max: 2880 } },
  { key: 'order.auto_complete_hours', group: 'order', valueType: 'number', value: 48, faLabel: 'تکمیل خودکار پس از تحویل (ساعت)', constraints: { min: 1, max: 720 } },
  { key: 'order.refund_window_days', group: 'order', valueType: 'number', value: 3, faLabel: 'مهلت درخواست بازپرداخت (روز)', constraints: { min: 0, max: 30 } },
  { key: 'order.dispute_window_days', group: 'order', valueType: 'number', value: 7, faLabel: 'مهلت ثبت مغایرت (روز)', constraints: { min: 0, max: 60 } },

  // --- لجستیک ---
  { key: 'courier.offer.timeout_minutes', group: 'delivery', valueType: 'number', value: 4, faLabel: 'مهلت پذیرش مأموریت توسط پیک (دقیقه)', constraints: { min: 1, max: 60 } },
  { key: 'courier.max_offers_per_delivery', group: 'delivery', valueType: 'number', value: 5, faLabel: 'حداکثر تعداد پیشنهاد برای هر مأموریت', constraints: { min: 1, max: 20 } },
  { key: 'courier.search_radius_km', group: 'delivery', valueType: 'number', value: 15, faLabel: 'شعاع جست‌وجوی پیک (کیلومتر)', constraints: { min: 1, max: 100 } },
  { key: 'courier.max_concurrent_deliveries', group: 'delivery', valueType: 'number', value: 2, faLabel: 'حداکثر مأموریت هم‌زمان هر پیک', constraints: { min: 1, max: 10 } },
  { key: 'courier.location.retention_hours', group: 'delivery', valueType: 'number', value: 24, faLabel: 'نگهداری نمونه موقعیت پیک (ساعت)', description: 'برای رعایت حریم خصوصی، سوابق قدیمی‌تر پاکسازی می‌شوند.', constraints: { min: 1, max: 720 } },
  { key: 'courier.location.arrival_radius_m', group: 'delivery', valueType: 'number', value: 300, faLabel: 'شعاع تشخیص رسیدن پیک به فروشگاه (متر)', description: 'با ورود GPS معتبر پیک به این شعاع، فروشنده یک‌بار برای آماده‌سازی بسته آگاه می‌شود.', unit: 'meter', constraints: { min: 50, max: 2000 } },
  { key: 'courier.location.max_accuracy_m', group: 'delivery', valueType: 'number', value: 150, faLabel: 'حداکثر خطای GPS برای تشخیص رسیدن (متر)', description: 'نمونه‌های کم‌دقت ذخیره می‌شوند اما اعلان رسیدن ایجاد نمی‌کنند.', unit: 'meter', constraints: { min: 20, max: 2000 } },
  { key: 'courier.location.fresh_seconds', group: 'delivery', valueType: 'number', value: 45, faLabel: 'حداکثر عمر موقعیت زنده (ثانیه)', description: 'پس از این مدت، موقعیت در رابط به‌عنوان قدیمی نمایش داده می‌شود.', unit: 'second', constraints: { min: 15, max: 600 } },

  // --- موتور رتبه‌بندی ---
  {
    key: 'ranking.weights',
    group: 'ranking',
    valueType: 'json',
    value: {
      compatibility: 25,
      price: 22,
      deliveryFee: 8,
      preparation: 10,
      eta: 10,
      distance: 8,
      sellerRating: 12,
      reliability: 5,
    },
    faLabel: 'وزن عوامل رتبه‌بندی پیشنهادها',
    description: 'مجموع وزن‌ها به ۱۰۰ نرمال می‌شود. تغییر وزن‌ها بلافاصله در رتبه‌بندی اثر دارد و شرح امتیاز به کاربر نمایش داده می‌شود.',
  },
  { key: 'ranking.featured_boost', group: 'ranking', valueType: 'number', value: 0, faLabel: 'امتیاز افزوده جایگاه ویژه (شفاف)', description: 'اگر تبلیغات فعال شود، باید در شرح رتبه‌بندی به کاربر اعلام شود.', constraints: { min: 0, max: 20 } },

  // --- اعلان‌ها ---
  {
    key: 'notifications.channels',
    group: 'notifications',
    valueType: 'json',
    value: { inapp: true, sms: true, email: false, push: true },
    faLabel: 'کانال‌های فعال اعلان',
  },
  { key: 'notifications.quiet_hours_start', group: 'notifications', valueType: 'string', value: '22:00', faLabel: 'شروع ساعات سکوت پیامکی' },
  { key: 'notifications.quiet_hours_end', group: 'notifications', valueType: 'string', value: '08:00', faLabel: 'پایان ساعات سکوت پیامکی' },
  { key: 'notifications.max_retry', group: 'notifications', valueType: 'number', value: 3, faLabel: 'حداکثر تلاش مجدد ارسال اعلان', constraints: { min: 0, max: 10 } },

  // --- نقشه ---
  { key: 'map.detour_factor', group: 'map', valueType: 'number', value: 1.35, faLabel: 'ضریب تبدیل فاصله مستقیم به مسافت شهری', description: 'فقط در لایه تخمینی استفاده می‌شود؛ با اتصال سرویس مسیر واقعی بی‌اثر است.', constraints: { min: 1, max: 3 } },
  { key: 'map.avg_speed_kmh', group: 'map', valueType: 'number', value: 24, faLabel: 'سرعت میانگین شهری (کیلومتر بر ساعت)', constraints: { min: 5, max: 120 } },
  { key: 'map.pickup_overhead_minutes', group: 'map', valueType: 'number', value: 12, faLabel: 'زمان سربار دریافت از فروشگاه (دقیقه)', constraints: { min: 0, max: 120 } },
];

export const SETTING_KEYS: string[] = DEFAULT_SETTINGS.map((setting) => setting.key);
export type SettingKey = string;
