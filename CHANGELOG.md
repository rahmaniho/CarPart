# تغییرات کارپارت

تمام تغییرات مهم محصول در این فایل ثبت می‌شوند. نسخه‌بندی بر اساس Semantic Versioning است.

## [1.3.0] — ۱۴۰۵/۰۷/۲۹

### لندینگ و انتشار
- لندینگ معرفی کامل و واکنش‌گرا با Hero تبلیغاتی، راهکارهای سه نقش، امکانات، مراحل کار، دانلود Android، FAQ و CTA
- استفاده از لوگوهای رسمی و بهینه‌شده در تصاویر معرفی و متادیتای اشتراک‌گذاری
- SEO فارسی، Open Graph، favicon و ساختار معنایی/دسترس‌پذیر
- Lazy loading تمام Routeهای وب؛ جداسازی نمودارها و پنل‌ها از Bundle اولیهٔ لندینگ
- اصلاح قطعی نگاشت لوگوی فروشنده و پیک در Android، Splash و PWA
- انتشار خودکار لندینگ روی GitHub Pages با Base Path پروژه، fallback مسیرهای SPA و حالت معرفی بدون API

## [1.2.1] — ۱۴۰۵/۰۷/۲۹

### هویت بصری نقش‌ها
- جایگزینی لوگوی رسمی ارسالی کاربر برای مکانیک/خریدار، فروشنده و پیک
- تولید آیکن‌های Android در پنج density برای legacy، round و adaptive icon
- تولید Splash اختصاصی هر Flavor با حفظ نسبت تصویر و safe area
- افزودن تصاویر WebP کم‌حجم به Hero صفحهٔ هر نقش و آیکن میانبرهای PWA
- حذف هوشمند حاشیهٔ سفید منبع و استفاده از شفافیت واقعی در launcher icon

## [1.2.0] — ۱۴۰۵/۰۷/۲۹

### تجربه و طراحی
- Design System نقش‌محور جدید با رابط RTL، سطح‌های شیشه‌ای، safe-area و کنتراست دسترس‌پذیر
- گرافیک برداری سبک و اختصاصی برای داشبورد مکانیک و فروشنده؛ بدون افزایش زمان شبکه
- هویت رنگی مستقل مکانیک، فروشنده، پیک و مدیریت و آیکن/Splash مستقل Android
- نمایش وضعیت آفلاین، focus-visible، skip-link و رعایت `prefers-reduced-motion`

### سرعت و PWA
- بارگذاری تنبل تمام صفحات و جداسازی chunkهای React Query، React Router و Capacitor
- هدف build مدرن ES2022، CSS code splitting و حذف polyfill غیرضروری module preload
- Service Worker نسخه‌دار با navigation از نوع network-first برای جلوگیری از ناسازگاری HTML و chunk قدیمی
- Manifest کامل نصب‌شونده با میانبر مستقل برای هر چهار نقش

### مدیریت موبایل
- Flavor چهارم Android با شناسه `ir.carpart.app.admin`
- داشبورد زنده، مدیریت کاربران، صف تأیید فروشنده/پیک/تعمیرگاه و مرکز عملیات پشتیبانی/بازپرداخت/سفارش
- مجوزهای نقش در کلاینت و کنترل دسترسی نهایی در API؛ ثبت عملیات حساس در audit موجود سامانه
- پشتیبانی Push از Flavorهای فروشنده و مدیریت در تمام لایه‌های typed client و API

### انتشار
- نسخه هماهنگ workspaceها: `1.2.0`
- ساخت چهـار APK مستقل در CI و انتشار برنامه‌ریزی‌شده در Release `android-v1.2.0`
- ساخت release واقعی همچنان نیازمند keystore مالک محصول از طریق `CARPART_KEYSTORE_*` است؛ هیچ کلید یا راز در مخزن قرار ندارد

## [1.1.0] — ۱۴۰۵/۰۷/۲۸

### پایداری اندروید
- Firebase-safe startup بدون نیاز اجباری به `google-services.json`
- فقط یک listener دکمه بازگشت همراه cleanup
- Push فقط پس از ورود و با تأخیر امن؛ Service Worker در WebView غیرفعال
- ذخیره crash report نیتیو و نمایش/کپی در اجرای بعد
- overlay خطای JavaScript به‌جای صفحه سفید
- راهنمای تنظیم API عمومی HTTPS در اولین اجرا
- نشست نیتیو با refresh token چرخشی در body؛ وب همچنان cookie-only

### قابلیت‌ها
- اپ کامل فروشنده در Android و وب
- تکمیل خرید، رهگیری، نظر، بازپرداخت و پشتیبانی مکانیک
- مکان زنده foreground و مسیریابی پیک
- گسترش مدیریت وب برای بازپرداخت، تسویه، کوپن، اطلاعیه، پشتیبانی و مرجوعی
- سه APK در GitHub Actions و Release `android-v1.1.0`

## [1.0.0] — ۱۴۰۵/۰۷/۲۸

### افزوده‌شده
- Backend ماژولار NestJS و TypeORM برای احراز هویت، کاتالوگ، سفارش، استعلام، پرداخت، ارسال، مالی، اعلان، مدیریت و پشتیبانی
- وب عمومی، پنل فروشنده، پنل مدیریت و اپ‌های مکانیک/پیک
- قرارداد و API client مشترک TypeScript
- Docker، CI، تست‌ها و مستندات استقرار/امنیت

[1.3.0]: https://github.com/rahmaniho/CarPart/releases/tag/android-v1.3.0
[1.2.1]: https://github.com/rahmaniho/CarPart/releases/tag/android-v1.2.1
[1.2.0]: https://github.com/rahmaniho/CarPart/releases/tag/android-v1.2.0
[1.1.0]: https://github.com/rahmaniho/CarPart/releases/tag/android-v1.1.0
[1.0.0]: https://github.com/rahmaniho/CarPart/releases/tag/v1.0.0
