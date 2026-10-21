# مدل پایگاه‌داده — کارپارت

موتور: **sql.js** برای توسعه/تست و **PostgreSQL 16** برای تولید، از طریق TypeORM. شناسه موجودیت‌ها UUID و مبلغ‌ها integer تومان هستند.

## موجودیت‌های اصلی

Baseline فعلی از **۴۸ Entity دامنه** تشکیل شده است؛ جدول `schema_migrations` نیز توسط TypeORM مدیریت می‌شود.

### حساب و پروفایل
| جدول | نقش |
|---|---|
| `users` | کاربران، نقش‌ها، رمز scrypt و موبایل یکتا |
| `user_sessions` | نشست‌های Refresh با چرخش و ابطال در استفاده مجدد |
| `otp_codes` | کدهای یک‌بارمصرف، انقضا و تعداد تلاش |
| `workshops`, `workshop_addresses`, `vehicles` | تعمیرگاه، نشانی و خودروهای مکانیک |
| `sellers`, `seller_branches` | فروشنده و شعبه‌ها |
| `courier_profiles`, `courier_locations` | پیک و نمونه‌های موقعیت مأموریت |

### کاتالوگ و موجودی
| جدول | نقش |
|---|---|
| `parts`, `part_categories`, `part_brands` | اطلاعات عمومی قطعه، دسته و برند |
| `vehicle_makes`, `vehicle_models`, `vehicle_variants` | کاتالوگ خودرو |
| `part_compatibilities` | سازگاری مستندشده قطعه و خودرو |
| `seller_products` | قیمت، موجودی، رزرو، کیفیت و زمان آماده‌سازی هر فروشنده |
| `inventory_movements` | دفتر تغییرات موجودی با دلیل، بازیگر و `orderId` مرتبط |

### سفارش، پرداخت و ارسال
| جدول | نقش |
|---|---|
| `orders`, `order_items`, `order_events` | سفارش، اقلام و تاریخچه وضعیت |
| `part_requests`, `quotes`, `quote_items` | RFQ و پیشنهاد فروشندگان |
| `payments`, `payment_events`, `refunds` | پرداخت، رویداد تأیید و بازپرداخت |
| `commissions`, `payouts`, `payout_lines` | کمیسیون و تسویه فروشنده/پیک |
| `deliveries`, `delivery_events` | مأموریت ارسال و تاریخچه آن |
| `idempotency_records` | یکتاسازی عملیات حساس |

### تعامل و زیرساخت
`notifications`، `device_tokens`، `reviews`، `support_tickets`، `ticket_messages`، `return_requests`، `system_settings`، `announcements`، `audit_logs`، `jobs`، `file_assets`، `coupons` و `coupon_redemptions`.

## قواعد داده

- Foreign Keyهای UUID در Entityها صریحاً `uuid` هستند؛ تعریف قبلی `varchar(36)` با Relationهای UUID در PostgreSQL ناسازگار بود.
- پول با `bigint` و transformer عدد صحیح تومان ذخیره می‌شود؛ محاسبه قیمت سمت سرور است.
- رزرو موجودی با `UPDATE ... WHERE stock - reservedStock >= quantity` انجام می‌شود.
- وضعیت `VERIFYING` در پرداخت، Claim اتمیک تأیید را بین Instanceها مشخص می‌کند.
- `referenceId` پرداخت، کمیسیون سفارش، کد سفارش و کلیدهای Idempotency دارای قید یکتا هستند.

## Migration نسخه‌بندی‌شده

Migration اولیه:

```text
apps/api/src/database/migrations/1761011200000-InitialPostgresSchema.ts
```

برای پایگاه PostgreSQL **تازه و خالی**:

```bash
DB_TYPE=postgres DB_SYNC=false npm run db:migrate
```

در Docker، `DB_MIGRATIONS_RUN=true` پیش از آماده‌شدن API Migrationهای ثبت‌شده را اجرا می‌کند.

### پایگاه موجود که قبلاً با synchronize ساخته شده است

Baseline را کورکورانه اجرا نکنید؛ جدول‌ها از قبل وجود دارند و Migration شکست می‌خورد. مسیر امن:

1. توقف Writerها و گرفتن `pg_dump` کامل.
2. اجرای `npm run check:postgres-schema` روی همان Commit.
3. مقایسه Schema موجود با Baseline در یک Clone/Staging واقعی PostgreSQL 16.
4. فقط اگر ساختار منطبق بود، Migration اولیه را در `schema_migrations` به‌عنوان اجراشده Baseline کنید؛ این عملیات باید با Runbook و تأیید DBA انجام شود.
5. سرویس را با `DB_SYNC=false` بالا بیاورید و Health/Smoke Test را اجرا کنید.

این مخزن عمداً دستور خودکار «fake baseline» ندارد تا Migration بدون بررسی DBA روی داده موجود علامت‌گذاری نشود.

## بررسی سازگاری

```bash
npm run check:postgres-schema
```

این Gate، Entityها را با PostgreSQL driver بارگذاری می‌کند، Baseline را روی موتور PostgreSQL-compatible درون‌حافظه‌ای اجرا و جدول‌های اصلی را بررسی می‌کند. تست یکپارچه `postgres-migration.spec.ts` مسیر Rollback را نیز می‌سنجد. به علت نبود Docker/PostgreSQL در محیط عامل، این نتیجه جای آزمون نهایی روی PostgreSQL 16 واقعی را نمی‌گیرد.
