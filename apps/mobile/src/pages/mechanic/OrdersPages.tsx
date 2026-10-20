import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@carpart/api-client';
import { api } from '../../lib/api';
import { idempotencyKey } from '../../lib/hooks';
import { dateFa, formatToman } from '../../lib/format';
import { AppShell } from '../../components/AppShell';
import { EmptyState, ErrorBox, Field, Section, Spinner, StatusChip } from '../../components/ui';
import { MECHANIC_TABS } from './MechanicHome';

export function OrdersPage(): JSX.Element {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const list = useQuery({ queryKey: ['orders', status], queryFn: () => api.orders.list({ status: status || undefined, pageSize: 20 }) });

  return (
    <AppShell title="سفارش‌های من" tabs={MECHANIC_TABS}>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { value: '', label: 'همه' },
          { value: 'WAITING_FOR_PAYMENT', label: 'در انتظار پرداخت' },
          { value: 'PREPARING', label: 'در حال آماده‌سازی' },
          { value: 'IN_TRANSIT', label: 'در حال ارسال' },
          { value: 'COMPLETED', label: 'تکمیل‌شده' },
        ].map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={status === filter.value ? 'cp-btn-primary !py-1.5 text-xs' : 'cp-btn-ghost !py-1.5 text-xs'}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {list.isLoading ? <Spinner /> : null}
      {list.isError ? <ErrorBox message="دریافت سفارش‌ها ممکن نشد" onRetry={() => list.refetch()} /> : null}
      {list.data && list.data.items.length === 0 ? <EmptyState title="سفارشی با این فیلتر نیست" /> : null}

      <div className="space-y-2">
        {(list.data?.items ?? []).map((order) => (
          <button key={order.id} type="button" className="cp-card w-full text-start" onClick={() => navigate(`/mechanic/orders/${order.id}`)}>
            <div className="flex items-center justify-between">
              <b className="text-sm" dir="ltr">
                {order.code}
              </b>
              <StatusChip status={order.status} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{dateFa(order.createdAt, false)}</span>
              <span className="font-bold text-ink">{formatToman(order.payableTotal)}</span>
            </div>
          </button>
        ))}
      </div>
    </AppShell>
  );
}

export function OrderDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [paying, setPaying] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [rating, setRating] = useState('5');
  const [reviewComment, setReviewComment] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  const detail = useQuery({ queryKey: ['order', id], queryFn: () => api.orders.detail(id!), enabled: Boolean(id) });
  const events = useQuery({ queryKey: ['order-events', id], queryFn: () => api.orders.events(id!), enabled: Boolean(id) });
  const readiness = useQuery({ queryKey: ['payment-readiness'], queryFn: () => api.payments.readiness() });
  const tracking = useQuery({
    queryKey: ['order-tracking', id],
    queryFn: () => api.orders.tracking(id!),
    enabled: Boolean(id && detail.data && ['WAITING_FOR_COURIER', 'COURIER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_ATTEMPTED'].includes(detail.data.status)),
    refetchInterval: 15_000,
  });

  const cancel = useMutation({
    mutationFn: () => api.orders.cancel(id!, cancelReason.trim() || 'انصراف مشتری'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['order', id] });
      setShowCancel(false);
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'لغو سفارش ناموفق بود'),
  });

  const refund = useMutation({
    mutationFn: () => api.payments.refund({ orderId: id!, reason: refundReason }, idempotencyKey('refund')),
    onSuccess: () => {
      setSuccess('درخواست بازپرداخت ثبت شد و در انتظار بررسی است.');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت بازپرداخت ناموفق بود'),
  });

  const review = useMutation({
    mutationFn: () =>
      api.reviews.create({
        orderId: id!,
        targetType: 'seller',
        rating: Number(rating),
        comment: reviewComment || undefined,
        hadIssue: Number(rating) <= 2,
      }),
    onSuccess: () => {
      setSuccess('نظر شما ثبت شد. سپاسگزاریم.');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت نظر ناموفق بود'),
  });

  async function payOrder(): Promise<void> {
    setPaying(true);
    setError(null);
    try {
      await api.payments.create({ orderId: id! }, idempotencyKey('pay'));
      // وضعیت درگاه را تازه می‌خوانیم (اگر کوئری هنوز بارگذاری نشده باشد، پرداخت نیمه‌کاره می‌ماند)
      const provider = readiness.data ?? (await api.payments.readiness());
      if (provider.sandbox) {
        // در حالت sandbox، پرداخت با تأیید سمت سرور انجام می‌شود؛ در درگاه واقعی کاربر به درگاه هدایت می‌شود
        await api.payments.sandboxConfirm({ orderId: id!, decision: 'paid' });
      } else {
        await api.payments.verify({ orderId: id! });
      }
      void queryClient.invalidateQueries({ queryKey: ['order', id] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'پرداخت ناموفق بود');
    } finally {
      setPaying(false);
    }
  }

  const order = detail.data;
  const canPay = order && ['WAITING_FOR_PAYMENT', 'PENDING_PAYMENT'].includes(order.status);

  return (
    <AppShell title={`سفارش ${order?.code ?? ''}`} tabs={MECHANIC_TABS}>
      {detail.isLoading ? <Spinner /> : null}
      {detail.isError ? <ErrorBox message="دریافت سفارش ممکن نشد" onRetry={() => detail.refetch()} /> : null}
      {order ? (
        <>
          <div className="cp-card space-y-2">
            <div className="flex items-center justify-between">
              <StatusChip status={order.status} />
              <span className="text-xs text-muted">{dateFa(order.createdAt)}</span>
            </div>
            {readiness.data?.sandbox ? (
              <p className="rounded-xl bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
                درگاه پرداخت در حالت آزمایشی (Sandbox) است و هیچ تراکنش واقعی انجام نمی‌شود.
              </p>
            ) : null}
            {error ? <ErrorBox message={error} /> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{success}</div> : null}
            {canPay ? (
              <button type="button" className="cp-btn-primary w-full" disabled={paying} onClick={payOrder}>
                {paying ? 'در حال پرداخت…' : `پرداخت ${formatToman(order.payableTotal)}`}
              </button>
            ) : null}
            {['WAITING_FOR_PAYMENT', 'PENDING_PAYMENT', 'PAID', 'SELLER_CONFIRMED'].includes(order.status) ? (
              <button type="button" className="cp-btn-ghost w-full text-red-700" onClick={() => setShowCancel((value) => !value)}>
                لغو سفارش
              </button>
            ) : null}
            {showCancel ? (
              <div className="space-y-2 rounded-xl bg-red-50 p-3">
                <Field label="دلیل لغو">
                  <input className="cp-field" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                </Field>
                <button type="button" className="cp-btn-danger w-full" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                  تأیید لغو سفارش
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
                    <p className="text-xs text-muted">
                      {item.quantity} × {formatToman(item.unitPrice)}
                    </p>
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

          {tracking.data ? (
            <Section title="رهگیری ارسال (هر ۱۵ ثانیه به‌روزرسانی)">
              <div className="cp-card space-y-1 text-xs leading-6">
                <p>وضعیت مأموریت: <b>{String(tracking.data.status ?? tracking.data.deliveryStatus ?? 'در حال پیگیری')}</b></p>
                <p>مبدأ: {String((tracking.data.pickupPoint as { addressText?: string } | undefined)?.addressText ?? 'فروشگاه')}</p>
                <p>مقصد: {String((tracking.data.dropoffPoint as { addressText?: string } | undefined)?.addressText ?? 'نشانی شما')}</p>
                {tracking.data.estimatedMinutes ? <p>زمان تخمینی: {String(tracking.data.estimatedMinutes)} دقیقه (تضمین‌شده نیست)</p> : null}
              </div>
            </Section>
          ) : null}

          {['DELIVERED', 'COMPLETED'].includes(order.status) ? (
            <Section title="نظر درباره فروشنده">
              <div className="cp-card space-y-2">
                <Field label="امتیاز">
                  <select className="cp-field" value={rating} onChange={(e) => setRating(e.target.value)}>
                    <option value="5">۵ — عالی</option><option value="4">۴ — خوب</option><option value="3">۳ — متوسط</option><option value="2">۲ — ضعیف</option><option value="1">۱ — بسیار ضعیف</option>
                  </select>
                </Field>
                <Field label="توضیح (اختیاری)">
                  <textarea className="cp-field min-h-20" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
                </Field>
                <button type="button" className="cp-btn-primary w-full" disabled={review.isPending} onClick={() => review.mutate()}>ثبت نظر</button>
              </div>
            </Section>
          ) : null}

          {['DELIVERED', 'COMPLETED', 'REFUND_REQUESTED'].includes(order.status) ? (
            <Section title="بازپرداخت / مشکل سفارش">
              <div className="cp-card space-y-2">
                <Field label="دلیل درخواست">
                  <textarea className="cp-field min-h-20" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="دلیل را دقیق بنویسید…" />
                </Field>
                <button type="button" className="cp-btn-ghost w-full text-red-700" disabled={refund.isPending || refundReason.trim().length < 3 || order.status === 'REFUND_REQUESTED'} onClick={() => refund.mutate()}>
                  {order.status === 'REFUND_REQUESTED' ? 'درخواست قبلاً ثبت شده است' : 'ثبت درخواست بازپرداخت'}
                </button>
              </div>
            </Section>
          ) : null}

          <Section title="تاریخچه وضعیت">
            <div className="cp-card space-y-3">
              {(events.data ?? []).map((event) => (
                <div key={String(event.id)} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold">{String(event.fa ?? event.toStatus)}</p>
                    <p className="text-[11px] text-muted">{dateFa(String(event.createdAt))}</p>
                    {event.reason ? <p className="text-[11px] text-muted">{String(event.reason)}</p> : null}
                  </div>
                </div>
              ))}
              {events.data?.length === 0 ? <p className="text-xs text-muted">رویدادی ثبت نشده است.</p> : null}
            </div>
          </Section>
        </>
      ) : null}
    </AppShell>
  );
}
