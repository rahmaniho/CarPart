# راهنمای استقرار عملیاتی (Deployment Guide)

## ۱. استقرار یکپارچه با Docker Compose (توصیه‌شده)

مخزن شامل `Dockerfile` چندمرحله‌ای (اهداف `api` و `web`) و فایل `docker-compose.yml` به همراه **PostgreSQL 16** و **Nginx** است.

### گام اول: تعریف متغیرهای محرمانه محیط عملیاتی
در ریشه پروژه یک فایل `.env` بسازید (هرگز مقادیر نمونه توسعه را در تولید استفاده نکنید):

```env
POSTGRES_USER=carpart
POSTGRES_PASSWORD=یک_رمز_تصادفی_قوی_پایگاه_داده
POSTGRES_DB=carpart

# حداقل ۳۲ نویسه تصادفی با آنتروپی بالا (مثلاً خروجی openssl rand -hex 32)
JWT_ACCESS_SECRET=replace_with_64_hex_chars_access_secret
JWT_REFRESH_SECRET=replace_with_64_hex_chars_refresh_secret
DATA_ENCRYPTION_KEY=replace_with_64_hex_chars_aes_gcm_key

CORS_ORIGINS=https://your-domain.ir
PAYMENT_PROVIDER=zarinpal
ZARINPAL_MERCHANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SMS_PROVIDER=kavenegar
KAVENEGAR_API_KEY=your_kavenegar_api_key
MAP_PROVIDER=osrm
OSRM_BASE_URL=https://router.project-osrm.org
```

### گام دوم: ساخت و اجرای سرویس‌ها
```bash
docker compose up -d --build
```

- سرویس وب و پروکسی معکوس Nginx روی پورت `8080` بالا می‌آید و مسیرهای `/api/` و `/health` را به سرویس داخلی `api:4000` هدایت می‌کند.
- نگهبان راه‌اندازی تولید (`Production Config Guard`) در `NODE_ENV=production` در صورت ضعیف بودن کلیدهای رمزنگاری یا فعال بودن `AUTH_EXPOSE_DEV_OTP=true` از بالا آمدن ناایمن سرویس جلوگیری می‌کند.

---

## ۲. اتصال آداپتورهای بیرونی در محیط واقعی

| زیرسیستم | مقدار توسعه | مقدار عملیاتی | متغیرهای موردنیاز |
|---|---|---|---|
| **پایگاه‌داده** | `DB_TYPE=sqljs` | `DB_TYPE=postgres` | `POSTGRES_HOST`، `POSTGRES_PORT`، `POSTGRES_USER`، `POSTGRES_PASSWORD`، `POSTGRES_DB` |
| **درگاه پرداخت** | `PAYMENT_PROVIDER=sandbox` | `PAYMENT_PROVIDER=zarinpal` | `ZARINPAL_MERCHANT_ID`، `PUBLIC_WEB_URL` |
| **پیامک** | `SMS_PROVIDER=mock` | `SMS_PROVIDER=kavenegar` | `SMS_API_KEY`، `SMS_SENDER` |
| **مسیریابی نقشه** | `MAP_PROVIDER=mock` | `MAP_PROVIDER=osrm` | `MAP_ROUTE_URL` |
