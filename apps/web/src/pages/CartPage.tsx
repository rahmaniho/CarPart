import {
  QUALITY_META,
  URGENCY_LEVELS,
  URGENCY_META,
  formatToman,
  toPersianDigits,
  toRialDisplay,
  type UrgencyLevel,
} from '@carpart/contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MapPin, Minus, Plus, ShieldCheck, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, ErrorAlert, Modal, StatusFromMap } from '../components/ui/Primitives';
import { api, makeIdempotencyKey } from '../lib/api-client';
import type { OrderDetailDto, SavedVehicleDto, WorkshopAddressDto } from '../lib/types';
import { useAuthStore } from '../store/auth-store';
import { useCartStore } from '../store/cart-store';
import { useToastStore } from '../store/toast-store';

export function CartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { items, selectedVehicleId, setVehicleId, setQuantity, removeItem, clear } = useCartStore();
  const pushToast = useToastStore((s) => s.push);

  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; message: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [newAddrOpen, setNewAddrOpen] = useState(false);
  const [addrTitle, setAddrTitle] = useState('تعمیرگاه');
  const [addrReceiver, setAddrReceiver] = useState(user?.fullName ?? '');
  const [addrPhone, setAddrPhone] = useState(user?.mobile ?? '');
  const [addrCity, setAddrCity] = useState(user?.city ?? 'تهران');
  const [addrText, setAddrText] = useState('');

  const isMechanic = Boolean(user?.roles.includes('mechanic'));

  const addressesQuery = useQuery({
    queryKey: ['mechanic-addresses'],
    queryFn: () => api.get<WorkshopAddressDto[]>('workshops/me/addresses'),
    enabled: isMechanic,
  });

  const vehiclesQuery = useQuery({
    queryKey: ['mechanic-vehicles'],
    queryFn: () => api.get<SavedVehicleDto[]>('workshops/me/vehicles'),
    enabled: isMechanic,
  });

  if (!items.length) {
    return (
      <EmptyState
        title="سبد خرید شما خالی است"
        description="از کاتالوگ قطعات پیشنهاد فروشنده موردنظر را انتخاب کنید یا برای قطعه موردنیاز درخواست استعلام قیمت ثبت کنید."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/search" className="cp-btn-primary">
              جست‌وجو در کاتالوگ قطعات
            </Link>
            <Link to="/mechanic/requests/new" className="cp-btn-secondary">
              ثبت درخواست تأمین قطعه
            </Link>
          </div>
        }
      />
    );
  }

  const effectiveAddressId = selectedAddressId || addressesQuery.data?.[0]?.id || '';
  const itemsSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const estimatedDelivery = items[0]?.estimatedDeliveryFee ?? 25_000;
  const discount = appliedCoupon?.discount ?? 0;
  const estimatedPayable = Math.max(0, itemsSubtotal + estimatedDelivery - discount);

  const handleValidateCoupon = async (codeToTest?: string) => {
    const code = (codeToTest ?? couponInput).trim();
    if (!code) return;
    setError(null);
    try {
      const res = await api.post<{ valid: boolean; code: string; discount: number; message: string }>(
        'coupons/validate',
        {
          code,
          itemsSubtotal,
        },
      );
      setAppliedCoupon(res);
      setCouponInput(res.code);
      pushToast({ tone: 'success', title: 'کد تخفیف اعمال شد', detail: res.message });
    } catch (err) {
      setAppliedCoupon(null);
      setError(err);
    }
  };

  const handleCreateAddress = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.post<WorkshopAddressDto>('workshops/me/addresses', {
        title: addrTitle,
        receiverName: addrReceiver,
        phone: addrPhone,
        city: addrCity,
        addressText: addrText,
        lat: 35.72,
        lng: 51.41,
        isDefault: true,
      });
      await queryClient.invalidateQueries({ queryKey: ['mechanic-addresses'] });
      setSelectedAddressId(created.id);
      setNewAddrOpen(false);
      pushToast({ tone: 'success', title: 'آدرس تحویل جدید ذخیره شد' });
    } catch (err) {
      setError(err);
    }
  };

  const handleSubmitOrder = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const order = await api.post<OrderDetailDto>(
        'orders',
        {
          items: items.map((it) => ({
            sellerProductId: it.sellerProductId,
            quantity: it.quantity,
          })),
          deliveryAddressId: effectiveAddressId || undefined,
          vehicleId: selectedVehicleId || undefined,
          urgency,
          couponCode: appliedCoupon?.code || undefined,
          notes: notes.trim() || undefined,
        },
        { idempotencyKey: makeIdempotencyKey('order') },
      );
      clear();
      pushToast({
        tone: 'success',
        title: `سفارش ${order.code} ثبت و موجودی رزرو شد`,
        detail: 'اکنون می‌توانید پرداخت آزمایشی را تکمیل کنید.',
      });
      navigate(`/mechanic/orders/${order.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* فهرست اقلام و تنظیمات ارسال */}
      <div className="lg:col-span-8 space-y-4">
        <div className="cp-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-brand-700" />
              <div>
                <h1 className="text-lg font-extrabold text-slate-900">سبد خرید قطعه</h1>
                <p className="text-xs text-slate-500">
                  تأمین‌کننده: <strong>{items[0].sellerName}</strong>{' '}
                  {items[0].branchName ? `(${items[0].branchName})` : ''}
                </p>
              </div>
            </div>
            <button type="button" onClick={clear} className="text-xs font-semibold text-rose-600 hover:underline">
              خالی‌کردن سبد
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.sellerProductId} className="flex flex-wrap items-center justify-between gap-4 py-3.5">
                <div className="space-y-1">
                  <Link
                    to={`/parts/${item.partId}`}
                    className="text-sm font-bold text-slate-900 hover:text-brand-700"
                  >
                    {item.partNameFa}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <StatusFromMap value={item.quality} map={QUALITY_META} size="xs" />
                    <span>قیمت واحد: {formatToman(item.unitPrice)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      aria-label="کاهش تعداد"
                      onClick={() => setQuantity(item.sellerProductId, item.quantity - 1)}
                      className="p-2 text-slate-600 hover:text-slate-900"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-8 text-center text-xs font-bold">{toPersianDigits(item.quantity)}</span>
                    <button
                      type="button"
                      aria-label="افزایش تعداد"
                      disabled={item.quantity >= item.maxStock}
                      onClick={() => setQuantity(item.sellerProductId, item.quantity + 1)}
                      className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <span className="min-w-28 text-left text-sm font-extrabold text-slate-900">
                    {formatToman(item.unitPrice * item.quantity)}
                  </span>

                  <button
                    type="button"
                    aria-label="حذف قلم"
                    onClick={() => removeItem(item.sellerProductId)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ErrorAlert error={error} />

        {/* انتخاب آدرس، خودرو و فوریت (ویژه مکانیک واردشده) */}
        {!user ? (
          <div className="cp-card p-5 border-brand-200 bg-brand-50/40 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">برای ثبت نهایی سفارش و رزرو موجودی وارد شوید</p>
              <p className="text-xs text-slate-600">
                می‌توانید با یک کلیک از حساب نمونه «مکانیک / تعمیرگاه» استفاده کنید.
              </p>
            </div>
            <Link to="/login?redirect=/cart" className="cp-btn-primary">
              ورود با حساب مکانیک
            </Link>
          </div>
        ) : !isMechanic ? (
          <div className="cp-card p-5 border-amber-200 bg-amber-50 text-xs text-amber-950">
            ثبت سفارش خرید قطعه مخصوص حساب‌های دارای نقش <strong>«مکانیک / تعمیرگاه»</strong> است. از صفحه ورود می‌توانید با
            حساب نمونه مکانیک (۰۹۱۲۱۱۱۰۰۰۱) وارد شوید.
          </div>
        ) : (
          <div className="cp-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                <MapPin className="h-4 w-4 text-brand-700" />
                آدرس تحویل و مشخصات خودرو
              </h2>
              <button type="button" onClick={() => setNewAddrOpen(true)} className="cp-btn-secondary text-xs py-1.5">
                + افزودن آدرس جدید
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {addressesQuery.data?.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => setSelectedAddressId(addr.id)}
                  className={`rounded-xl border p-3 text-right text-xs transition ${
                    effectiveAddressId === addr.id
                      ? 'border-brand-600 bg-brand-50/60'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{addr.title}</span>
                    {effectiveAddressId === addr.id && <Check className="h-4 w-4 text-brand-700" />}
                  </div>
                  <p className="mt-1 text-slate-600">{addr.addressText}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    گیرنده: {addr.receiverName} ({addr.phone})
                  </p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
              <div>
                <label className="cp-label">خودروی مرتبط با این سفارش (اختیاری)</label>
                <select
                  value={selectedVehicleId ?? ''}
                  onChange={(e) => setVehicleId(e.target.value || null)}
                  className="cp-input text-xs"
                >
                  <option value="">انتخاب نشده</option>
                  {vehiclesQuery.data?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nickname || v.freeModelName} {v.plate ? `— ${v.plate}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="cp-label">سطح فوریت ارسال</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                  className="cp-input text-xs"
                >
                  {URGENCY_LEVELS.map((u) => (
                    <option key={u} value={u}>
                      {URGENCY_META[u].fa}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="cp-label">توضیحات برای فروشنده یا پیک (اختیاری)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثلاً: لطفاً فاکتور رسمی ضمیمه شود یا تحویل درب ورودی کارگاه..."
                className="cp-input text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* خلاصه صورتحساب و ثبت سفارش */}
      <div className="lg:col-span-4 space-y-4">
        <div className="cp-card p-5 space-y-4 sticky top-20">
          <h2 className="text-base font-extrabold text-slate-900">خلاصه پیش‌فاکتور</h2>

          {/* کد تخفیف */}
          {isMechanic && (
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <label className="cp-label flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-brand-600" />
                کد تخفیف
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="WELCOME10 یا TEHRAN50"
                  className="cp-input text-xs ltr-num uppercase"
                />
                <button
                  type="button"
                  onClick={() => handleValidateCoupon()}
                  className="cp-btn-secondary text-xs shrink-0"
                >
                  بررسی
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>کوپن‌های نمونه:</span>
                <button
                  type="button"
                  onClick={() => handleValidateCoupon('WELCOME10')}
                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono hover:bg-brand-50 hover:text-brand-700"
                >
                  WELCOME10
                </button>
                <button
                  type="button"
                  onClick={() => handleValidateCoupon('TEHRAN50')}
                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono hover:bg-brand-50 hover:text-brand-700"
                >
                  TEHRAN50
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>جمع اقلام ({toPersianDigits(items.reduce((s, i) => s + i.quantity, 0))} عدد)</span>
              <span className="font-semibold text-slate-900">{formatToman(itemsSubtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>هزینه ارسال پایه تخمینی</span>
              <span className="font-semibold text-slate-900">{formatToman(estimatedDelivery)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>تخفیف کوپن ({appliedCoupon?.code})</span>
                <span>− {formatToman(discount)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-2.5 flex justify-between text-sm font-extrabold text-slate-900">
              <span>برآورد قابل پرداخت</span>
              <div className="text-left">
                <span>{formatToman(estimatedPayable)}</span>
                <span className="block text-[11px] font-normal text-slate-400">
                  معادل {toPersianDigits(toRialDisplay(estimatedPayable).toLocaleString('fa-IR'))} ریال
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>
              مبلغ نهایی، هزینه دقیق مسیر و اعتبار موجودی منحصراً در سمت سرور محاسبه و با کلید یکتاسازی
              (Idempotency-Key) ثبت می‌شود.
            </span>
          </div>

          <button
            type="button"
            disabled={!isMechanic || submitting}
            onClick={handleSubmitOrder}
            className="cp-btn-primary w-full py-3"
          >
            {submitting ? 'در حال ثبت سفارش و رزرو موجودی...' : 'ثبت نهایی سفارش و ادامه به پرداخت'}
          </button>
        </div>
      </div>

      {/* پنجره افزودن سریع آدرس تحویل */}
      <Modal open={newAddrOpen} onClose={() => setNewAddrOpen(false)} title="افزودن آدرس تحویل جدید">
        <form onSubmit={handleCreateAddress} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="cp-label">عنوان آدرس</label>
              <input value={addrTitle} onChange={(e) => setAddrTitle(e.target.value)} className="cp-input" required />
            </div>
            <div>
              <label className="cp-label">شهر</label>
              <input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} className="cp-input" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="cp-label">نام تحویل‌گیرنده</label>
              <input
                value={addrReceiver}
                onChange={(e) => setAddrReceiver(e.target.value)}
                className="cp-input"
                required
              />
            </div>
            <div>
              <label className="cp-label">شماره تماس</label>
              <input
                value={addrPhone}
                onChange={(e) => setAddrPhone(e.target.value)}
                className="cp-input ltr-num"
                required
              />
            </div>
          </div>
          <div>
            <label className="cp-label">نشانی دقیق پستی (حداقل ۱۰ نویسه)</label>
            <textarea
              rows={2}
              value={addrText}
              onChange={(e) => setAddrText(e.target.value)}
              className="cp-input"
              required
              minLength={10}
              placeholder="تهران، خیابان آزادی، کوچه ...، پلاک ..."
            />
          </div>
          <button type="submit" className="cp-btn-primary w-full">
            ذخیره آدرس
          </button>
        </form>
      </Modal>
    </div>
  );
}
