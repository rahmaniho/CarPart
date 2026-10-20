# ساخت اپلیکیشن اندروید کارپارت

این پوشه شامل یک **پروژه Android واقعی** (تولیدشده با Capacitor) است که همان وب‌اپ موبایل
(`src/`) را در یک WebView بومی بسته‌بندی می‌کند. دو Flavor مستقل تعریف شده است:

| Flavor | Application ID | نام اپ |
|---|---|---|
| `mechanic` | `ir.carpart.app.mechanic` | کارپارت مکانیک |
| `courier` | `ir.carpart.app.courier` | کارپارت پیک |

هر دو APK از یک کدبیس ساخته می‌شوند و بر اساس نقش کاربر (مکانیک/پیک) پوستهٔ درست را نشان می‌دهند.

## پیش‌نیازهای ساخت APK (خارج از این مخزن/محیط CI سبک)

- JDK 17
- Android SDK (compileSdk 35) + Android Build Tools
- Gradle 8 (اسکریپت `gradlew` داخل پوشه android هست)

> ⚠️ این مخزن/محیط فعلی Android SDK و Java ندارد؛ بنابراین **کامپایل APK اینجا انجام نشده**
> و صرفاً پروژهٔ قابل‌ساخت تحویل داده شده است. کامپایل روی هر سیستمی با پیش‌نیازهای فوق انجام‌پذیر است.

## دستورهای ساخت

```bash
cd apps/mobile
npm run build          # بیلد وب (dist)
npm run android:sync   # همگام‌سازی دارایی‌ها در پروژه اندروید
cd android

# اپ مکانیک
./gradlew assembleMechanicDebug     # خروجی: app/build/outputs/apk/mechanic/debug/
./gradlew assembleMechanicRelease   # نسخه انتشار (نیاز به امضای release)

# اپ پیک
./gradlew assembleCourierDebug
./gradlew assembleCourierRelease
```

## نکات مهم استقرار

1. **نشانی API**: در `capacitor.config.ts` گزینه `server.url` برای انتشار باید به همان
   میزبانی اشاره کند که وب‌اپ را سرو می‌کند (هم‌منبع با API یا زیر یک دامنه مشترک)،
   چون تمدید نشست با کوکی `httpOnly` با `SameSite=Strict` انجام می‌شود و در درخواست
   بین‌سایتی ارسال نمی‌شود. راه‌حل پیشنهادی: سرو `dist/` از خود سرویس API پشت یک
   دامنه (مثلاً `https://app.carpart.ir` که `/api` را به API پراکسی می‌کند).
2. **CORS**: اگر API روی دامنهٔ دیگری باشد، `CORS_ORIGINS` سرویس API باید مبدأ WebView
   (`https://localhost` در اندروید) را شامل شود؛ پیکربندی مشترک `server.url` این نیاز را حذف می‌کند.
3. **آیکون‌ها**: آیکون‌های فعلی هندسی و موقت‌اند (`public/icons/`)؛ پیش از انتشار در
   کافه‌بازار/مایکت با طراحی نهایی جایگزین شوند.
4. **اعلان Push**: هنوز پیاده‌سازی نشده (نیاز به Firebase/FCM)؛ اعلان‌ها درون‌برنامه‌ای هستند.
5. **موقعیت مکانی پیک**: از Geolocation مرورگر/WebView استفاده می‌شود؛ برای انتشار،
   دسترسی `ACCESS_FINE_LOCATION` در فایل manifest بررسی شود (Capacitor آن را با افزونه
   Geolocation اضافه می‌کند یا دستی افزوده می‌شود).
