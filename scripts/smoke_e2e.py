#!/usr/bin/env python3
"""
آزمون دودِ سرتاسری (End-to-End smoke test) کارپارت.

این اسکریپت یک چرخه کامل کسب‌وکار را روی API در حال اجرا می‌آزماید:
ورود مکانیک با کد یکبارمصرف → جست‌وجوی قطعه با زمینه خودرو → ثبت سفارش →
پرداخت (درگاه آزمایشی) → تأیید و آماده‌سازی فروشنده → تخصیص پیک → دریافت با کد تحویل →
تحویل با کد تأیید → تکمیل سفارش → ثبت بازخورد → بررسی داشبورد مدیر.

کاربرد:
    python3 scripts/smoke_e2e.py [--base-url http://localhost:4000/api/v1]

نکته: داده نمونه (seed) باید پیش‌تر ساخته شده باشد و AUTH_EXPOSE_DEV_OTP=true باشد.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PASSED: list[str] = []
FAILED: list[tuple[str, str]] = []


def call(
    base: str,
    method: str,
    path: str,
    body: dict | None = None,
    token: str | None = None,
    expect: int | tuple[int, ...] = (200, 201),
    headers: dict | None = None,
) -> dict:
    url = f"{base.rstrip('/')}/{path.lstrip('/')}"
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header('Content-Type', 'application/json')
    request.add_header('Accept', 'application/json')
    if token:
        request.add_header('Authorization', f'Bearer {token}')
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read().decode()
            status = response.status
    except urllib.error.HTTPError as error:  # noqa: PERF203
        payload = error.read().decode()
        status = error.code
    try:
        parsed = json.loads(payload) if payload else {}
    except json.JSONDecodeError:
        parsed = {'raw': payload[:400]}
    if isinstance(expect, int):
        expect = (expect,)
    if status not in expect:
        raise AssertionError(f'{method} {path} → وضعیت {status} (انتظار {expect}): {json.dumps(parsed, ensure_ascii=False)[:400]}')
    return parsed


def check(label: str, action) -> object:
    try:
        result = action()
    except Exception as error:  # noqa: BLE001
        FAILED.append((label, str(error)))
        print(f'  ✗ {label}\n      {error}')
        return None
    PASSED.append(label)
    print(f'  ✓ {label}')
    return result


def login(base: str, mobile: str) -> tuple[str, dict]:
    requested = call(base, 'POST', 'auth/otp/request', {'mobile': mobile, 'purpose': 'login'})
    code = requested.get('devCode')
    if not code:
        raise AssertionError('کد تأیید در پاسخ نیست (AUTH_EXPOSE_DEV_OTP باید در حالت توسعه فعال باشد).')
    result = call(base, 'POST', 'auth/otp/verify', {'mobile': mobile, 'code': code, 'purpose': 'login'})
    return result['accessToken'], result['user']


def wait_for(predicate, timeout: int = 40, interval: float = 2.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://localhost:4000/api/v1')
    args = parser.parse_args()
    base = args.base_url

    print('\n== ۱) احراز هویت و آماده‌سازی داده ==')
    mechanic_token = check('ورود مکانیک با کد یکبارمصرف', lambda: login(base, '09121110001')[0])
    if not mechanic_token:
        return report()
    seller_token, seller_user = check('ورود فروشنده', lambda: login(base, '09122220001'))
    courier_token = check('ورود پیک', lambda: login(base, '09123330001')[0])
    admin_token = check('ورود مدیر', lambda: login(base, '09120000000')[0])

    vehicles = check('دریافت خودروهای تعمیرگاه', lambda: call(base, 'GET', 'workshops/me/vehicles', token=mechanic_token))
    addresses = check('دریافت آدرس‌های تحویل', lambda: call(base, 'GET', 'workshops/me/addresses', token=mechanic_token))
    if not isinstance(vehicles, list) or not vehicles or not isinstance(addresses, list) or not addresses:
        FAILED.append(('داده نمونه خودرو/آدرس', 'خودرو یا آدرسی یافت نشد'))
        return report()
    vehicle_id = vehicles[0]['id']
    address_id = addresses[0]['id']

    print('\n== ۲) جست‌وجوی فارسی و رتبه‌بندی شفاف ==')
    search = check(
        'جست‌وجوی «لنت ترمز» با زمینه خودرو',
        lambda: call(base, 'GET', f'catalog/search?{urllib.parse.urlencode({"q": "لنت ترمز", "vehicleId": vehicle_id, "pageSize": 5})}'),
    )
    if not isinstance(search, dict) or not search.get('items'):
        FAILED.append(('نتیجه جست‌وجو', 'هیچ پیشنهادی یافت نشد'))
        return report()

    tolerant = check(
        'جست‌وجوی tolerant با «لنت ترمز پرايد» (ی عربی و فاصله اضافه)',
        lambda: call(base, 'GET', f'catalog/search?{urllib.parse.urlencode({"q": "  لنت   ترمز  پرايد  ", "vehicleId": vehicle_id, "pageSize": 5})}'),
    )
    if isinstance(tolerant, dict):
        print(f'      نتیجه جست‌وجوی tolerant: {tolerant.get("meta", {}).get("total", 0)} پیشنهاد')

    offer = None
    for item in search['items']:
        if item.get('stock', 0) > 0 and item.get('compatibility', {}).get('level') in ('exact', 'likely'):
            offer = item
            break
    offer = offer or next((item for item in search['items'] if item.get('stock', 0) > 0), None)
    if not offer:
        FAILED.append(('انتخاب پیشنهاد', 'پیشنهادی با موجودی یافت نشد'))
        return report()
    print(f'      پیشنهاد انتخابی: {offer["part"]["nameFa"]} از {offer["seller"]["name"]} — {offer["price"]} تومان، سازگاری {offer["compatibility"]["level"]}')
    check('وجود توضیح شفاف رتبه‌بندی', lambda: (offer['rank']['factors'], offer['rank']['transparent'])[0])

    print('\n== ۳) ثبت سفارش خرید مستقیم ==')
    order = check(
        'ثبت سفارش (قیمت سمت سرور محاسبه می‌شود)',
        lambda: call(
            base,
            'POST',
            'orders',
            {
                'items': [{'sellerProductId': offer['sellerProductId'], 'quantity': 2}],
                'deliveryAddressId': address_id,
                'vehicleId': vehicle_id,
                'urgency': 'normal',
                'notes': 'آزمون دود سرتاسری',
            },
            token=mechanic_token,
            headers={'Idempotency-Key': f'smoke-order-{int(time.time())}'},
        ),
    )
    if not isinstance(order, dict) or not order.get('id'):
        return report()
    order_id = order['id']
    print(f'      کد سفارش {order["code"]} | اقلام {order["itemsSubtotal"]} | ارسال {order["deliveryFee"]} | قابل پرداخت {order["payableTotal"]}')
    check('تجزیه مبلغ شفاف در پاسخ', lambda: order['breakdown'])
    check('وضعیت اولیه انتظار پرداخت', lambda: order['status'] == 'WAITING_FOR_PAYMENT' or (_ for _ in ()).throw(AssertionError(order['status'])))

    wrong_price = check(
        'رد دستکاری قیمت از سمت کاربر (۴۰۰)',
        lambda: call(
            base,
            'POST',
            'orders',
            {'items': [{'sellerProductId': offer['sellerProductId'], 'quantity': 2, 'unitPrice': 1}], 'deliveryAddressId': address_id},
            token=mechanic_token,
            expect=(400,),
        ),
    )
    _ = wrong_price

    print('\n== ۴) پرداخت آزمایشی و تأیید سمت سرور ==')
    payment = check('ایجاد تراکنش پرداخت', lambda: call(base, 'POST', 'payments', {'orderId': order_id}, token=mechanic_token))
    if isinstance(payment, dict):
        print(f'      درگاه: {payment.get("provider")} ({payment.get("mode")}) — {payment.get("sandboxNotice")}')
    confirmed = check('تأیید پرداخت در درگاه آزمایشی', lambda: call(base, 'POST', 'payments/sandbox/confirm', {'orderId': order_id, 'decision': 'paid'}, token=mechanic_token))
    if isinstance(confirmed, dict):
        check('وضعیت سفارش پس از پرداخت = PAID', lambda: confirmed['orderStatus'] == 'PAID' or (_ for _ in ()).throw(AssertionError(confirmed['orderStatus'])))

    print('\n== ۵) جریان فروشنده ==')
    seller_orders = check('فهرست سفارش‌های فروشنده', lambda: call(base, 'GET', 'seller/orders?pageSize=50', token=seller_token))
    if isinstance(seller_orders, dict):
        mine = [item for item in seller_orders.get('items', []) if item['id'] == order_id]
        check('دسترسی فروشنده به سفارش خودش', lambda: bool(mine) or (_ for _ in ()).throw(AssertionError('سفارش در فهرست فروشنده نیست')))
    forbidden = check(
        'جلوگیری از تغییر وضعیت نامجاز توسط فروشنده (تحویل نهایی)',
        lambda: call(base, 'POST', f'orders/{order_id}/transition', {'to': 'DELIVERED'}, token=seller_token, expect=(403, 409)),
    )
    _ = forbidden
    check('تأیید سفارش توسط فروشنده', lambda: call(base, 'POST', f'seller/orders/{order_id}/transition', {'to': 'SELLER_CONFIRMED'}, token=seller_token))
    check('شروع آماده‌سازی', lambda: call(base, 'POST', f'seller/orders/{order_id}/transition', {'to': 'PREPARING'}, token=seller_token))
    check('اعلام آمادگی تحویل به پیک', lambda: call(base, 'POST', f'seller/orders/{order_id}/transition', {'to': 'READY_FOR_PICKUP'}, token=seller_token))

    print('\n== ۶) مأموریت ارسال و پیک ==')
    ok = wait_for(
        lambda: isinstance(call(base, 'GET', f'orders/{order_id}/tracking', token=mechanic_token), dict)
        and call(base, 'GET', f'orders/{order_id}/tracking', token=mechanic_token).get('deliveryId')
        and call(base, 'GET', f'orders/{order_id}', token=mechanic_token).get('status') in ('WAITING_FOR_COURIER', 'COURIER_ASSIGNED'),
        timeout=60,
    )
    check('ساخت مأموریت ارسال و رفتن به صف پیک', lambda: ok or (_ for _ in ()).throw(AssertionError('مأموریت ارسال در مهلت مقرر ساخته/تخصیص نیافت')))

    offers_ok = wait_for(lambda: bool(call(base, 'GET', 'courier/deliveries?status=offers', token=courier_token).get('items')), timeout=60)
    check('پیشنهاد مأموریت به نزدیک‌ترین پیک', lambda: offers_ok or (_ for _ in ()).throw(AssertionError('پیشنهادی برای پیک ثبت نشد')))
    missions = call(base, 'GET', 'courier/deliveries?status=offers', token=courier_token)
    mission_id = missions['items'][0]['id']
    check('پذیرش مأموریت توسط پیک', lambda: call(base, 'POST', f'courier/deliveries/{mission_id}/accept', {}, token=courier_token))

    seller_tracking = check('دریافت کد تحویل از دید فروشنده', lambda: call(base, 'GET', f'seller/deliveries/{order_id}', token=seller_token))
    pickup_code = (seller_tracking or {}).get('pickupCode')
    if not pickup_code:
        FAILED.append(('کد تحویل', 'کد تحویل برای فروشنده نمایش داده نشد'))
        return report()
    check('رد کد تأیید تحویل اشتباه', lambda: call(base, 'POST', f'courier/deliveries/{mission_id}/pickup', {'pickupCode': '00000'}, token=courier_token, expect=(409,)))
    check('دریافت مرسوله با کد تحویل صحیح', lambda: call(base, 'POST', f'courier/deliveries/{mission_id}/pickup', {'pickupCode': pickup_code}, token=courier_token))
    check('شروع ارسال', lambda: call(base, 'POST', f'courier/deliveries/{mission_id}/transit', {}, token=courier_token))

    tracking = check('نمای ردیابی برای مکانیک', lambda: call(base, 'GET', f'orders/{order_id}/tracking', token=mechanic_token))
    otp = (tracking or {}).get('deliveryOtp')
    if not otp:
        FAILED.append(('کد تأیید تحویل', 'کد تأیید به گیرنده نمایش داده نشد'))
        return report()
    print(f'      منبع مسافت/زمان: {(tracking or {}).get("routeSource")} — {tracking.get("notice")}')
    check('رد کد تأیید اشتباه در تحویل', lambda: call(base, 'POST', f'courier/deliveries/{mission_id}/deliver', {'otp': '00000'}, token=courier_token, expect=(409,)))
    check('ثبت تحویل با کد تأیید صحیح', lambda: call(base, 'POST', f'courier/deliveries/{mission_id}/deliver', {'otp': otp, 'note': 'تحویل در محل'}, token=courier_token))

    print('\n== ۷) تکمیل سفارش، بازخورد و حریم خصوصی ==')
    delivered = check('وضعیت سفارش پس از تحویل', lambda: call(base, 'GET', f'orders/{order_id}', token=mechanic_token))
    if isinstance(delivered, dict):
        check('سفارش در وضعیت DELIVERED', lambda: delivered['status'] == 'DELIVERED' or (_ for _ in ()).throw(AssertionError(delivered['status'])))
    check('تأیید نهایی توسط مکانیک', lambda: call(base, 'POST', f'orders/{order_id}/transition', {'to': 'COMPLETED'}, token=mechanic_token))
    check('ثبت بازخورد فروشنده', lambda: call(base, 'POST', 'reviews', {'orderId': order_id, 'targetType': 'seller', 'rating': 5, 'comment': 'قطعه مطابق توضیح و سریع رسید.'}, token=mechanic_token))

    other_mechanic = check('ورود مکانیک دوم', lambda: login(base, '09121110002')[0])
    check(
        'جلوگیری از دسترسی کاربر دیگر به سفارش (۴۰۳)',
        lambda: call(base, 'GET', f'orders/{order_id}', token=other_mechanic, expect=(403,)),
    )
    events = check('تاریخچه رویدادهای سفارش', lambda: call(base, 'GET', f'orders/{order_id}/events', token=mechanic_token))
    if isinstance(events, list):
        print(f'      {len(events)} رویداد ثبت شده؛ نمونه: {events[-1]["faDescription"]}')

    print('\n== ۸) درخواست تأمین و مقایسه پیشنهادها ==')
    request = check(
        'ثبت درخواست تأمین قطعه',
        lambda: call(
            base,
            'POST',
            'requests',
            {
                'titleFa': 'واتر پمپ پراید (آزمون دود)',
                'partNameFa': 'واتر پمپ پراید',
                'quantity': 1,
                'urgency': 'normal',
                'description': 'نیاز به نمونه اصلی یا درجه یک دارم.',
                'vehicleId': vehicle_id,
                'deliveryAddressId': address_id,
            },
            token=mechanic_token,
        ),
    )
    if isinstance(request, dict) and request.get('id'):
        request_id = request['id']
        print(f'      فروشگاه‌های هدف: {request.get("targetedSellerCount")}')
        seller_requests = check('فهرست درخواست‌های مرتبط برای فروشنده', lambda: call(base, 'GET', 'seller/requests?status=open', token=seller_token))
        quote = check(
            'ثبت پیشنهاد قیمت توسط فروشنده',
            lambda: call(
                base,
                'POST',
                f'seller/requests/{request_id}/quotes',
                {
                    'items': [{'sellerProductId': offer['sellerProductId'], 'quantity': 1, 'unitPrice': offer['price']}],
                    'preparationMinutes': 35,
                    'note': 'موجودی انبار مرکزی',
                },
                token=seller_token,
            ),
        )
        _ = seller_requests
        if isinstance(quote, dict) and quote.get('id'):
            comparison = check('نمای مقایسه پیشنهادها با رتبه‌بندی', lambda: call(base, 'GET', f'requests/{request_id}/quotes', token=mechanic_token))
            if isinstance(comparison, dict) and comparison.get('quotes'):
                row = comparison['quotes'][0]
                print(f'      بهترین پیشنهاد: {row["storeName"]} — {row["total"]} تومان، رتبه {round(row["rank"], 1)}، سازگاری {row["compatibility"]}')
            accepted = check(
                'پذیرش پیشنهاد و تبدیل به سفارش',
                lambda: call(base, 'POST', f'requests/quotes/{quote["id"]}/accept', {}, token=mechanic_token, headers={'Idempotency-Key': f'smoke-quote-{int(time.time())}'}),
            )
            if isinstance(accepted, dict) and accepted.get('code'):
                print(f'      سفارش حاصل از پیشنهاد: {accepted["code"]} با وضعیت {accepted["status"]}')

    print('\n== ۹) پنل مدیریت ==')
    dashboard = check('داشبورد مدیر از داده واقعی', lambda: call(base, 'GET', 'admin/dashboard?days=30', token=admin_token))
    if isinstance(dashboard, dict):
        money = dashboard.get('money', {})
        print(f"      کاربران {dashboard['users']['total']} | سفارش‌ها {dashboard['orders']['total']} | GMV {money.get('gmv')} | درآمد پلتفرم {money.get('platformRevenue')}")
        check('تفکیک GMV از درآمد پلتفرم', lambda: money.get('gmv', 0) >= money.get('platformRevenue', 0))
    operator_token = check('ورود اپراتور پشتیبانی', lambda: login(base, '09120000001')[0])
    check('اپراتور داشبورد را می‌بیند', lambda: call(base, 'GET', 'admin/dashboard', token=operator_token))
    check(
        'اپراتور اجازه تأیید فروشنده ندارد (۴۰۳)',
        lambda: call(base, 'POST', 'admin/verifications/seller/00000000-0000-4000-8000-000000000000/approve', {}, token=operator_token, expect=(403,)),
    )
    check(
        'اپراتور به گزارش ممیزی دسترسی ندارد (۴۰۳)',
        lambda: call(base, 'GET', 'admin/audit', token=operator_token, expect=(403,)),
    )
    check('مدیر گزارش ممیزی را می‌بیند', lambda: call(base, 'GET', 'admin/audit?pageSize=5', token=admin_token))

    return report()


def report() -> int:
    print('\n' + '=' * 60)
    print(f'نتیجه آزمون دود سرتاسری: {len(PASSED)} موفق، {len(FAILED)} ناموفق')
    if FAILED:
        print('\nموارد ناموفق:')
        for label, reason in FAILED:
            print(f'  - {label}: {reason}')
    print('=' * 60)
    return 1 if FAILED else 0


if __name__ == '__main__':
    sys.exit(main())
