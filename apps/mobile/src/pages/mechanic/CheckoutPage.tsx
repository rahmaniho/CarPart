import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClientError, type SearchOffer } from '@carpart/api-client';
import { api } from '../../lib/api';
import { idempotencyKey } from '../../lib/hooks';
import { formatToman } from '../../lib/format';
import { AppShell, type TabDef } from '../../components/AppShell';
import { ErrorBox, Field, Spinner } from '../../components/ui';
import { MECHANIC_TABS } from './MechanicHome';

/** تأیید نهایی خرید مستقیم: تعداد، نشانی تحویل، کد تخفیف (قیمت نهایی از سرور) */
export default function CheckoutPage(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const offer = (location.state as { offer?: SearchOffer } | null)?.offer;
  const [quantity, setQuantity] = useState('1');
  const [addressId, setAddressId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api.workshops.addresses() });

  const create = useMutation({
    mutationFn: () =>
      api.orders.create(
        {
          items: [{ sellerProductId: offer!.sellerProductId, quantity: Number(quantity) || 1 }],
          deliveryAddressId: addressId || undefined,
          couponCode: couponCode || undefined,
        },
        idempotencyKey('order'),
      ),
    onSuccess: (order) => navigate(`/mechanic/orders/${order.id}`, { replace: true }),
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت سفارش ناموفق بود'),
  });

  if (!offer) {
    return (
      <AppShell title="تأیید خرید" tabs={MECHANIC_TABS as TabDef[]}>
        <p className="cp-card text-center text-sm text-muted">پیشنهادی انتخاب نشده است.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="تأیید خرید" tabs={MECHANIC_TABS}>
      <div className="cp-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <b className="text-sm">{String(offer.part?.nameFa ?? 'قطعه')}</b>
            <p className="text-xs text-muted">
              {offer.seller.name} · {offer.seller.branchName}
            </p>
          </div>
          <b className="text-primary">{formatToman(offer.price)}</b>
        </div>
        <p className="rounded-xl bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
          قیمت نهایی، هزینه ارسال و تخفیف در سرور محاسبه می‌شود؛ مبلغ این صفحه نمایشی است.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="تعداد">
            <input className="cp-field" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          </Field>
          <Field label="کد تخفیف (اختیاری)">
            <input className="cp-field" dir="ltr" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} />
          </Field>
        </div>
        <Field label="نشانی تحویل">
          <select className="cp-field" value={addressId} onChange={(e) => setAddressId(e.target.value)}>
            <option value="">— انتخاب کنید —</option>
            {(addresses.data ?? []).map((address) => (
              <option key={address.id} value={address.id}>
                {address.city} — {address.addressText.slice(0, 36)}
              </option>
            ))}
          </select>
        </Field>
        {addresses.data?.length === 0 ? <p className="text-[11px] text-muted">نشانی ندارید؛ از تب پروفایل می‌توانید اضافه کنید.</p> : null}
        {error ? <ErrorBox message={error} /> : null}
        <button type="button" className="cp-btn-primary w-full" disabled={create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Spinner label="در حال ثبت…" /> : 'ثبت سفارش'}
        </button>
        <button type="button" className="cp-btn-ghost w-full" onClick={() => navigate(-1)}>
          بازگشت
        </button>
      </div>
    </AppShell>
  );
}
