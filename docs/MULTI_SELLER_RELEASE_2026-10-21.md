# یادداشت انتشار سفارش چندفروشنده‌ای — ۲۰۲۶-۱۰-۲۱

## دامنهٔ پیاده‌سازی‌شده

- خرید مستقیم از چند فروشنده/شعبه، با یک سفارش `parent` برای پرداخت مشتری و یک سفارش `child` برای هر مرز فروشنده/شعبه.
- قیمت هر قلم فقط از پایگاه‌داده خوانده می‌شود. قیمت و فعال‌بودن محصول هنگام Update رزرو نیز شرط می‌شوند تا تغییر هم‌زمان قیمت پذیرفته نشود.
- ایجاد Parent، Childها، Itemها، رزروها، Inventory Movementها و رویدادهای اولیه در یک Transaction انجام می‌شود؛ شکست هر خط همهٔ عملیات را Rollback می‌کند.
- هزینهٔ ارسال، زمان آماده‌سازی و کمیسیون هر Child جداگانه محاسبه و Parent فقط مجموع حساب‌شدهٔ آن‌هاست.
- یک Payment فقط به Parent متصل است. پس از Verify موفق، اثر پرداخت به Childها به‌شکل Idempotent Reconcile می‌شود؛ Stock Commit و Commission فقط برای Child ثبت می‌شوند.
- انقضای Parent پرداخت‌نشده همهٔ Childها را لغو و رزروها را آزاد می‌کند.
- Delivery فقط برای Child مجاز است. فروشنده فقط Child متعلق به خود را می‌بیند و به Parent فروشندگان دیگر دسترسی ندارد.
- بازپرداخت کامل Parent، کمیسیون Childها را معکوس می‌کند. اجرای Refund جزئی عمداً رد می‌شود تا بدون تخصیص قلم/فروشنده دفتر مالی نادرست ساخته نشود.

## محدودیت‌های صریح

وضعیت این قابلیت **PARTIAL** است، نه تکمیل کامل محصول:

1. پیش‌نویس و Coupon چندفروشنده‌ای غیرفعال است؛ سیاست تخصیص تخفیف هنوز تعریف نشده است.
2. لغو یک Child/Item پس از پرداخت و محاسبهٔ سهم هزینهٔ ارسال، تخفیف و کارمزد پیاده‌سازی نشده است.
3. Refund جزئی تا ایجاد Refund Allocation/Ledger غیرقابل اجراست.
4. وضعیت Parent پس از پرداخت، وضعیت مالی را نشان می‌دهد؛ پیشرفت ارسال از `packages[].status` خوانده می‌شود و هنوز وضعیت تجمیعی «بخشی تحویل شد» وجود ندارد.
5. مسیر Quote/RFQ همچنان تک‌فروشنده‌ای است.

## Migration و سازگاری

Migration افزایشی `1792540800000-MultiSellerOrderHierarchy`:

- `sellerId` و `branchId` را nullable می‌کند؛ Check Constraint فقط Parent را بدون این دو مقدار می‌پذیرد.
- `orderKind` با مقدار پیش‌فرض `single` اضافه می‌کند؛ تمام داده‌های قبلی بدون Backfill مخرب سازگار می‌مانند.
- FK خودارجاع `parentOrderId` با `ON DELETE RESTRICT` و Indexهای نوع/Parent اضافه می‌کند.
- Down روی دیتابیس بدون Parent قابل اجراست. PostgreSQL در صورت وجود Parent اجازهٔ بازگرداندن NOT NULL را نمی‌دهد؛ این Guard از حذف ضمنی سوابق مالی جلوگیری می‌کند.

## ترتیب استقرار

1. Snapshot و Backup قابل‌بازیابی بگیرید و Restore را در محیط جداگانه آزمایش کنید.
2. نسخهٔ فعلی را متوقف یا Writeها را Drain کنید.
3. `npm ci` و سپس `npm run typecheck && npm run lint && npm run check:contract && npm run check:postgres-schema`.
4. `npm run db:migrate` روی PostgreSQL 16 در Staging، سپس Smoke خرید تک/چندفروشنده‌ای و Refund کامل.
5. API را پیش از Client جدید منتشر کنید؛ پاسخ‌های تک‌فروشنده‌ای سازگار باقی مانده‌اند و فیلدهای جدید افزایشی‌اند.
6. Metrics خطاهای `STOCK_CONFLICT`، Payment Verify، Childهای `WAITING_FOR_PAYMENT` زیر Parent موفق، و Commissionهای مفقود را پایش کنید.

## Rollback

- پیش از ایجاد اولین Parent می‌توان Migration را با `npm run db:migrate:revert` برگرداند.
- پس از ثبت Parent، Rollback کد به نسخهٔ قبلی امن نیست، چون نسخهٔ قبلی Parent بدون seller را نمی‌شناسد. ابتدا ترافیک ایجاد سفارش را متوقف کنید و نسخهٔ اصلاحی Forward بسازید.
- سوابق مالی Parent/Child نباید برای عبور از `SET NOT NULL` حذف شوند. بازیابی Snapshot فقط در رخداد Disaster Recovery و با تأیید مالک داده انجام شود.

## شواهد محلی

- Migration روی PostgreSQL-compatible pg-mem: Up، درج Parent مطابق Constraint و Down دو مرحله‌ای.
- E2E: ساخت Parent/Child، Idempotency، Rollback رزرو چندفروشنده‌ای، انقضا/Release و Payment Fan-out/Commission.
- PostgreSQL 16 واقعی، Provider واقعی، Docker و Restore در این محیط اجرا نشده‌اند و Gate استقرار باقی می‌مانند.
