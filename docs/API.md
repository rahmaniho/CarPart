# مرجع REST API — کارپارت

- پایه: `/api/v1` — همه پاسخ‌ها JSON با پیام فارسی
- مستندات زنده: `GET /api/docs` (Swagger)
- سلامت: `GET /health`, `GET /health/ready`

## قرارداد خطا — `ApiErrorBody`
```json
{ "statusCode": 400, "code": "VALIDATION_FAILED", "message": "…", "faMessage": "…",
  "errors": [{ "field": "mobile", "message": "…" }], "requestId": "…", "timestamp": "…", "retryable": false }
```
کدهای ماشین‌خوان: `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `FORBIDDEN`, `VALIDATION_FAILED`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INSUFFICIENT_STOCK`, `ORDER_TRANSITION_FORBIDDEN`, `PAYMENT_*`, `COUPON_*`, `DELIVERY_*`, `ACCOUNT_NOT_VERIFIED`, …

## احراز هویت
| متد | مسیر | توضیح |
|---|---|---|
| POST | `/auth/register` | ثبت‌نام (mechanic/seller/courier) + OTP |
| POST | `/auth/otp/request` | درخواست کد (در توسعه: `devCode`) |
| POST | `/auth/otp/verify` | تأیید کد → accessToken |
| POST | `/auth/login` | ورود با رمز عبور |
| POST | `/auth/refresh` | تمدید نشست (کوکی httpOnly) |
| POST | `/auth/logout` | خروج |
| GET | `/auth/me` | کاربر جاری |

هدر `Authorization: Bearer <token>`؛ عملیات حساس هدر `Idempotency-Key` می‌پذیرند.

## کاتالوگ (عمومی)
`GET /catalog/search` (q/vehicleId/city/sort)، `GET /catalog/parts[/:id]`، `GET /catalog/categories|brands|vehicle-makes|vehicle-models|vehicle-variants`

## سفارش (مکانیک)
`GET/POST /orders`، `GET /orders/:id`، `GET /orders/:id/events`، `POST /orders/:id/checkout|transition|cancel`، `GET /orders/:orderId/tracking`

## درخواست تأمین (RFQ)
`GET/POST /requests`، `GET /requests/:id`، `GET /requests/:id/quotes` (مقایسه رتبه‌بندی‌شده)، `POST /requests/quotes/:quoteId/accept`، `POST /requests/:id/cancel`

## پرداخت
`POST /payments`، `POST /payments/verify` (**تنها مسیر تأیید**)، `POST /payments/sandbox/confirm` (فقط غیرتولید)، `GET /payments/readiness`، `POST /payments/refunds`، `GET /payments/refunds/mine`

## فروشنده
`GET/PUT /sellers/me`، `POST /sellers/me/submit-review`، `GET/POST/PATCH /sellers/me/branches`، `GET/POST/PATCH /sellers/me/products` (+ `/price` `/stock` `/active`)، `GET /sellers/me/dashboard`
سفارش‌ها: `GET /seller/orders[/:id]`، `POST /seller/orders/:id/transition`
RFQ: `GET /seller/requests`، `POST /seller/requests/:id/quotes`، `GET /seller/quotes`، `POST /seller/quotes/:id/withdraw`
مالی: `GET /seller/finance/summary|commission-rate|commissions|payouts`

## پیک
`GET/PUT /couriers/me`، `POST /couriers/me/availability|location`، `GET /couriers/me/dashboard`
مأموریت: `GET /courier/deliveries?status=offers|active|history`، `POST /courier/deliveries/:id/accept|reject|pickup|transit|deliver|fail`

## مدیریت
`GET /admin/dashboard`، `GET /admin/reports/daily|top-sellers`، `GET /admin/verifications/:kind` + `approve|reject|suspend`، `GET/PATCH /admin/users[/:id]`، `GET /admin/orders`، `GET /admin/deliveries`، `GET/PATCH /admin/settings`، `GET /admin/audit`

## اعلان‌ها و پشتیبانی
`GET /notifications`، `POST /notifications/:id/read`، `POST /notifications/read-all`
`GET/POST /support/tickets`، `POST /payments/refunds` (درخواست مرجوعی)، `GET /payments/refunds/mine`

## نکات
- همه پارامترهای پول به **تومان (integer)**‌اند.
- فیلدهای ناشناخته در بدنه با `VALIDATION_FAILED` رد می‌شوند (محافظ قیمت/وضعیت).
- محدودسازی نرخ: پاسخ ۴۲۹ با کد `RATE_LIMITED` و هدر `Retry-After`.
