# معماری سامانه — کارپارت

## نمای کلی
```
[apps/mobile (PWA/Android)]   [apps/web (عمومی/فروشنده/مدیر)]
        │                              │
        └──────────┬───────────────────┘
                   │  (packages/api-client — REST تایپ‌شده)
                   ▼
        [apps/api — NestJS]  ── REST /api/v1 + Swagger
                   │
     ┌─────────────┼──────────────┬──────────────┐
     ▼             ▼              ▼              ▼
 [TypeORM]   [Job Queue]   [Providerها]   [Notifications]
 پایگاه‌داده   (درون‌پروسه)   پرداخت/نقشه/    درون‌برنامه‌ای +
 (sqljs/dev,  + cron jobs    SMS/Storage     SMS/Email mock
  postgres/prod)              (interface)
```

## اصول معماری
1. **منبع حقیقت فقط API است** — هیچ منطق قیمت/وضعیت در کلاینت اجرا نمی‌شود؛ کلاینت فقط نمایش می‌دهد.
2. **رابط‌های قابل تعویض (Adapter):** MapProvider، PaymentProvider، SmsProvider، EmailProvider، StorageProvider — همه interface + پیاده‌سازی mock/sandbox/واقعی. هیچ سرویس خارجی فرض نشده؛ پیکربندی از env می‌آید.
3. **ماشین حالت سفارش** در `@carpart/contract` تعریف شده (گذارها + نقش‌های مجاز + پیام فارسی) و سرور آن را اعمال می‌کند.
4. **گاردهای سراسری:** Throttler → JwtAuth → Roles → Permissions؛ رهگیرهای RequestContext و Audit؛ فیلتر خطای واحد (`ApiErrorBody` با پیام فارسی).
5. **کارهای زمان‌دار** (انقضای پیشنهاد/سفارش، پیشنهاد پیک، تسویه) با صف درون‌پروسه + cron (MaintenanceService) انجام می‌شود.

## جریان‌های اصلی
- **سفارش مستقیم:** جست‌وجو → `POST /orders` (قیمت از DB، رزرو موجودی) → پرداخت → `markPaid` (قطع موجودی + ردیف کمیسیون) → آماده‌سازی → مأموریت پیک → تحویل OTP → تکمیل
- **RFQ:** `POST /requests` (هدف‌گیری فروشندگان) → پیشنهادها → مقایسه با RankingService → پذیرش → سفارش + رد سایر پیشنهادها
- **ارسال:** READY_FOR_PICKUP → صف `delivery.create_from_order` → نزدیک‌ترین پیک واجد شرایط → مهلت پذیرش → تعویض → کد تحویل از فروشگاه + OTP مشتری

## لایه‌بندی کد
- `apps/api/src/modules/<domain>` — هر ماژول: controller / service / entities / dto
- `packages/contract` — قراردادهای مشترک (دو خروجی ESM+CJS)
- `packages/api-client` — کلاینت تایپ‌شده مشترک وب و موبایل
- `apps/mobile`, `apps/web` — فقط لایه نمایش + state سبک (Zustand/React Query)

## تصمیم‌های فنی کلیدی
- **TypeORM** به‌جای Prisma (دسترسی به باینری Prisma در محیط توسعه مسدود) + تولید ستون‌های nullable با `type` صریح
- **sqljs** برای توسعه/تست (بدون نیاز به سرویس خارجی) و **PostgreSQL** برای تولید (از طریق `DB_TYPE`)
- **پول integer (تومان)** با transformer ایمن؛ بدون float
- **کوکی رفرش `httpOnly` + SameSite=Strict** — توکن دسترسی در هدر Authorization (بدون ریسک CSRF)
