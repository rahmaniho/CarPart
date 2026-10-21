import type { DeliveryTracking } from '@carpart/api-client';
import { openInMaps } from '../lib/native';
import { dateFa, toFaDigits } from '../lib/format';

function distanceFa(distanceM: number | null): string | null {
  if (distanceM == null || !Number.isFinite(distanceM)) return null;
  if (distanceM < 1000) return `${toFaDigits(Math.max(0, Math.round(distanceM)))} متر`;
  return `${toFaDigits((distanceM / 1000).toFixed(1))} کیلومتر`;
}

function progressOf(status: string): number {
  if (status === 'DELIVERED') return 100;
  if (status === 'DELIVERY_ATTEMPTED') return 88;
  if (status === 'IN_TRANSIT') return 72;
  if (status === 'PICKED_UP') return 52;
  if (status === 'ACCEPTED') return 25;
  return 5;
}

/** نمای سبک و بدون وابستگی به سرویس نقشه؛ مختصات واقعی با دکمه بازکردن در نقشه دستگاه. */
export function LiveTrackingCard({ tracking, viewer }: { tracking: DeliveryTracking; viewer: 'customer' | 'seller' }): JSX.Element {
  const location = tracking.location;
  const goingToSeller = tracking.status === 'ACCEPTED';
  const nextDistance = goingToSeller ? location?.distanceToPickupM ?? null : location?.distanceToDropoffM ?? null;
  const distance = distanceFa(nextDistance);
  const progress = progressOf(tracking.status);

  return (
    <div className="cp-card overflow-hidden border-sky-200 bg-gradient-to-b from-sky-50 to-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-sky-700">ردیابی آنلاین مأموریت</p>
          <h3 className="mt-1 text-sm font-black text-ink">
            {viewer === 'seller'
              ? tracking.sellerArrival.detected
                ? 'پیک به محدوده فروشگاه رسیده است'
                : 'پیک در مسیر فروشگاه است'
              : goingToSeller
                ? 'پیک در مسیر دریافت بسته است'
                : 'مرسوله در مسیر شماست'}
          </h3>
        </div>
        <span className={`cp-chip ${location?.isFresh ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
          {location?.isFresh ? '● GPS آنلاین' : 'GPS به‌روز نیست'}
        </span>
      </div>

      <div className="mt-5 px-2" dir="ltr" role="img" aria-label="نمای شماتیک مسیر پیک از فروشگاه تا مقصد">
        <div className="relative h-2 rounded-full bg-slate-200">
          <div className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-cyan-500 to-blue-600 transition-all" style={{ width: `${progress}%` }} />
          <span className="absolute -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-sky-600 text-xs text-white shadow" style={{ right: `calc(${Math.min(94, Math.max(2, progress))}% - 14px)` }} aria-hidden>
            🛵
          </span>
        </div>
        <div className="mt-4 flex justify-between text-[10px] font-bold text-muted"><span>مقصد</span><span>فروشگاه</span></div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-white p-2 shadow-sm">
          <span className="block text-[10px] text-muted">فاصله تا نقطه بعدی</span>
          <b className="mt-1 block">{distance ?? 'در حال محاسبه'}</b>
        </div>
        <div className="rounded-xl bg-white p-2 shadow-sm">
          <span className="block text-[10px] text-muted">آخرین GPS</span>
          <b className="mt-1 block">{location ? dateFa(location.recordedAt) : 'هنوز دریافت نشده'}</b>
        </div>
      </div>

      {viewer === 'seller' && tracking.sellerArrival.detected ? (
        <p className="mt-3 rounded-xl bg-emerald-100 p-2 text-xs font-bold leading-6 text-emerald-900">
          بسته را برای تحویل آماده کنید؛ اعلان رسیدن پیک ثبت شده است.
        </p>
      ) : null}
      {!location ? <p className="mt-3 text-[11px] leading-5 text-muted">پس از فعال‌شدن GPS در اپ پیک، موقعیت اینجا نمایش داده می‌شود.</p> : null}
      {location && !location.isFresh ? <p className="mt-3 text-[11px] leading-5 text-amber-800">آخرین موقعیت قدیمی است؛ ممکن است اپ پیک بسته یا اینترنت قطع باشد.</p> : null}

      {location ? (
        <button type="button" className="cp-btn-ghost mt-3 w-full" onClick={() => openInMaps(location.lat, location.lng, 'موقعیت پیک کارپارت')}>
          باز کردن موقعیت پیک در نقشه
        </button>
      ) : null}
      <p className="mt-2 text-[10px] leading-5 text-muted">موقعیت تقریباً هر ۱۵ ثانیه تازه می‌شود. زمان رسیدن تخمینی است و تضمین نمی‌شود.</p>
    </div>
  );
}
