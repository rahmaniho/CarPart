# استقرار — کارپارت

## پیش‌نیازهای تولید
- Node.js ≥ 20.11، PostgreSQL 16، (اختیاری) reverse proxy مانند Nginx
- متغیرهای محیطی حساس (`JWT_*`, `DATA_ENCRYPTION_KEY`, `POSTGRES_PASSWORD`, …) فقط از secret manager — **هرگز در مخزن**

## با Docker (پیشنهادی)
```bash
docker compose up -d          # postgres + api + web
```
- `docker-compose.yml` در ریشه + Dockerfileها در `deploy/`
- وب با Nginx سرو می‌شود و `/api` را به سرویس API پراکسی می‌کند (هم‌منبع → کوکی رفرش SameSite=Strict کار می‌کند)

## بدون Docker
```bash
# پایگاه‌داده
createdb carpart
# API
cd apps/api && npm ci && npm run build
DB_TYPE=postgres POSTGRES_HOST=… node dist/main.js
# وب
cd apps/web && npm ci && npm run build   # سرو dist با nginx
```

## نکات حیاتی
1. **هم‌منبع بودن وب و API** (یا زیر یک دامنه): کوکی رفرش `SameSite=Strict` در درخواست بین‌سایتی ارسال نمی‌شود. در اندروید، `server.url` در `capacitor.config.ts` باید به همان میزبان وب‌اپ اشاره کند (ANDROID.md).
2. **CORS_ORIGINS** باید دقیقاً مبدأهای مجاز را شامل شود.
3. **مهاجرت پایگاه‌داده:** پیش از تولید، baseline مهاجرت Postgres تولید/نگهداری شود (`npm run db:migrate`).
4. **CSP:** در `main.ts` عمداً غیرفعال است (توسعه)؛ در استقرار با Nginx سخت‌سازی شود.
5. **درگاه پرداخت:** برای تراکنش واقعی `PAYMENT_PROVIDER=zarinpal` + `ZARINPAL_MERCHANT_ID`؛ بدون merchant id سرویس صادقانه refuse می‌کند.
6. **نقشه:** `MAP_PROVIDER=neshan|osrm` + کلید از env؛ حالت `mock` فقط تخمینی است و در `/health/ready` وضعیت `degraded` نشان می‌دهد.
7. **پشتیبان‌گیری:** روزانه از PostgreSQL + پوشه `uploads/`.

## اندروید
مطابق [apps/mobile/ANDROID.md](../apps/mobile/ANDROID.md): دو Flavor (`mechanic`/`courier`)، ساخت با `./gradlew assemble<Mechanic|Courier>Debug`.
