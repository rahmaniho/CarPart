# استقرار — کارپارت

## پیش‌نیازهای تولید

- Node.js 22 LTS، PostgreSQL 16 و Reverse Proxy دارای TLS
- Extension `uuid-ossp` (یا دسترسی Migration Role برای `CREATE EXTENSION`)؛ Runtime Role پس از Migration می‌تواند محدودتر باشد
- Secret Manager برای `JWT_*`، `DATA_ENCRYPTION_KEY`، `POSTGRES_PASSWORD` و کلید Providerها
- فضای پایدار/Object Storage برای فایل‌ها و برنامه Backup
- DNS و گواهی HTTPS پیش از فعال‌کردن پرداخت یا نشست واقعی

## Gate پیش از انتشار

```bash
npm ci --no-audit --no-fund
npm run build:contract
npm run build -w @carpart/api-client
npm run typecheck --workspaces --if-present
npm run lint
npm run check:postgres-schema
npm run test -w @carpart/api
npm run test -w @carpart/api-client
npm run test -w @carpart/mobile
npm run test -w @carpart/web
npm run build
npm run build -w @carpart/mobile
```

`check:postgres-schema` جای تست PostgreSQL واقعی نیست؛ Release Candidate باید یک بار روی PostgreSQL 16 در Staging نیز Migration و Smoke Test شود.

## تنظیمات اجباری Production

اعتبارسنجی Startup در Production موارد زیر را اجبار می‌کند:

- `DB_TYPE=postgres`
- `DB_SYNC=false`
- `POSTGRES_PASSWORD` حداقل ۱۲ نویسه و خارج از مخزن
- `SEED_DEMO_DATA=false`
- مستقل‌بودن `JWT_ACCESS_SECRET` و `JWT_REFRESH_SECRET`
- `DATA_ENCRYPTION_KEY` تصادفی و غیرپیش‌فرض
- نبود `*` در `CORS_ORIGINS`

برای تولید کلیدها:

```bash
openssl rand -hex 64  # JWT secret
openssl rand -hex 32  # DATA_ENCRYPTION_KEY
```

## انتشار پایگاه تازه

1. تصاویر/Artifact همان Commit را Build کنید.
2. PostgreSQL خالی بسازید و Backup policy را فعال کنید.
3. Migration را پیش از شروع Writerها اجرا کنید:

```bash
DB_TYPE=postgres DB_SYNC=false npm run db:migrate
```

4. API را بالا بیاورید و `/health` و `/health/ready` را بررسی کنید.
5. Smoke Test ورود، جست‌وجو، سفارش Sandbox و دسترسی نقش‌ها را اجرا کنید.
6. سپس ترافیک را به نسخه جدید منتقل کنید.

`docker compose up -d` همین جریان را با `DB_MIGRATIONS_RUN=true` برای پایگاه تازه اجرا می‌کند.

## ارتقای پایگاه موجود

Migration اولیه برای پایگاه خالی است. اگر محیطی قبلاً با `synchronize` ساخته شده:

1. Writerها را متوقف کنید.
2. Backup کامل بگیرید:

```bash
pg_dump --format=custom --file=carpart-before-upgrade.dump "$DATABASE_URL"
```

3. Restore را در یک پایگاه موقت واقعاً آزمایش کنید.
4. Schema محیط Clone را با Baseline و Entityهای Commit مقایسه کنید.
5. فقط با تأیید DBA، Baseline را در جدول `schema_migrations` ثبت کنید؛ آن را روی جدول‌های موجود اجرا نکنید.
6. Migrationهای بعدی را عادی اجرا و Smoke Test کنید.

## Rollback

- **قبل از ترافیک:** سرویس قبلی را نگه دارید و در صورت شکست Health/Smoke، Container جدید را حذف کنید.
- **Migration اولیه روی DB خالی:** `npm run db:migrate:revert` تمام جدول‌ها را حذف می‌کند؛ فقط برای پایگاه تازه بدون داده مجاز است.
- **پایگاه دارای داده:** Down Migration مخرب را اجرا نکنید. نسخه قبلی را Deploy و Backup تأییدشده را Restore کنید یا Forward Fix بسازید.
- فایل‌های `uploads/` باید همراه PostgreSQL و با نقطه زمانی سازگار Backup/Restore شوند.

## امنیت HTTP

Nginx هدرهای CSP، `frame-ancestors 'none'`، `object-src 'none'`، Permissions-Policy، Referrer-Policy و `nosniff` را اعمال می‌کند. API Swagger در `NODE_ENV=production` عمومی نمی‌شود. اگر مستندات عملیاتی لازم است، آن را پشت VPN یا احراز هویت سازمانی منتشر کنید.

## Providerهای بیرونی

- `PAYMENT_PROVIDER=sandbox` در Production آماده نیست و Provider صادقانه Refuse می‌کند. برای پرداخت واقعی، Zarinpal و Merchant ID باید در Staging و سپس Production تأیید شوند.
- `MAP_PROVIDER=mock` فقط تخمین است و Readiness را degraded می‌کند.
- SMS/Push/Email در حالت `mock` ارسال واقعی نیستند.
- کلید Providerها فقط Secret هستند؛ هیچ کلیدی نباید در Image یا Git قرار گیرد.

## وب و نشست

وب و API ترجیحاً هم‌مبدأ باشند تا Refresh Cookie با `SameSite=Strict` ارسال شود. `CORS_ORIGINS` باید فهرست دقیق Originها باشد. TLS termination باید `X-Forwarded-Proto` را تنظیم کند و Nginx آن را به API منتقل می‌کند.

## پایش و بازیابی

- مانیتور `/health` و `/health/ready`
- هشدار روی خطاهای Migration، `VERIFYING`های پرداخت قدیمی، Jobهای Failed و کاهش موجودی نامعتبر
- Backup روزانه PostgreSQL و فایل‌ها، نگهداری خارج از Host و آزمون دوره‌ای Restore
- نگهداری لاگ با `X-Request-Id` و بدون Payload محرمانه
