# مدل پایگاه‌داده — کارپارت

موتور: **sqljs** (توسعه/تست، فایلی) یا **PostgreSQL** (تولید) از طریق `DB_TYPE`. ORM: TypeORM.

## موجودیت‌های اصلی (۴۷ جدول)

### حساب و پروفایل
| جدول | نقش |
|---|---|
| `users` | کاربران (roles: mechanic/seller/courier/operator/admin)، رمز scrypt، موبایل یکتا |
| `refresh_sessions` | نشست‌های رفرش (چرخش + ابطال در استفاده مجدد) |
| `otp_codes` | کدهای یکبارمصرف (انقضا/تعداد تلاش) |
| `workshops` | پروفایل تعمیرگاه |
| `vehicles` | خودروهای مکانیک (مدل/تیپ/سال/پلاک) |
| `addresses` | نشانی‌های تحویل |
| `sellers`, `seller_branches` | فروشگاه + شعبه‌ها (موقعیت، زمان آماده‌سازی) |
| `couriers`, `courier_locations` | پیک + تاریخچه موقعیت (پاک‌سازی خودکار پس از ۲۴ ساعت) |

### کاتالوگ
| جدول | نقش |
|---|---|
| `parts` | قطعه (نام فارسی، برند، کد فنی/OEM، searchKey نرمال‌شده) |
| `part_compatibilities` | سازگاری قطعه با خودرو (exact/likely/…) |
| `categories`, `brands`, `vehicle_makes`, `vehicle_models`, `vehicle_variants` | طبقه‌بندی |
| `seller_products` | پیشنهاد هر فروشنده: قیمت، موجودی، رزرو، کیفیت |

### سفارش و درخواست
| جدول | نقش |
|---|---|
| `orders` | سفارش (کد یکتا ORD-…، وضعیت، مبالغ integer تومان، snapshot نشانی/خودرو) |
| `order_items` | اقلام سفارش (قیمت واحد از DB در لحظه ثبت) |
| `order_events` | تاریخچه گذارها (از/به، بازیگر، دلیل، زمان) |
| `part_requests` | درخواست تأمین RFQ (مهلت، هدف‌گیری فروشندگان) |
| `quotes`, `quote_items` | پیشنهاد قیمت فروشندگان |
| `idempotency_keys` | کلیدهای Idempotency (پرداخت/سفارش/تسویه) |

### پرداخت و مالی
| جدول | نقش |
|---|---|
| `payments` | تراکنش‌ها (provider، وضعیت، referenceId یکتای nullable) |
| `refunds` | بازپرداخت‌ها |
| `commissions` | کمیسیون هر سفارش (نرخ قابل تنظیم/بازنویسی per-seller) |
| `payouts`, `payout_items` | تسویه فروشنده/پیک (بدون تسویه مضاعف) |
| `coupons`, `coupon_usages` | کوپن تخفیف |

### ارسال
| جدول | نقش |
|---|---|
| `deliveries` | مأموریت (DLV-…، pickup/dropoff، کد رمزنگاری‌شده تحویل/OTP، مهلت پیشنهاد، excludedCourierIds) |
| `delivery_events` | تاریخچه مأموریت |

### تعامل و سامانه
| جدول | نقش |
|---|---|
| `notifications` | اعلان‌ها (dedupeKey یکتا، isSimulated) |
| `reviews` | نظرات فروشنده/پیک |
| `support_tickets`, `ticket_messages`, `return_requests` | پشتیبانی/مرجوعی |
| `system_settings` | تنظیمات key/value با برچسب فارسی |
| `audit_logs` | گزارش ممیزی عملیات حساس |
| `job_runs` | صف کارهای زمان‌دار |
| `files` | متادیتای فایل‌های بارگذاری‌شده |

## قواعد پولی
- همه مبالغ `bigint` تومان؛ transformer مبلغ/درصد با `undefined` هنگام unset (دور زدن defaultهای NOT NULL).
- `payableTotal = itemsSubtotal + deliveryFee - discountTotal`؛ `platformFee` (کمیسیون) جدا نگهداری می‌شود تا GMV از درآمد پلتفرم تفکیک شود.

## مهاجرت‌ها
- توسعه با `DB_SYNC=true` (ساخت خودکار schema).
- تولید: `npm run db:migrate -w @carpart/api` + تولید مهاجرت با `db:migration:generate`. پایه مهاجرت Postgres پیش از استقرار تولید باید تولید/نگهداری شود (در `docs/STATUS.md` به‌عنوان اقدام پیش از تولید ثبت شده).
