# معماری سامانه (System Architecture)

## ۱. نمای کلی معماری Monorepo

سامانه قطعه‌رسان بر پایه معماری **Modular Monolith آماده مقیاس‌پذیری افقی** در قالب npm workspaces پیاده‌سازی شده است:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        @carpart/contract                                │
│  نقش‌ها و مجوزها • وضعیت‌ها و گذارهای مجاز • تومان صحیح • جلالی • فارسی │
└───────────────────▲─────────────────────────────────▲───────────────────┘
                    │                                 │
      ┌─────────────┴─────────────┐     ┌─────────────┴─────────────┐
      │     apps/api (NestJS)     │     │    apps/web (React SPA)   │
      │  ۱۸ ماژول دامنه مستقل     │◄────┤  TanStack Query + Zustand │
      │  TypeORM + Guard + Audit  │ HTTP│  Tailwind RTL + Vazirmatn │
      └─────────────┬─────────────┘     └───────────────────────────┘
                    │
    ┌───────────────┼────────────────┬────────────────┬──────────────┐
    ▼               ▼                ▼                ▼              ▼
PostgreSQL /    Payment          SMS / Email      Routing / Geo   Storage
SQLite          Adapter          Adapter          Adapter         Adapter
                (Sandbox/Zarin)  (Mock/Kavenegar) (Mock/OSRM)     (Local/S3)
```

---

## ۲. اصول طراحی بک‌اند (`apps/api`)

1. **معماری ماژولار NestJS**: هر دامنه تجاری (`auth`، `users`، `workshops`، `sellers`، `couriers`، `catalog`، `requests`، `orders`، `payments`، `delivery`، `finance`، `coupons`، `reviews`، `support`، `notifications`، `settings`، `audit`، `admin`) در ماژول مستقل خود قرار دارد.
2. **الگوی Port & Adapter برای تمام وابستگی‌های بیرونی**:
   - **پرداخت (`PAYMENT_PROVIDER`)**: پیاده‌سازی کامل `SandboxPaymentProvider` (با تأیید سمت سرور و پشتیبانی کامل بازپرداخت) + اسکلت آماده `Zarinpal`.
   - **پیامک (`SMS_PROVIDER`)**: پیاده‌سازی `MockSmsProvider` با ثبت شفاف برچسب `isSimulated: true` + آداپتور `Kavenegar`.
   - **نقشه و مسیریابی (`MAP_PROVIDER`)**: محاسبه‌گر دقیق هندسی شهری (`Haversine × ضریب معابر شهری`) با برچسب صادقانه `estimation` + آداپتور `OSRM`.
   - **ذخیره‌سازی فایل (`STORAGE_PROVIDER`)**: ذخیره‌سازی محلی امن با بررسی امضای بایت (`Magic Bytes`) و نام‌گذاری تصادفی UUID.
3. **بدون حالت بودن پردازش‌ها (Stateless API)**: نشست‌ها در جدول `auth_sessions` با توکن رفرش چرخشی هش‌شده (`SHA-256`) نگهداری می‌شوند و کلیدهای یکتاسازی در جدول `idempotency_records` ذخیره می‌گردند.

---

## ۳. معماری فرانت‌اند (`apps/web`)

1. **عدم وجود منطق جعلی در کلاینت**: هیچ محاسبه مالی، تغییر وضعیت غیرمجاز یا تأیید پرداختی در حافظه مرورگر جعل نمی‌شود؛ همه عملیات از مسیر `/api/v1/*` عبور می‌کنند.
2. **مدیریت خودکار نشست امنیتی (`src/lib/api-client.ts`)**: توکن دسترسی کوتاه‌مدت در حافظه جاوااسکریپت نگهداری می‌شود (ایمن در برابر سرقت از `localStorage`) و در صورت دریافت `401`، درخواست `/api/v1/auth/refresh` به صورت Single-Flight با کوکی `httpOnly` اجرا شده و درخواست اصلی تکرار می‌شود.
3. **بومی‌سازی کامل فارسی و RTL**: فونت محلی `Vazirmatn` بدون وابستگی به CDN خارجی باندل شده و کلیه تاریخ‌ها با تقویم شمسی جلالی نمایش داده می‌شوند.
