# کارپارت — بازار هوشمند قطعات یدکی خودرو

پلتفرم فارسی (راست‌به‌چپ) تأمین و ارسال سریع قطعات یدکی خودرو برای ایران که **مکانیک‌ها/تعمیرگاه‌ها**،
**فروشندگان قطعه**، **پیک‌ها** و **مدیریت پلتفرم** را به هم متصل می‌کند.

> وضعیت عملیاتی/آزمایشی هر بخش به‌صورت شفاف در [docs/STATUS.md](docs/STATUS.md) ثبت شده است.
> مبالغ همه‌جا به **تومان** و به‌صورت عدد صحیح نگهداری می‌شود. زمان‌های ارسال **تخمینی**‌اند و تضمین نمی‌شوند.

## اجزای سامانه

| بخش | مسیر | توضیح |
|---|---|---|
| API بک‌اند | `apps/api` | NestJS + TypeORM — منبع حقیقت (سفارش، پرداخت، ارسال، اعلان، مالی) |
| اپ موبایل (مکانیک/پیک) | `apps/mobile` | React + Vite PWA + پروژهٔ Android (Capacitor) با دو Flavor |
| وب (عمومی + پنل فروشنده + پنل مدیریت) | `apps/web` | React + Vite — صفحات عمومی، `/seller`، `/admin` |
| کلاینت REST مشترک | `packages/api-client` | تایپ‌شده، مدیریت خطا/نشست مشترک |
| قرارداد مشترک | `packages/contract` | نقش‌ها، وضعیت‌ها، ماشین حالت سفارش، پول، تقویم جلالی |

## راه‌اندازی سریع

```bash
npm install
npm run build:contract          # بیلد قرارداد مشترک
npm run build -w @carpart/api-client
npm run build -w @carpart/api   # بیلد API
npm run dev:api                 # API روی http://localhost:4000/api/v1

npm run dev -w @carpart/web     # وب روی http://localhost:5173
npm run dev -w @carpart/mobile  # موبایل روی http://localhost:5174
```

- مستندات زنده Swagger: `http://localhost:4000/api/docs`
- سلامت سرویس: `http://localhost:4000/health` و `/health/ready`
- دادهٔ نمونه (در حالت توسعه) با `SEED_DEMO_DATA=true` هنگام بالا آمدن API ساخته می‌شود.

### حساب‌های نمونهٔ توسعه (فقط محیط توسعه)

| نقش | موبایل | رمز |
|---|---|---|
| مدیر | 09120000000 | `SEED_ADMIN_PASSWORD` (پیش‌فرض: ChangeMe!12345) |
| اپراتور | 09120000001 | CarPart!12345 |
| مکانیک | 09121110001 | CarPart!12345 |
| فروشنده | 09122220001 | CarPart!12345 |
| پیک | 09123330001 | CarPart!12345 |

در محیط توسعه (`AUTH_EXPOSE_DEV_OTP=true`) کد یکبارمصرف در پاسخ API برمی‌گردد؛ در استقرار واقعی فقط از طریق پیامک ارسال می‌شود.

## تست‌ها

```bash
npm run test -w @carpart/api          # تست‌های واحد + سرتاسری API (Jest)
npm run test -w @carpart/api-client   # تست‌های کلاینت (Vitest)
npm run test -w @carpart/mobile       # تست‌های موبایل (Vitest + Testing Library)
npm run test -w @carpart/web          # تست‌های وب (Vitest + Testing Library)
python3 scripts/smoke_e2e.py          # آزمون دود روی سرور در حال اجرا
```

## استقرار

- Docker: `docker-compose.yml` ریشه + تنظیمات `deploy/` (راهنما: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))
- لندینگ GitHub Pages: [docs/GITHUB_PAGES.md](docs/GITHUB_PAGES.md)
- اندروید: [apps/mobile/ANDROID.md](apps/mobile/ANDROID.md)

## مستندات

| سند | موضوع |
|---|---|
| [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) | نیازمندی‌های محصول |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | معماری و جریان داده |
| [docs/DATABASE.md](docs/DATABASE.md) | مدل پایگاه‌داده |
| [docs/API.md](docs/API.md) | مرجع REST API |
| [docs/LIVE_COURIER_TRACKING.md](docs/LIVE_COURIER_TRACKING.md) | ردیابی GPS پیک، Geofence، اعلان و محدودیت پس‌زمینه |
| [docs/USER_FLOWS.md](docs/USER_FLOWS.md) | جریان‌های کاربری |
| [docs/SECURITY.md](docs/SECURITY.md) | ملاحظات امنیتی |
| [docs/TESTING.md](docs/TESTING.md) | راهبرد و پوشش آزمون |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | استقرار |
| [docs/ROADMAP.md](docs/ROADMAP.md) | نقشه راه نسخه‌های بعدی |
| [docs/STATUS.md](docs/STATUS.md) | گزارش وضعیت: عملیاتی/آزمایشی/ناقص |
