# ممیزی و ارتقای عملیاتی CarPart — ۲۰۲۶-۱۰-۲۱

## روش ارزیابی

- **A:** پیاده‌سازی و آزمایش‌شده
- **B:** پیاده‌سازی‌شده اما ناقص یا نیازمند تأیید عملیاتی
- **C:** فقط UI/Mock/Sandbox
- **D:** وجود ندارد
- **E:** موجود اما دارای ایراد معماری/امنیتی مهم

این گزارش بر اساس فایل، تست و اجرای واقعی همین Commit است؛ وجود صفحه یا دکمه به‌تنهایی معیار تکمیل نیست.

## وضعیت قابلیت‌ها

| حوزه | پیش از ارتقا | پس از ارتقا | شواهد و محدودیت |
|---|---:|---:|---|
| ساختار Monorepo و قرارداد مشترک | A | A | `apps/*` و `packages/*`، Build دوگانه Contract |
| احراز هویت، Refresh rotation و نقش‌ها | A | A | گاردهای سراسری و E2E نشست/دسترسی |
| مالکیت سفارش و جداسازی کاربران | A | A | `assertReadAccess` و E2E کاربران متقاطع |
| کاتالوگ عمومی جدا از پیشنهاد فروشنده | A | A | `Part` در برابر `SellerProduct` |
| جست‌وجوی فارسی، انگلیسی، کد فنی/OEM و فیلتر خودرو | A | A | Normalize، QueryBuilder، Compatibility و Ranking |
| مترادف و اصلاح Typo ساختاریافته | D | D | پیشنهاد مرحله بعد؛ داده معتبر مترادف/فرهنگ خطا در مخزن نیست |
| سازگاری قطعه/خودرو | B | B | exact/likely/unknown موجود؛ کیفیت نتیجه وابسته به داده واقعی کاتالوگ است |
| رزرو و کسر موجودی | A | A | UPDATE شرطی و تست Oversell |
| دفتر موجودی مرتبط با سفارش | E | A | `orderId` قبلاً ثبت نمی‌شد؛ اکنون برای reservation/release/sale ثبت می‌شود |
| ماشین حالت و تاریخچه سفارش | A | A | Contract + گارد + OrderEvent |
| پرداخت Sandbox | A | A | HMAC و تأیید سمت سرور؛ صریحاً غیرواقعی |
| پرداخت واقعی Zarinpal | B | B | Adapter موجود؛ بدون Merchant/آزمون واقعی عملیاتی نیست |
| رقابت تأیید پرداخت | E | A | Claim اتمیک `VERIFYING` + timeout بازیابی + E2E رقابت |
| بازپرداخت و تسویه | A در Sandbox | A در Sandbox | عملیات واقعی Provider/بانک نیازمند تأیید بیرونی |
| تخصیص و گردش پیک | A | A | پیشنهاد، timeout، reassignment، pickup/transit/delivery OTP |
| GPS نزدیک‌به‌لحظه‌ای | B | B | Foreground آزمایش‌شده؛ Background Android پیاده‌سازی نشده |
| مرجوعی مأموریت/تماس امن | B/D | B/D | Ticket/Return عمومی هست؛ تماس Relay و گردش اختصاصی Reverse Logistics کامل نیست |
| پنل فروشنده | A/B | A/B | محصول، سفارش، RFQ و مالی موجود؛ عملیات واقعی تسویه بیرونی نیست |
| پنل مدیریت و Audit | A/B | A/B | داده واقعی، کاربران، تأیید، تنظیمات، مالی و Audit؛ گزارش تحلیلی پیشرفته ناقص |
| اعلان درون‌برنامه‌ای | A | A | Persist، dedupe و تست |
| SMS/Email/Push واقعی | B/C | B/C | Adapterها؛ وابسته به Secret و تأیید Provider، SMTP کامل نیست |
| آپلود امن | A/B | A/B | Magic bytes، اندازه، مالکیت؛ Local Storage برای HA مناسب نیست |
| SQL.js توسعه | A | A | E2E کامل در حافظه |
| PostgreSQL تولید | E | B | UUID/FK اصلاح و Baseline اضافه شد؛ آزمون PostgreSQL 16 واقعی هنوز لازم است |
| Migration نسخه‌بندی‌شده | D | A/B | Baseline + Apply/Rollback تست‌شده روی pg-compatible؛ Staging واقعی باقی است |
| تنظیمات امن Production | E | A | Fail-fast برای DB/Secrets/CORS/Demo |
| CSP و Swagger تولید | E | A | CSP در Nginx و Swagger غیرفعال در Production |
| Lint و Gate CI | E | A | ESLint 9 Flat Config، API/Web/Mobile و مرحله CI |
| Docker و Health Check | A/B | A/B | Build و Health موجود؛ Docker در محیط عامل قابل اجرا نبود |
| Backup/Restore/Rollback | B | A/B | Runbook اضافه شد؛ Restore واقعی اجرا نشده است |
| UI فارسی RTL و Mobile-first | A/B | A/B | صفحات اصلی و تست UI؛ تست دسترس‌پذیری خودکار کامل وجود ندارد |

## اولویت مشکلات

### P0

مورد P0 قابل اثبات (افشای Secret، دورزدن مجوز یا فساد قطعی) در ممیزی و تست‌های فعلی مشاهده نشد.

### P1 — اصلاح‌شده

1. **PostgreSQL غیرقابل راه‌اندازی:** FKهای UUID با `varchar(36)` و `length` ناسازگار بودند؛ اصلاح و Baseline ایجاد شد.
2. **نبود Migration تولید:** پایگاه تازه با `DB_SYNC=false` جدول نداشت؛ Migration ثبت شد.
3. **رقابت تأیید پرداخت:** امکان ورود هم‌زمان دو درخواست به اثرهای مالی وجود داشت؛ Claim اتمیک و تست رقابت اضافه شد.

### P2 — اصلاح‌شده

1. Lint تعریف شده ولی غیرقابل اجرا و خارج از CI بود.
2. Production Config مقادیر ناامن را Fail-fast نمی‌کرد.
3. CSP استقرار و محدودسازی Swagger تولید ناقص بود.
4. Inventory Movement، شناسه سفارش را در عملیات سفارش ثبت نمی‌کرد.

### P2/P3 — باقی‌مانده

- آزمون PostgreSQL 16 و Restore واقعی در Staging
- `npm audit --omit=dev`: چهار مورد Moderate و بدون High/Critical؛ دو زنجیره مربوط به `@nestjs/swagger -> js-yaml` و دو مورد مربوط به React Router 6 است. Swagger در Production عمومی نیست و برنامه Router از SSR/Hydration استفاده نمی‌کند، اما این‌ها فقط کاهش ریسک‌اند نه رفع Advisory.
- Audit کامل شامل ابزارهای توسعه نیز ۴۵ مورد (۱۱ Moderate، ۳۲ High، ۲ Critical) گزارش می‌کند که عمدتاً زنجیره Jest/Vitest/Tailwind است؛ ارتقای Major ابزارها باید جداگانه و با رگرسیون CI انجام شود.
- مهاجرت React Router 6 و Swagger به نسخه‌های Major امن بعدی؛ بدون برنامه سازگاری در این تغییر انجام نشد
- تکمیل فرهنگ مترادف و Typo با داده کنترل‌شده، نه داده ساختگی
- S3/Object Storage، SMTP واقعی، Background GPS Android و تست دستگاه
- تست خودکار Accessibility و سنجش بار جست‌وجو/داشبورد

## فایل‌های کلیدی ارتقا

- `apps/api/src/database/migrations/1761011200000-InitialPostgresSchema.ts`
- `apps/api/src/database/migration-list.ts`
- Entityهای `apps/api/src/modules/**/entities/*.ts` برای UUID/FK
- `apps/api/src/modules/payments/payments.service.ts`
- `apps/api/src/modules/sellers/seller-products.service.ts`
- `apps/api/src/config/env.schema.ts`
- `packages/contract/src/statuses.ts`
- `eslint.config.mjs`
- `.github/workflows/ci.yml`
- `scripts/validate-postgres-schema.mjs`
- `deploy/nginx.conf`
- تست‌های Migration، Environment و رقابت پرداخت

## موارد فقط پیشنهادی و اجرا‌نشده

- افزودن Elasticsearch/Redis انجام نشد؛ نیاز اندازه‌گیری‌شده‌ای برای آن وجود نداشت.
- اطلاعات OEM، خودرو یا سازگاری جعلی تولید نشد.
- Provider واقعی پرداخت/نقشه/SMS فعال اعلام نشد.
- Background Location یا تماس امن Relay پیاده‌سازی/ادعا نشد.
- مهاجرت React Router Major بدون برنامه سازگاری انجام نشد.
