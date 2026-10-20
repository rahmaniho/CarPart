import { ValidationPipe } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';
import { AppException, ErrorCodes } from '../errors/app-error';

/**
 * اعتبارسنجی ورودی و تولید خطای ساخت‌یافته فارسی.
 *
 * چرا این ماژول جداست؟
 * - پیام خطای پیش‌فرض class-validator انگلیسی است؛ کاربر ایرانی باید پیام فارسی ببیند.
 * - کلاینت (وب) برای نمایش خطا زیر هر فیلد به `errors: [{field, message}]` نیاز دارد،
 *   در حالی که پاسخ پیش‌فرض فقط آرایه‌ای از رشته‌ها برمی‌گرداند.
 * - یک تعریف مشترک برای `main.ts` و برنامه تست باعث می‌شود تست‌ها دقیقاً همان
 *   رفتار زمان اجرا را بسنجند (همسان‌سازی محیط تست و تولید).
 */

/** تشخیص متن فارسی/عربی برای اینکه پیام اختصاصی DTO را جایگزین پیام پیش‌فرض نکنیم. */
const PERSIAN_RE = /[\u0600-\u06FF]/;

/** پیام فارسی پیش‌فرض برای قیود پرکاربرد class-validator. */
const CONSTRAINT_MESSAGES_FA: Record<string, (field: string) => string> = {
  isNotEmpty: (f) => `${f} نمی‌تواند خالی باشد.`,
  isNotEmptyString: (f) => `${f} نمی‌تواند خالی باشد.`,
  isString: (f) => `${f} باید متن باشد.`,
  isInt: (f) => `${f} باید عدد صحیح باشد.`,
  isNumber: (f) => `${f} باید عدد باشد.`,
  isPositive: (f) => `${f} باید عددی مثبت باشد.`,
  min: (f) => `مقدار ${f} از حد مجاز کمتر است.`,
  max: (f) => `مقدار ${f} از حد مجاز بیشتر است.`,
  minLength: (f) => `طول ${f} کوتاه‌تر از حد مجاز است.`,
  maxLength: (f) => `طول ${f} بلندتر از حد مجاز است.`,
  isUUID: (f) => `شناسه ${f} معتبر نیست.`,
  isUrl: (f) => `نشانی ${f} معتبر نیست.`,
  isEmail: (f) => `رایانامه ${f} معتبر نیست.`,
  isMobilePhone: (f) => `شماره موبایل ${f} معتبر نیست.`,
  isBoolean: (f) => `${f} باید بله/خیر باشد.`,
  isBooleanString: (f) => `${f} باید بله/خیر باشد.`,
  isArray: (f) => `${f} باید فهرست باشد.`,
  arrayNotEmpty: (f) => `${f} نمی‌تواند فهرست خالی باشد.`,
  arrayMinSize: (f) => `تعداد موارد ${f} کمتر از حد مجاز است.`,
  arrayMaxSize: (f) => `تعداد موارد ${f} بیشتر از حد مجاز است.`,
  isIn: (f) => `مقدار ${f} در میان گزینه‌های مجاز نیست.`,
  isEnum: (f) => `مقدار ${f} در میان گزینه‌های مجاز نیست.`,
  isDateString: (f) => `تاریخ ${f} معتبر نیست.`,
  isDate: (f) => `تاریخ ${f} معتبر نیست.`,
  matches: (f) => `قالب ${f} معتبر نیست.`,
  isLatitude: (f) => `عرض جغرافیایی ${f} معتبر نیست.`,
  isLongitude: (f) => `طول جغرافیایی ${f} معتبر نیست.`,
  isNumberString: (f) => `${f} باید عدد باشد.`,
  nestedValidation: (f) => `مقادیر ${f} معتبر نیست.`,
  whitelistValidation: (f) => `فیلد ${f} مجاز نیست و از درخواست حذف نشد.`,
  forbidNonWhitelisted: (f) => `فیلد ${f} مجاز نیست.`,
};

/** نام فارسی میدان‌های پرکاربرد برای پیام‌های خوانا. */
const FIELD_NAMES_FA: Record<string, string> = {
  mobile: 'شماره موبایل',
  code: 'کد تأیید',
  password: 'رمز عبور',
  fullName: 'نام و نام خانوادگی',
  items: 'اقلام',
  quantity: 'تعداد',
  sellerProductId: 'شناسه محصول فروشنده',
  deliveryAddressId: 'نشانی تحویل',
  couponCode: 'کد تخفیف',
  notes: 'توضیحات',
  urgency: 'اولویت',
  status: 'وضعیت',
  reason: 'دلیل',
  amount: 'مبلغ',
  orderId: 'شناسه سفارش',
  price: 'قیمت',
  stock: 'موجودی',
  nameFa: 'نام',
  title: 'عنوان',
  body: 'متن',
  message: 'پیام',
  latitude: 'عرض جغرافیایی',
  longitude: 'طول جغرافیایی',
  city: 'شهر',
  addressText: 'نشانی',
};

function fieldLabelFa(field: string): string {
  const last = field.split('.').pop() ?? field;
  return FIELD_NAMES_FA[last] ?? last;
}

/** تبدیل درخت خطاهای اعتبارسنجی به فهرست تخت `{field, message}` با پیام فارسی. */
export function flattenValidationErrorsFa(errors: ValidationError[], prefix = ''): Array<{ field: string; message: string }> {
  const out: Array<{ field: string; message: string }> = [];
  for (const error of errors ?? []) {
    const field = prefix ? `${prefix}.${error.property}` : error.property;
    for (const [constraint, rawMessage] of Object.entries(error.constraints ?? {})) {
      const custom = typeof rawMessage === 'string' && PERSIAN_RE.test(rawMessage) ? rawMessage : null;
      const fallback = CONSTRAINT_MESSAGES_FA[constraint]?.(fieldLabelFa(field));
      out.push({ field, message: custom ?? fallback ?? rawMessage ?? `مقدار ${fieldLabelFa(field)} معتبر نیست.` });
    }
    if (error.children?.length) out.push(...flattenValidationErrorsFa(error.children, field));
  }
  return out;
}

/**
 * ساخت ValidationPipe سراسری.
 * فیلدهای ناشناخته هم حذف و هم رد می‌شوند تا نتوان با ارسال `status` یا `payableTotal`
 * قیمت/وضعیت سفارش را از سمت کلاینت تغییر داد.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    validationError: { target: false, value: false },
    exceptionFactory: (errors: ValidationError[]) => {
      const fieldErrors = flattenValidationErrorsFa(errors);
      const first = fieldErrors[0]?.message ?? 'مقادیر ارسالی معتبر نیست.';
      return new AppException(first, ErrorCodes.VALIDATION_FAILED, {
        statusCode: 400,
        faMessage: fieldErrors.length > 1 ? `${first} (${fieldErrors.length} خطا)` : first,
        errors: fieldErrors,
        details: { fieldCount: fieldErrors.length },
      });
    },
  });
}
