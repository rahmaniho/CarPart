# اپلیکیشن اندروید کارپارت — راهنمای کامل

این پوشه شامل یک **پروژه Android واقعی** (Capacitor) است که وب‌اپ موبایل (`src/`) را در
WebView بومی بسته‌بندی می‌کند. سه Flavor مستقل:

| Flavor | Application ID | نام اپ | رنگ برند |
|---|---|---|---|
| `mechanic` | `ir.carpart.app.mechanic` | کارپارت مکانیک | سبز فیروزه‌ای `#0F766E` |
| `courier` | `ir.carpart.app.courier` | کارپارت پیک | نارنجی `#C2410C` |
| `seller` | `ir.carpart.app.seller` | کارپارت تأمین‌کننده | بنفش `#6D28D9` |

هر سه APK از یک کدبیس ساخته می‌شوند و بر اساس نقش کاربر پوستهٔ درست را نشان می‌دهند.

## 🛡 پایداری (رفع کرش نسخه قبل)
- **Firebase placeholder** در `MainActivity`: بدون `google-services.json` هم اپ هرگز کرش نمی‌کند (ثبت Push شکست می‌خورد ولی اپ پایدار می‌ماند)
- دکمه بازگشت با **یک listener و cleanup** (تجمع listener باعث بسته شدن ناگهانی اپ می‌شد)
- هیچ تماس Push هنگام بالا آمدن اپ انجام نمی‌شود (فقط ۲.۵ ثانیه بعد از ورود کاربر)
- Service Worker در WebView اندروید غیرفعال است

## ✅ امکانات نیتیو این نسخه
- **اعلان فشاری (Push/FCM):** ثبت خودکار توکن دستگاه پس از ورود (`POST /notifications/device-tokens`)،
  حذف هنگام خروج؛ افزونه `@capacitor/push-notifications`
- **دکمه بازگشت سیستم‌عامل:** عقب در صفحات داخلی، خروج در صفحه ریشه (`@capacitor/app`)
- **نوار وضعیت برند + اسپلش** (`@capacitor/status-bar`, `@capacitor/splash-screen`)
- **موقعیت مکانی پیک** با `@capacitor/geolocation` (fallback مرورگر در وب) + مجوزهای `ACCESS_FINE_LOCATION`
- **آیکون‌های کامل:** legacy + آداپتیو (گرد/مربع) با نقش آچار و رنگ متمایز هر Flavor + اسپلش برند
- **نسخه‌بندی خودکار** از `package.json` ریشه (versionName/versionCode)
- **امضای release** از متغیرهای محیطی (`CARPART_KEYSTORE_*`) — بدون آن‌ها release با کلید debug امضا می‌شود
- مجوزها: INTERNET، ACCESS_NETWORK_STATE، دسترسی موقعیت، POST_NOTIFICATIONS (اندروید ۱۳+)

## ساخت APK — دو راه

### ۱) GitHub Actions (پیشنهادی — بدون نیاز به SDK محلی)
Workflow `.github/workflows/android.yml` در هر PR/push هر سه APK را می‌سازد و به‌صورت
**آرتیفکت** (`carpart-android-apks`) بارگذاری می‌کند. دانلود:
```bash
gh run download --name carpart-android-apks
```

### ۲) محلی
پیش‌نیاز: **JDK 21** + **Android SDK** (compileSdk 35) + Gradle (wrapper موجود است)
```bash
./scripts/build-android.sh
# یا مستقیم:
cd apps/mobile && npm run build && npx cap sync android && cd android
./gradlew assembleMechanicDebug assembleCourierDebug assembleSellerDebug
```
خروجی: `android/app/build/outputs/apk/{mechanic,courier}/debug/`

نسخه انتشار (با keystore):
```bash
CARPART_KEYSTORE_FILE=/path/release.jks CARPART_KEYSTORE_PASSWORD=... CARPART_KEY_ALIAS=... CARPART_KEY_PASSWORD=... \
  ./gradlew assembleMechanicRelease assembleCourierRelease assembleSellerRelease
```

## اعلان فشاری واقعی (FCM)
1. در Firebase Console پروژه بسازید و `google-services.json` را در `android/app/` قرار دهید
2. کلید سرور FCM را در `FCM_SERVER_KEY` سرویس API تنظیم کنید (`PUSH_PROVIDER=fcm`)
3. بدون این‌ها، اعلان‌ها صادقانه **شبیه‌سازی‌شده** (`isSimulated: true`) ثبت می‌شوند

## نکات مهم استقرار
1. **نشانی API:** تمدید نشست با کوکی `httpOnly` + `SameSite=Strict` است؛ `server.url` در
   `capacitor.config.ts` باید به همان میزبان وب‌اپ اشاره کند (هم‌منبع) — مثلاً
   `https://app.carpart.ir` که `/api` را پراکسی می‌کند.
2. **CORS:** اگر API روی دامنهٔ دیگری است، مبدأ WebView (`https://localhost`) را به `CORS_ORIGINS` اضافه کنید.
3. **آیکون‌ها:** نشان هندسی فعلی جایگزین‌پذیر است؛ پیش از انتشار در کافه‌بازار/مایکت با طراحی نهایی عوض شود.

## تنظیم نشانی API در APK

APK یک وب‌اپ بسته‌بندی‌شده است و **بک‌اند داخل APK نیست**. در اولین اجرای نسخه نیتیو،
صفحه ورود بخش «تنظیم نشانی سرور» را نشان می‌دهد. نشانی عمومی HTTPS استقرار API را وارد کنید:

```text
https://api.example.ir
```

اپ به‌صورت خودکار `/api/v1` را اضافه می‌کند. این مقدار در `localStorage` نگهداری و با
«تنظیم نشانی سرور» در صفحه ورود قابل تغییر است. برای build سازمانی می‌توان آن را از قبل تنظیم کرد:

```bash
VITE_API_BASE_URL=https://api.example.ir/api/v1 npm run build -w @carpart/mobile
```

برای امنیت و کارکرد نشست:
- API باید HTTPS معتبر داشته باشد.
- `CORS_ORIGINS` سرور باید مبدأ WebView را مجاز کند.
- کلاینت Android هدر `X-Client-Platform: android` می‌فرستد؛ سرور refresh token چرخشی
  را فقط برای کلاینت‌های native در body برمی‌گرداند. وب همچنان فقط cookie httpOnly می‌گیرد.
