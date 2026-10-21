# سیاست تخصیص مالی، لغو و بازپرداخت جزئی

وضعیت: **مصوب فنی برای پیاده‌سازی** — این سند سیاست قطعی محاسبه را تعریف می‌کند؛ تا تکمیل Ledger و تست‌های پذیرش، API نباید Refund جزئی را اجرا کند.

## ۱. واحد پول و اصل تغییرناپذیری

- همه مبالغ عدد صحیح تومان (`IRT`) هستند؛ عدد اعشاری در ذخیره‌سازی مجاز نیست.
- Snapshot قیمت، تخفیف تخصیص‌یافته، هزینه ارسال و نرخ کمیسیون پس از پرداخت تغییر نمی‌کند.
- هر تعدیل با یک سطر Ledger الحاقی ثبت می‌شود؛ سطر قبلی Update/Delete نمی‌شود.
- مجموع Ledger مرجع مانده قابل‌استرداد، طلب فروشنده و بدهی پلتفرم است؛ Status به‌تنهایی حقیقت مالی نیست.

## ۲. تخصیص کوپن

1. Coupon یک‌بار روی مجموع `itemsSubtotal` سفارش Parent اعتبارسنجی می‌شود.
2. تخفیف ابتدا متناسب با `itemsSubtotal` هر Child تخصیص می‌یابد.
3. تخفیف Child متناسب با `lineTotal` هر Item تخصیص می‌یابد.
4. گرد کردن با روش **Largest Remainder** انجام می‌شود:
   - سهم پایه هر مقصد `floor(totalDiscount * weight / totalWeight)` است.
   - باقیمانده یک تومان یک تومان به بزرگ‌ترین اعشارها داده می‌شود؛ تساوی با `id` صعودی شکسته می‌شود.
5. قیود الزامی:
   - مجموع Itemها = تخفیف Child
   - مجموع Childها = تخفیف Parent
   - تخفیف هیچ Item از `lineTotal` بیشتر نیست
6. Coupon Redemption فقط به Parent متصل است؛ لغو کامل همه اقلام آن را Reverse می‌کند. لغو جزئی مصرف Coupon را Reverse نمی‌کند و فقط سهم تخفیف Snapshot همان اقلام در Refund لحاظ می‌شود.

## ۳. مبلغ قابل بازپرداخت Item

برای هر واحد Item:

`netItemUnit = unitPrice - allocatedDiscountPerUnit`

در صورت باقی‌مانده تقسیم تخفیف Item میان تعداد، همان الگوریتم Largest Remainder با ترتیب واحدها اعمال می‌شود. مبلغ Item برای تعداد `q` برابر مجموع `netItemUnit` واحدهای انتخاب‌شده است و هر واحد حداکثر یک بار قابل تخصیص به Cancellation/Return/Refund است.

## ۴. هزینه ارسال

- لغو کامل Child پیش از `READY_FOR_PICKUP`: کل هزینه ارسال Child قابل بازپرداخت است.
- لغو جزئی Item در Childی که Item دیگری فعال دارد: هزینه ارسال بازپرداخت نمی‌شود.
- پس از `READY_FOR_PICKUP`: Cancellation مالی مجاز نیست؛ مسیر Return/Dispute استفاده می‌شود.
- پس از `PICKED_UP` یا تحویل: هزینه ارسال انجام‌شده قابل بازپرداخت نیست، مگر تعدیل دستی Admin با دلیل و Ledger نوع `GOODWILL_PLATFORM`؛ این مبلغ از سهم پلتفرم پرداخت می‌شود و طلب فروشنده/پیک را کم نمی‌کند.
- اگر مأموریت قبل از Pickup لغو و هزینه‌ای واقعاً به پیک تعلق گرفته باشد، مبلغ پیک به‌عنوان هزینه پلتفرم ثبت می‌شود و از Refund مشتری کم نمی‌شود.

## ۵. کمیسیون و سهم فروشنده

برای لغو/Refund Item:

- `commissionReversal = allocatedNetItems * snapshottedRate / 100` با همان قاعده گرد کردن اولیه.
- `sellerNetReversal = allocatedNetItems - commissionReversal`
- Courier و Delivery Platform فقط در لغو کامل Child پیش از انجام ارسال معکوس می‌شوند.
- هیچ Commission اصلی Update نمی‌شود؛ `COMMISSION_REVERSAL` به آن ارجاع می‌دهد.
- Payout فقط مانده Ledger تا Cutoff را انتخاب می‌کند. تعدیل پس از Payout، بدهی منفی دوره بعد فروشنده است و سطر Payout قبلی را تغییر نمی‌دهد.

## ۶. چرخه لغو و Refund

### پیش از پرداخت

- لغو Item/Child در یک Transaction: آزادسازی Reservation، ثبت Movement، ثبت Allocation و محاسبه مجدد Parent.
- اگر هیچ Child فعالی نماند Parent به `CANCELLED` می‌رود.

### پس از پرداخت و پیش از آماده‌سازی

- درخواست لغو، Allocation را با Snapshot محاسبه و Refund را `REQUESTED` می‌کند.
- موجودی فقط پس از پذیرش لغو Restock می‌شود.
- اثر مالی فقط پس از موفقیت Provider (`DONE`) در Ledger قطعی می‌شود.

### پس از تحویل

- فقط Itemهای Return تأییدشده قابل Refund هستند.
- مقدار Refund از مقدار Return دریافت‌شده بیشتر نمی‌شود.
- Refund جزئی وضعیت Parent را `REFUNDED` نمی‌کند؛ فقط `payment.status=PARTIALLY_REFUNDED` و مانده Ledger تغییر می‌کند.
- Parent فقط وقتی `REFUNDED` می‌شود که مجموع Refundهای موفق برابر مبلغ پرداخت باشد.

## ۷. Idempotency و هم‌زمانی

- کلید یکتا: `(operationType, sourceId, itemId, unitOrdinal)` برای Allocation و `providerOperationId` برای Refund Provider.
- محاسبه مانده، ایجاد Allocation، Claim عملیات و تغییر موجودی در Transaction با Lock Parent/Child انجام می‌شود.
- تماس Provider خارج Transaction است؛ قبل از تماس Claim پایدار `PROCESSING` و پس از آن نتیجه خام Provider ثبت می‌شود.
- Callback/Retry همیشه Reconcile می‌کند؛ هر اثر با Ledger/Checkpoint موجود Skip می‌شود.
- مجموع Refund موفق هر Payment هرگز از `amount` بیشتر نمی‌شود؛ این قید در Transaction بررسی می‌شود.

## ۸. مدل Ledger لازم

هر سطر حداقل شامل این فیلدهاست:

- `parentOrderId`, `childOrderId`, `orderItemId`, `paymentId`, `refundId`
- `entryType`: `COUPON_ALLOCATION`, `ITEM_REFUND`, `DELIVERY_REFUND`, `COMMISSION_REVERSAL`, `SELLER_NET_REVERSAL`, `COURIER_ADJUSTMENT`, `GOODWILL_PLATFORM`
- `amount` علامت‌دار، `currency`, `idempotencyKey`
- `effectiveAt`, `createdAt`, `actorId`, `reason`, `metadata`
- ارجاع به Entry معکوس‌شده؛ حذف یا Update مبلغ ممنوع

## ۹. معیار پذیرش پیاده‌سازی

- تطابق دقیق مجموع Parent/Child/Item در حالت گرد کردن دشوار و چندفروشنده‌ای
- دو درخواست هم‌زمان برای آخرین واحد فقط یک Allocation موفق
- Retry/Callback تکراری بدون Refund، Restock یا Commission Reversal مضاعف
- Refund کامل/جزئی قبل و بعد Pickup طبق سیاست ارسال
- جلوگیری از Refund Item بدون Return پس از تحویل
- Payout قبل/بعد Refund و بدهی دوره بعد قابل Reconcile
- تست PostgreSQL 16 برای Lock، Constraint، Migration، Backup و Restore
