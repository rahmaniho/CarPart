import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type SearchOffer } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa, formatToman, toFaDigits } from '../../lib/format';
import { useSessionStore } from '../../lib/session';
import { PublicLayout } from '../../components/PublicLayout';
import { EmptyState, ErrorBox, Section, Spinner, StatusChip } from '../../components/ui';

/** تأیید نهایی خرید مستقیم (قیمت همیشه از سرور محاسبه می‌شود) */
export function CheckoutPage(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
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
        `web-checkout-${Date.now()}`,
      ),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/account/orders/${order.id}`, { replace: true });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت سفارش ناموفق بود'),
  });

  if (!offer) {
    return (
      <PublicLayout>
        <EmptyState title="پیشنهادی انتخاب نشده است" hint="از صفحه جست‌وجو یک قطعه انتخاب کنید." />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <h1 className="text-lg font-extrabold">تأیید خرید</h1>
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
          قیمت نهایی، هزینه ارسال و تخفیف در سرور محاسبه و تأیید می‌شود؛ مبلغ این صفحه فقط نمایشی است.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">تعداد</span>
            <input className="cp-field" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">کد تخفیف (اختیاری)</span>
            <input className="cp-field" dir="ltr" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">نشانی تحویل</span>
          <select className="cp-field" value={addressId} onChange={(e) => setAddressId(e.target.value)}>
            <option value="">— انتخاب کنید —</option>
            {(addresses.data ?? []).map((address) => (
              <option key={address.id} value={address.id}>
                {address.city} — {address.addressText.slice(0, 40)}
              </option>
            ))}
          </select>
        </label>
        {addresses.data?.length === 0 ? (
          <p className="text-xs text-muted">
            هنوز نشانی ثبت نکرده‌اید؛ می‌توانید از اپ موبایل نشانی اضافه کنید یا بدون نشانی سفارش دهید (ثبت نشانی بعداً).
          </p>
        ) : null}
        {error ? <ErrorBox message={error} /> : null}
        <button type="button" className="cp-btn-primary w-full" disabled={create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? 'در حال ثبت…' : `ثبت سفارش برای ${user?.fullName ?? ''}`}
        </button>
      </div>
    </PublicLayout>
  );
}

/** فهرست سفارش‌های کاربر در وب */
export function AccountOrdersPage(): JSX.Element {
  const navigate = useNavigate();
  const orders = useQuery({ queryKey: ['orders', 'account'], queryFn: () => api.orders.list({ pageSize: 20 }) });

  return (
    <PublicLayout>
      <h1 className="text-lg font-extrabold">سفارش‌های من</h1>
      {orders.isLoading ? <Spinner /> : null}
      {orders.isError ? <ErrorBox message="دریافت سفارش‌ها ممکن نشد" onRetry={() => orders.refetch()} /> : null}
      {orders.data && orders.data.items.length === 0 ? <EmptyState title="هنوز سفارشی ندارید" hint="از جست‌وجو شروع کنید." /> : null}
      <div className="space-y-2">
        {(orders.data?.items ?? []).map((order) => (
          <button key={order.id} type="button" className="cp-card w-full text-start" onClick={() => navigate(`/account/orders/${order.id}`)}>
            <div className="flex items-center justify-between">
              <b className="text-sm" dir="ltr">{order.code}</b>
              <StatusChip status={order.status} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{dateFa(order.createdAt, false)}</span>
              <span className="font-bold text-ink">{formatToman(order.payableTotal)}</span>
            </div>
          </button>
        ))}
      </div>
    </PublicLayout>
  );
}

/** جزئیات سفارش در وب: پرداخت (Sandbox)، لغو، تاریخچه */
export function AccountOrderDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const detail = useQuery({ queryKey: ['order', id], queryFn: () => api.orders.detail(id!), enabled: Boolean(id) });
  const events = useQuery({ queryKey: ['order-events', id], queryFn: () => api.orders.events(id!), enabled: Boolean(id) });
  const readiness = useQuery({ queryKey: ['payment-readiness'], queryFn: () => api.payments.readiness() });

  const cancel = useMutation({
    mutationFn: () => api.orders.cancel(id!, 'انصراف مشتری'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'لغو سفارش ناموفق بود'),
  });

  async function pay(): Promise<void> {
    setPaying(true);
    setError(null);
    try {
      await api.payments.create({ orderId: id! }, `web-pay-${Date.now()}`);
      if (readiness.data?.sandbox) await api.payments.sandboxConfirm({ orderId: id!, decision: 'paid' });
      void queryClient.invalidateQueries({ queryKey: ['order', id] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'پرداخت ناموفق بود');
    } finally {
      setPaying(false);
    }
  }

  const order = detail.data;
  return (
    <PublicLayout>
      {detail.isLoading ? <Spinner /> : null}
      {order ? (
        <>
          <div className="cp-card space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-extrabold" dir="ltr">{order.code}</h1>
              <StatusChip status={order.status} />
            </div>
            {readiness.data?.sandbox ? (
              <p className="rounded-xl bg-amber-50 p-2 text-[11px] text-amber-900">درگاه پرداخت آزمایشی (Sandbox) است؛ تراکنش واقعی انجام نمی‌شود.</p>
            ) : null}
            {error ? <ErrorBox message={error} /> : null}
            {['WAITING_FOR_PAYMENT', 'PENDING_PAYMENT'].includes(order.status) ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="cp-btn-primary" disabled={paying} onClick={pay}>
                  {paying ? 'در حال پرداخت…' : `پرداخت ${formatToman(order.payableTotal)}`}
                </button>
                <button type="button" className="cp-btn-ghost text-red-700" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                  لغو سفارش
                </button>
              </div>
            ) : null}
          </div>

          <Section title="اقلام">
            <div className="cp-card divide-y divide-line">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-semibold">{item.partNameFa ?? 'قطعه'}</p>
                    <p className="text-xs text-muted">{toFaDigits(item.quantity)} × {formatToman(item.unitPrice)}</p>
                  </div>
                  <b>{formatToman(item.lineTotal)}</b>
                </div>
              ))}
            </div>
          </Section>

          <Section title="خلاصه مالی">
            <div className="cp-card space-y-1.5 text-sm">
              {(order.breakdown ?? []).map((line) => (
                <div key={line.fa} className="flex items-center justify-between">
                  <span className="text-muted">{line.fa}</span>
                  <b className="tabular-nums">{line.amount ? formatToman(line.amount) : '—'}</b>
                </div>
              ))}
            </div>
          </Section>

          <Section title="تاریخچه وضعیت">
            <div className="cp-card space-y-3">
              {(events.data ?? []).map((event) => (
                <div key={String(event.id)} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold">{String(event.fa ?? event.toStatus)}</p>
                    <p className="text-[11px] text-muted">{dateFa(String(event.createdAt))}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      ) : null}
    </PublicLayout>
  );
}
