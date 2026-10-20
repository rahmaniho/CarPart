import {
  COMPATIBILITY_META,
  DELIVERY_STATUS_META,
  ORDER_STATUS_META,
  QUALITY_GRADES,
  QUALITY_META,
  QUOTE_STATUS_META,
  REQUEST_STATUS_META,
  URGENCY_LEVELS,
  URGENCY_META,
  countdownFa,
  formatJalali,
  formatToman,
  toPersianDigits,
  type OrderStatus,
  type Page,
  type QualityGrade,
  type RankExplanation,
  type UrgencyLevel,
} from '@carpart/contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Car,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FilePlus2,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Package,
  RotateCcw,
  Star,
  Truck,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PanelShell } from '../components/layout/AppLayout';
import {
  EmptyState,
  ErrorAlert,
  LoadingState,
  Modal,
  OrderProgressBar,
  RankBreakdownModal,
  StatCard,
  StatusBadge,
  StatusFromMap,
} from '../components/ui/Primitives';
import { api, makeIdempotencyKey } from '../lib/api-client';
import type {
  OrderDetailDto,
  OrderEventDto,
  PartRequestDto,
  QuoteComparisonRowDto,
  SavedVehicleDto,
  TrackingDto,
  WorkshopAddressDto,
} from '../lib/types';
import { useToastStore } from '../store/toast-store';

export function MechanicPanelLayout() {
  return (
    <PanelShell
      roleBadge="پنل مکانیک / تعمیرگاه"
      title="میز کار تأمین قطعه"
      subtitle="سفارش‌ها، استعلام قیمت، ردیابی و گاراژ"
      items={[
        { to: '/mechanic', label: 'خلاصه وضعیت', icon: <LayoutDashboard className="h-4 w-4" />, exact: true },
        { to: '/mechanic/orders', label: 'سفارش‌های من', icon: <Package className="h-4 w-4" /> },
        { to: '/mechanic/requests', label: 'درخواست‌های تأمین (RFQ)', icon: <ClipboardList className="h-4 w-4" /> },
        { to: '/mechanic/requests/new', label: 'ثبت درخواست جدید', icon: <FilePlus2 className="h-4 w-4" />, exact: true },
        { to: '/mechanic/garage', label: 'خودروها و آدرس‌ها', icon: <Car className="h-4 w-4" /> },
      ]}
    />
  );
}

/* ============================= ۱) خلاصه وضعیت مکانیک ============================= */
export function MechanicOverviewPage() {
  const ordersQuery = useQuery({
    queryKey: ['mechanic-orders-overview'],
    queryFn: () => api.get<Page<OrderDetailDto>>('orders', { pageSize: 5 }),
  });

  const requestsQuery = useQuery({
    queryKey: ['mechanic-requests-overview'],
    queryFn: () => api.get<Page<PartRequestDto>>('requests', { pageSize: 5 }),
  });

  const vehiclesQuery = useQuery({
    queryKey: ['mechanic-vehicles'],
    queryFn: () => api.get<SavedVehicleDto[]>('workshops/me/vehicles'),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="کل سفارش‌های ثبت‌شده"
          value={ordersQuery.data?.meta.total ?? 0}
          sub="خرید مستقیم و تبدیل از پیشنهاد"
          tone="brand"
        />
        <StatCard
          label="درخواست‌های استعلام قیمت"
          value={requestsQuery.data?.meta.total ?? 0}
          sub="دریافت پیشنهاد رقابتی از فروشندگان"
          tone="amber"
        />
        <StatCard
          label="خودروهای ثبت‌شده در گاراژ"
          value={vehiclesQuery.data?.length ?? 0}
          sub="آماده بررسی خودکار سازگاری قطعه"
          tone="emerald"
        />
      </div>

      {/* آخرین درخواست‌های تأمین */}
      <div className="cp-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900">آخرین درخواست‌های تأمین قطعه</h2>
          <Link to="/mechanic/requests/new" className="cp-btn-accent text-xs py-1.5 px-3">
            + درخواست جدید
          </Link>
        </div>

        {!requestsQuery.data?.items.length ? (
          <p className="text-xs text-slate-500">هنوز درخواستی ثبت نشده است.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {requestsQuery.data.items.map((req) => (
              <div key={req.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 ltr-num">{req.code}</span>
                    <span className="font-bold text-slate-900">{req.titleFa}</span>
                    <StatusFromMap value={req.status} map={REQUEST_STATUS_META} size="xs" />
                  </div>
                  <p className="mt-1 text-slate-500">
                    پیشنهادهای دریافتی: <strong>{toPersianDigits(req.quoteCount)}</strong> • ثبت در{' '}
                    {formatJalali(req.createdAt, { withTime: true })}
                  </p>
                </div>
                <Link to={`/mechanic/requests/${req.id}`} className="cp-btn-secondary text-xs py-1.5">
                  مقایسه پیشنهادها
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* آخرین سفارش‌ها */}
      <div className="cp-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900">آخرین سفارش‌ها</h2>
          <Link to="/mechanic/orders" className="text-xs font-bold text-brand-700 hover:underline">
            همه سفارش‌ها
          </Link>
        </div>

        {!ordersQuery.data?.items.length ? (
          <p className="text-xs text-slate-500">سفارشی ثبت نشده است.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {ordersQuery.data.items.map((ord) => (
              <div key={ord.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800 ltr-num">{ord.code}</span>
                    <StatusFromMap value={ord.status} map={ORDER_STATUS_META} size="xs" />
                  </div>
                  <p className="mt-1 text-slate-500">
                    مبلغ کل: <strong>{formatToman(ord.payableTotal)}</strong> • {formatJalali(ord.createdAt)}
                  </p>
                </div>
                <Link to={`/mechanic/orders/${ord.id}`} className="cp-btn-secondary text-xs py-1.5">
                  جزئیات و ردیابی
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================= ۲) فهرست سفارش‌ها ============================= */
export function MechanicOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('all');

  const ordersQuery = useQuery({
    queryKey: ['mechanic-orders', statusFilter],
    queryFn: () => api.get<Page<OrderDetailDto>>('orders', { status: statusFilter, pageSize: 30 }),
  });

  return (
    <div className="space-y-4">
      <div className="cp-card flex flex-wrap items-center justify-between gap-3 p-4">
        <h2 className="text-base font-extrabold text-slate-900">سفارش‌های خرید من</h2>
        <div className="flex items-center gap-2 text-xs">
          {[
            { key: 'all', label: 'همه' },
            { key: 'active', label: 'در جریان' },
            { key: 'WAITING_FOR_PAYMENT', label: 'در انتظار پرداخت' },
            { key: 'COMPLETED', label: 'تکمیل‌شده' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={statusFilter === tab.key ? 'cp-btn-primary text-xs py-1.5 px-3' : 'cp-btn-secondary text-xs py-1.5 px-3'}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {ordersQuery.isLoading ? (
        <LoadingState />
      ) : ordersQuery.error ? (
        <ErrorAlert error={ordersQuery.error} onRetry={() => ordersQuery.refetch()} />
      ) : !ordersQuery.data?.items.length ? (
        <EmptyState
          title="سفارشی در این وضعیت یافت نشد"
          action={
            <Link to="/search" className="cp-btn-primary">
              مشاهده کاتالوگ قطعات
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {ordersQuery.data.items.map((ord) => (
            <div key={ord.id} className="cp-card flex flex-wrap items-center justify-between gap-4 p-4 text-xs">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-extrabold text-slate-900 ltr-num">{ord.code}</span>
                  <StatusFromMap value={ord.status} map={ORDER_STATUS_META} size="xs" />
                  <StatusFromMap value={ord.urgency} map={URGENCY_META} size="xs" />
                </div>
                <p className="text-slate-500">
                  ثبت‌شده در {formatJalali(ord.createdAt, { withTime: true })} • مبلغ قابل پرداخت:{' '}
                  <strong className="text-slate-900">{formatToman(ord.payableTotal)}</strong>
                </p>
              </div>
              <Link to={`/mechanic/orders/${ord.id}`} className="cp-btn-primary text-xs">
                مدیریت سفارش و ردیابی
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================= ۳) جزئیات سفارش، پرداخت و ردیابی ============================= */
export function MechanicOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [reasonModal, setReasonModal] = useState<{ to: OrderStatus; title: string } | null>(null);
  const [reasonText, setReasonText] = useState('');

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('mismatch');
  const [returnDesc, setReturnDesc] = useState('');

  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSent, setReviewSent] = useState(false);

  const orderQuery = useQuery({
    queryKey: ['order-detail', id],
    queryFn: () => api.get<OrderDetailDto>(`orders/${id}`),
    enabled: Boolean(id),
    refetchInterval: 10_000,
  });

  const trackingQuery = useQuery({
    queryKey: ['order-tracking', id],
    queryFn: () => api.get<TrackingDto>(`orders/${id}/tracking`),
    enabled: Boolean(id),
    refetchInterval: 8_000,
  });

  const eventsQuery = useQuery({
    queryKey: ['order-events', id],
    queryFn: () => api.get<OrderEventDto[]>(`orders/${id}/events`),
    enabled: Boolean(id),
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] }),
      queryClient.invalidateQueries({ queryKey: ['order-tracking', id] }),
      queryClient.invalidateQueries({ queryKey: ['order-events', id] }),
      queryClient.invalidateQueries({ queryKey: ['mechanic-orders'] }),
    ]);
  };

  const handleSandboxPayment = async (decision: 'paid' | 'failed') => {
    if (!id) return;
    setError(null);
    setBusy(true);
    try {
      await api.post('payments', { orderId: id }, { idempotencyKey: makeIdempotencyKey('pay') });
      const res = await api.post<{ orderStatus: string; notice: string }>('payments/sandbox/confirm', {
        orderId: id,
        decision,
      });
      await refreshAll();
      pushToast({
        tone: decision === 'paid' ? 'success' : 'warning',
        title: decision === 'paid' ? 'پرداخت آزمایشی با موفقیت تأیید شد' : 'شکست پرداخت شبیه‌سازی شد',
        detail: res.notice,
      });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleTransition = async (to: OrderStatus, reason?: string) => {
    if (!id) return;
    setError(null);
    setBusy(true);
    try {
      if (to === 'REFUND_REQUESTED') {
        await api.post('payments/refunds', { orderId: id, reason: reason || 'درخواست بازپرداخت توسط خریدار' });
      } else {
        await api.post(`orders/${id}/transition`, { to, reason });
      }
      setReasonModal(null);
      setReasonText('');
      await refreshAll();
      pushToast({ tone: 'success', title: 'وضعیت سفارش به‌روزرسانی شد' });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateReturn = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !orderQuery.data) return;
    setError(null);
    setBusy(true);
    try {
      await api.post('returns', {
        orderId: id,
        orderItemId: orderQuery.data.items[0]?.id,
        quantity: 1,
        reason: returnReason,
        description: returnDesc || undefined,
      });
      setReturnModalOpen(false);
      pushToast({ tone: 'success', title: 'پرونده مرجوعی / مغایرت قطعه ثبت شد' });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    try {
      await api.post('reviews', {
        orderId: id,
        targetType: 'seller',
        rating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewSent(true);
      pushToast({ tone: 'success', title: 'امتیاز و دیدگاه شما برای فروشنده ثبت شد' });
    } catch (err) {
      setError(err);
    }
  };

  if (orderQuery.isLoading) return <LoadingState />;
  if (orderQuery.error || !orderQuery.data) {
    return <ErrorAlert error={orderQuery.error} onRetry={() => orderQuery.refetch()} />;
  }

  const order = orderQuery.data;
  const tracking = trackingQuery.data;

  return (
    <div className="space-y-5">
      <div className="cp-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-extrabold text-slate-900 ltr-num">{order.code}</h1>
            <StatusFromMap value={order.status} map={ORDER_STATUS_META} />
            <StatusBadge tone="neutral" label={order.source === 'quote' ? 'حاصل از استعلام قیمت' : 'خرید مستقیم'} size="xs" />
          </div>
          <p className="mt-1 text-xs text-slate-500">ثبت‌شده در {formatJalali(order.createdAt, { withTime: true })}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {order.allowedActions.map((act) => (
            <button
              key={act.to}
              type="button"
              disabled={busy}
              onClick={() => {
                if (act.requiresReason || act.to === 'REFUND_REQUESTED') {
                  setReasonModal({ to: act.to, title: act.fa });
                } else {
                  handleTransition(act.to);
                }
              }}
              className={act.to === 'CANCELLED' ? 'cp-btn-danger text-xs' : 'cp-btn-primary text-xs'}
            >
              {act.fa}
            </button>
          ))}

          {['DELIVERED', 'COMPLETED'].includes(order.status) && (
            <button type="button" onClick={() => setReturnModalOpen(true)} className="cp-btn-secondary text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              ثبت مغایرت / مرجوعی
            </button>
          )}
        </div>
      </div>

      <OrderProgressBar status={order.status} />

      <ErrorAlert error={error} />

      {/* درگاه پرداخت آزمایشی شفاف */}
      {(order.status === 'WAITING_FOR_PAYMENT' || order.status === 'PAYMENT_FAILED') && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CreditCard className="mt-0.5 h-5 w-5 text-amber-700" />
              <div className="space-y-1 text-xs">
                <span className="inline-block rounded bg-amber-200 px-2 py-0.5 font-extrabold text-amber-950">
                  درگاه پرداخت آزمایشی (Sandbox) — بدون تراکنش واقعی بانکی
                </span>
                <p className="text-sm font-bold text-slate-900">
                  مبلغ قابل پرداخت: {formatToman(order.payableTotal)}
                </p>
                <p className="text-amber-900">
                  تأیید پرداخت صرفاً در سمت سرور انجام می‌شود و پس از آن سفارش وارد صف فروشنده و محاسبه کارمزد می‌گردد.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleSandboxPayment('paid')}
              className="cp-btn-primary"
            >
              <CheckCircle2 className="h-4 w-4" />
              {busy ? 'در حال پردازش درگاه...' : 'شبیه‌سازی پرداخت موفق'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleSandboxPayment('failed')}
              className="cp-btn-danger"
            >
              شبیه‌سازی انصراف / خطای بانکی
            </button>
          </div>
        </div>
      )}

      {/* کارت ردیابی مرسوله و کد OTP تحویل */}
      {tracking && (
        <div className="cp-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Truck className="h-4 w-4 text-brand-700" />
              وضعیت ارسال و کد تحویل گیرنده
            </h2>
            {tracking.code && <StatusFromMap value={tracking.status} map={DELIVERY_STATUS_META} size="xs" />}
          </div>

          {tracking.deliveryOtp && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
              <div className="flex items-center gap-2.5 text-xs text-emerald-950">
                <KeyRound className="h-5 w-5 text-emerald-700" />
                <div>
                  <p className="font-bold">کد یکبارمصرف تحویل به پیک (OTP)</p>
                  <p className="text-emerald-800">این کد را فقط پس از رؤیت و تحویل فیزیکی قطعه به پیک اعلام کنید.</p>
                </div>
              </div>
              <span className="rounded-lg bg-white px-4 py-1.5 font-mono text-xl font-extrabold tracking-widest text-emerald-900 shadow-sm ltr-num">
                {tracking.deliveryOtp}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="text-slate-400">پیک اختصاص‌یافته:</span>
              <p className="mt-1 font-bold text-slate-900">
                {tracking.courier ? `${tracking.courier.name} (${tracking.courier.phoneMasked})` : 'در انتظار تخصیص'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="text-slate-400">مسافت و زمان تخمینی مسیر:</span>
              <p className="mt-1 font-bold text-slate-900">
                {tracking.distanceKm !== null ? `${toPersianDigits(tracking.distanceKm)} کیلومتر` : '—'}
                {tracking.estimatedMinutes !== null ? ` • ~${toPersianDigits(tracking.estimatedMinutes)} دقیقه` : ''}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="text-slate-400">منبع مسیریابی:</span>
              <p className="mt-1 font-bold text-slate-900">
                {tracking.routeSource === 'estimation' ? 'تخمین هندسی داخلی (Mock)' : tracking.routeSource}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">{tracking.notice}</p>
        </div>
      )}

      {/* اقلام و تجزیه مالی */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        <div className="cp-card p-5 md:col-span-7 space-y-3 text-xs">
          <h2 className="text-sm font-extrabold text-slate-900">اقلام سفارش</h2>
          <div className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-bold text-slate-900">{item.nameFa}</p>
                  <p className="text-slate-500">
                    تعداد: {toPersianDigits(item.quantity)} × {formatToman(item.unitPrice)}
                  </p>
                </div>
                <span className="font-extrabold text-slate-900">{formatToman(item.lineTotal)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="cp-card p-5 md:col-span-5 space-y-2.5 text-xs">
          <h2 className="text-sm font-extrabold text-slate-900">ریز مبالغ محاسبه‌شده سرور</h2>
          {order.breakdown.map((row, idx) => (
            <div key={idx} className="flex justify-between border-b border-slate-100 pb-2 last:border-none">
              <span className="text-slate-600">{row.fa}</span>
              {row.amount !== 0 && <span className="font-bold text-slate-900">{formatToman(row.amount)}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* فرم ثبت دیدگاه پس از تکمیل */}
      {order.status === 'COMPLETED' && !reviewSent && (
        <form onSubmit={handleSubmitReview} className="cp-card p-5 space-y-3 text-xs">
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
            <Star className="h-4 w-4 text-amber-500" />
            ثبت امتیاز کیفیت قطعه و عملکرد فروشنده
          </h2>
          <div className="flex items-center gap-2">
            {[5, 4, 3, 2, 1].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRating(r)}
                className={rating === r ? 'cp-btn-accent text-xs py-1 px-3' : 'cp-btn-secondary text-xs py-1 px-3'}
              >
                {toPersianDigits(r)} ستاره
              </button>
            ))}
          </div>
          <input
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="تجربه خود از اصالت و بسته‌بندی قطعه را بنویسید..."
            className="cp-input"
          />
          <button type="submit" className="cp-btn-primary">
            ثبت دیدگاه
          </button>
        </form>
      )}

      {/* تاریخچه رویدادهای ماشین وضعیت */}
      <div className="cp-card p-5 space-y-3 text-xs">
        <h2 className="text-sm font-extrabold text-slate-900">کاربرگ تاریخچه رویدادهای سفارش</h2>
        <div className="space-y-2">
          {eventsQuery.data?.map((ev) => (
            <div key={ev.id} className="flex flex-wrap items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <div>
                <span className="font-bold text-slate-800">{ev.faDescription}</span>
                {ev.reason && <span className="mr-2 text-slate-500">(علت: {ev.reason})</span>}
              </div>
              <span className="text-[11px] text-slate-400">{formatJalali(ev.createdAt, { withTime: true })}</span>
            </div>
          ))}
        </div>
      </div>

      {/* پنجره دلیل تغییر وضعیت */}
      <Modal
        open={Boolean(reasonModal)}
        onClose={() => setReasonModal(null)}
        title={reasonModal?.title ?? 'ثبت دلیل'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reasonModal) handleTransition(reasonModal.to, reasonText.trim());
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="cp-label">علت عملیات</label>
            <textarea
              rows={3}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              className="cp-input"
              required
              placeholder="لطفاً دلیل خود را به‌طور شفاف وارد کنید..."
            />
          </div>
          <button type="submit" disabled={busy} className="cp-btn-primary w-full">
            تأیید و ارسال به سرور
          </button>
        </form>
      </Modal>

      {/* پنجره ثبت مرجوعی */}
      <Modal open={returnModalOpen} onClose={() => setReturnModalOpen(false)} title="ثبت مغایرت یا مرجوعی قطعه">
        <form onSubmit={handleCreateReturn} className="space-y-3 text-xs">
          <div>
            <label className="cp-label">علت مرجوعی</label>
            <select value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="cp-input">
              <option value="mismatch">عدم تطابق با خودرو</option>
              <option value="wrong_part">ارسال قطعه اشتباه</option>
              <option value="defective">معیوب بودن قطعه</option>
              <option value="damaged">آسیب‌دیدگی فیزیکی</option>
            </select>
          </div>
          <div>
            <label className="cp-label">شرح دقیق مغایرت</label>
            <textarea
              rows={3}
              value={returnDesc}
              onChange={(e) => setReturnDesc(e.target.value)}
              className="cp-input"
              required
            />
          </div>
          <button type="submit" disabled={busy} className="cp-btn-primary w-full">
            ثبت درخواست مرجوعی
          </button>
        </form>
      </Modal>
    </div>
  );
}

/* ============================= ۴) درخواست‌های تأمین قطعه (RFQ) ============================= */
export function MechanicRequestsListPage() {
  const requestsQuery = useQuery({
    queryKey: ['mechanic-requests-list'],
    queryFn: () => api.get<Page<PartRequestDto>>('requests', { pageSize: 30 }),
  });

  return (
    <div className="space-y-4">
      <div className="cp-card flex items-center justify-between p-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">درخواست‌های تأمین قطعه من</h2>
          <p className="text-xs text-slate-500">ارسال هم‌زمان استعلام به فروشندگان مرتبط و مقایسه بی‌طرف پیشنهادها</p>
        </div>
        <Link to="/mechanic/requests/new" className="cp-btn-accent text-xs">
          + ثبت استعلام جدید
        </Link>
      </div>

      {requestsQuery.isLoading ? (
        <LoadingState />
      ) : !requestsQuery.data?.items.length ? (
        <EmptyState
          title="هنوز درخواست استعلام قیمتی ثبت نکرده‌اید"
          action={
            <Link to="/mechanic/requests/new" className="cp-btn-accent">
              ثبت اولین درخواست تأمین قطعه
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {requestsQuery.data.items.map((req) => (
            <div key={req.id} className="cp-card flex flex-wrap items-center justify-between gap-4 p-4 text-xs">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-slate-500 ltr-num">{req.code}</span>
                  <span className="text-sm font-extrabold text-slate-900">{req.titleFa}</span>
                  <StatusFromMap value={req.status} map={REQUEST_STATUS_META} size="xs" />
                  <StatusFromMap value={req.urgency} map={URGENCY_META} size="xs" />
                </div>
                <p className="text-slate-500">
                  تعداد موردنیاز: {toPersianDigits(req.quantity)} • پیشنهادهای دریافت‌شده:{' '}
                  <strong className="text-brand-700">{toPersianDigits(req.quoteCount)}</strong>
                  {req.deadlineAt ? ` • مهلت: ${countdownFa(req.deadlineAt)}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {req.convertedOrderId && (
                  <Link to={`/mechanic/orders/${req.convertedOrderId}`} className="cp-btn-secondary text-xs">
                    مشاهده سفارش
                  </Link>
                )}
                <Link to={`/mechanic/requests/${req.id}`} className="cp-btn-primary text-xs">
                  مشاهده و مقایسه پیشنهادها
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewPartRequestPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pushToast = useToastStore((s) => s.push);

  const [partNameFa, setPartNameFa] = useState(searchParams.get('part') ?? '');
  const [technicalCode, setTechnicalCode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [qualityPreference, setQualityPreference] = useState<QualityGrade>('oem');
  const [urgency, setUrgency] = useState<UrgencyLevel>('urgent');
  const [vehicleId, setVehicleId] = useState('');
  const [deliveryAddressId, setDeliveryAddressId] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const vehiclesQuery = useQuery({
    queryKey: ['mechanic-vehicles'],
    queryFn: () => api.get<SavedVehicleDto[]>('workshops/me/vehicles'),
  });

  const addressesQuery = useQuery({
    queryKey: ['mechanic-addresses'],
    queryFn: () => api.get<WorkshopAddressDto[]>('workshops/me/addresses'),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const created = await api.post<PartRequestDto & { targetedSellerCount: number }>('requests', {
        partNameFa,
        titleFa: partNameFa,
        technicalCode: technicalCode.trim() || undefined,
        quantity,
        qualityPreference,
        urgency,
        vehicleId: vehicleId || vehiclesQuery.data?.[0]?.id || undefined,
        deliveryAddressId: deliveryAddressId || addressesQuery.data?.[0]?.id || undefined,
        description: description.trim() || undefined,
      });
      pushToast({
        tone: 'success',
        title: `درخواست ${created.code} ثبت شد`,
        detail: `برای ${toPersianDigits(created.targetedSellerCount)} فروشگاه تأییدشده ارسال گردید.`,
      });
      navigate(`/mechanic/requests/${created.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cp-card p-6 space-y-5">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">ثبت درخواست تأمین قطعه (استعلام رقابتی RFQ)</h1>
        <p className="text-xs text-slate-500">
          فروشندگان واجد شرایط در شهر شما درخواست را دریافت می‌کنند و قیمت، کیفیت و زمان آماده‌سازی اعلام می‌کنند.
        </p>
      </div>

      <ErrorAlert error={error} />

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="cp-label">نام قطعه موردنیاز *</label>
            <input
              value={partNameFa}
              onChange={(e) => setPartNameFa(e.target.value)}
              placeholder="مثلاً: واتر پمپ پراید ۱۳۱ یا دیسک ترمز ۲۰۶"
              className="cp-input"
              required
              minLength={3}
            />
          </div>
          <div>
            <label className="cp-label">کد فنی / شماره شاسی یا قطعه (اختیاری)</label>
            <input
              value={technicalCode}
              onChange={(e) => setTechnicalCode(e.target.value)}
              placeholder="مثلاً: WP-131"
              className="cp-input ltr-num"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="cp-label">تعداد</label>
            <input
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="cp-input"
              required
            />
          </div>
          <div>
            <label className="cp-label">کیفیت ترجیحی</label>
            <select
              value={qualityPreference}
              onChange={(e) => setQualityPreference(e.target.value as QualityGrade)}
              className="cp-input"
            >
              {QUALITY_GRADES.map((g) => (
                <option key={g} value={g}>
                  {QUALITY_META[g].fa}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="cp-label">میزان فوریت</label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
              className="cp-input"
            >
              {URGENCY_LEVELS.map((u) => (
                <option key={u} value={u}>
                  {URGENCY_META[u].fa}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="cp-label">خودروی تعمیرگاه</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="cp-input">
              {vehiclesQuery.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nickname || v.freeModelName} {v.plate ? `(${v.plate})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cp-label">آدرس مقصد تحویل</label>
            <select
              value={deliveryAddressId}
              onChange={(e) => setDeliveryAddressId(e.target.value)}
              className="cp-input"
            >
              {addressesQuery.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} — {a.addressText}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="cp-label">توضیحات تکمیلی برای فروشندگان</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="علائم خرابی، برند موردنظر یا شرایط خاص تحویل..."
            className="cp-input"
          />
        </div>

        <button type="submit" disabled={loading} className="cp-btn-primary">
          {loading ? 'در حال ارسال به فروشندگان...' : 'ثبت و ارسال استعلام قیمت'}
        </button>
      </form>
    </div>
  );
}

export function MechanicRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pushToast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [selectedRank, setSelectedRank] = useState<{
    name: string;
    rank: RankExplanation | null;
    warnings: string[];
  } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const compareQuery = useQuery({
    queryKey: ['request-compare', id],
    queryFn: () => api.get<{ request: PartRequestDto; quotes: QuoteComparisonRowDto[] }>(`requests/${id}/quotes`),
    enabled: Boolean(id),
    refetchInterval: 10_000,
  });

  const handleAcceptQuote = async (quoteId: string) => {
    setError(null);
    setAcceptingId(quoteId);
    try {
      const order = await api.post<OrderDetailDto>(
        `requests/quotes/${quoteId}/accept`,
        {},
        { idempotencyKey: makeIdempotencyKey('accept-quote') },
      );
      await queryClient.invalidateQueries({ queryKey: ['request-compare', id] });
      pushToast({
        tone: 'success',
        title: `پیشنهاد پذیرفته شد و سفارش ${order.code} ایجاد گردید`,
        detail: 'اکنون می‌توانید پرداخت سفارش را تکمیل کنید.',
      });
      navigate(`/mechanic/orders/${order.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setAcceptingId(null);
    }
  };

  if (compareQuery.isLoading) return <LoadingState />;
  if (compareQuery.error || !compareQuery.data) {
    return <ErrorAlert error={compareQuery.error} onRetry={() => compareQuery.refetch()} />;
  }

  const { request, quotes } = compareQuery.data;

  return (
    <div className="space-y-5">
      <div className="cp-card p-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-slate-500 ltr-num">{request.code}</span>
            <h1 className="text-lg font-extrabold text-slate-900">{request.titleFa}</h1>
            <StatusFromMap value={request.status} map={REQUEST_STATUS_META} size="xs" />
          </div>
          {request.deadlineAt && (
            <span className="text-xs font-semibold text-amber-800">
              مهلت دریافت پیشنهاد: {countdownFa(request.deadlineAt)}
            </span>
          )}
        </div>
        {request.description && <p className="text-xs text-slate-600">{request.description}</p>}
      </div>

      <ErrorAlert error={error} />

      <h2 className="text-base font-extrabold text-slate-900">
        مقایسه شفاف پیشنهادهای فروشندگان ({toPersianDigits(quotes.length)} پیشنهاد)
      </h2>

      {!quotes.length ? (
        <EmptyState
          title="هنوز فروشنده‌ای برای این درخواست پیشنهاد قیمت ثبت نکرده است"
          description="صفحه به‌صورت خودکار هر ۱۰ ثانیه به‌روزرسانی می‌شود."
        />
      ) : (
        <div className="space-y-4">
          {quotes.map((q, index) => (
            <div
              key={q.quoteId}
              className={`cp-card p-5 space-y-4 ${index === 0 ? 'border-emerald-300 ring-1 ring-emerald-200' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {index === 0 && <StatusBadge tone="success" label="پیشنهاد برتر رتبه‌بندی شفاف" size="xs" />}
                    <span className="text-base font-extrabold text-slate-900">{q.storeName}</span>
                    {q.branchName && <span className="text-xs text-slate-500">({q.branchName})</span>}
                    <StatusFromMap value={q.compatibility} map={COMPATIBILITY_META} size="xs" />
                    <StatusFromMap value={q.status} map={QUOTE_STATUS_META} size="xs" />
                  </div>
                  <p className="text-xs text-slate-500">
                    آماده‌سازی: {toPersianDigits(q.preparationMinutes)} دقیقه
                    {q.estimatedDeliveryMinutes !== null
                      ? ` • تحویل تقریبی کل: ~${toPersianDigits(q.estimatedDeliveryMinutes)} دقیقه`
                      : ''}
                    {q.distanceKm !== null ? ` • فاصله: ${toPersianDigits(q.distanceKm)} کیلومتر` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedRank({
                      name: q.storeName,
                      rank: q.explanation,
                      warnings: q.warnings,
                    })
                  }
                  className="cp-btn-secondary text-xs py-1.5"
                >
                  <BarChart3 className="h-4 w-4 text-brand-700" />
                  شرح امتیاز: {toPersianDigits(Math.round(q.rank))} از ۱۰۰
                </button>
              </div>

              {q.note && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">توضیح فروشنده: {q.note}</p>}

              <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-3">
                <div className="space-y-0.5 text-xs">
                  <span className="text-slate-500">
                    اقلام: {formatToman(q.itemsTotal)} + ارسال: {formatToman(q.deliveryFee)}
                  </span>
                  <p className="text-lg font-extrabold text-slate-900">جمع کل: {formatToman(q.total)}</p>
                </div>

                {q.status === 'SUBMITTED' && ['OPEN', 'QUOTED'].includes(request.status) && (
                  <button
                    type="button"
                    disabled={Boolean(acceptingId)}
                    onClick={() => handleAcceptQuote(q.quoteId)}
                    className="cp-btn-primary"
                  >
                    {acceptingId === q.quoteId ? 'در حال تبدیل به سفارش...' : 'پذیرش پیشنهاد و ایجاد سفارش'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <RankBreakdownModal
        open={Boolean(selectedRank)}
        onClose={() => setSelectedRank(null)}
        sellerName={selectedRank?.name ?? ''}
        rank={selectedRank?.rank ?? null}
        warnings={selectedRank?.warnings}
      />
    </div>
  );
}

/* ============================= ۵) گاراژ (خودروها و آدرس‌ها) ============================= */
export function MechanicGaragePage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);

  const [nickname, setNickname] = useState('');
  const [plate, setPlate] = useState('');
  const [yearFrom, setYearFrom] = useState(1399);
  const [engine, setEngine] = useState('');

  const vehiclesQuery = useQuery({
    queryKey: ['mechanic-vehicles'],
    queryFn: () => api.get<SavedVehicleDto[]>('workshops/me/vehicles'),
  });

  const addressesQuery = useQuery({
    queryKey: ['mechanic-addresses'],
    queryFn: () => api.get<WorkshopAddressDto[]>('workshops/me/addresses'),
  });

  const handleAddVehicle = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('workshops/me/vehicles', {
      nickname,
      freeModelName: nickname,
      plate: plate || undefined,
      yearFrom,
      engine: engine || undefined,
    });
    setNickname('');
    setPlate('');
    setEngine('');
    await queryClient.invalidateQueries({ queryKey: ['mechanic-vehicles'] });
    pushToast({ tone: 'success', title: 'خودرو جدید به گاراژ تعمیرگاه اضافه شد' });
  };

  return (
    <div className="space-y-6">
      <div className="cp-card p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <Car className="h-5 w-5 text-brand-700" />
          خودروهای ذخیره‌شده تعمیرگاه
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {vehiclesQuery.data?.map((v) => (
            <div key={v.id} className="rounded-xl border border-slate-200 p-3.5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{v.nickname || v.freeModelName}</span>
                {v.plate && <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">{v.plate}</span>}
              </div>
              <p className="text-slate-500">
                {v.yearFrom ? `سال ${toPersianDigits(v.yearFrom)}` : ''} {v.engine ? `• موتور ${v.engine}` : ''}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddVehicle} className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-5 text-xs">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="نام خودرو (مثلاً دنا پلاس)"
            className="cp-input"
            required
          />
          <input
            type="number"
            min={1360}
            max={1410}
            value={yearFrom}
            onChange={(e) => setYearFrom(Number(e.target.value))}
            placeholder="سال ساخت"
            className="cp-input"
          />
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="پلاک (اختیاری)"
            className="cp-input"
          />
          <input
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            placeholder="نوع موتور (مثلاً EF7)"
            className="cp-input"
          />
          <button type="submit" className="cp-btn-primary">
            + ثبت خودرو
          </button>
        </form>
      </div>

      <div className="cp-card p-5 space-y-3">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <MapPin className="h-5 w-5 text-brand-700" />
          آدرس‌های ثبت‌شده تعمیرگاه
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {addressesQuery.data?.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-200 p-3.5 text-xs space-y-1">
              <span className="font-bold text-slate-900">{a.title}</span>
              <p className="text-slate-600">{a.addressText}</p>
              <p className="text-slate-400">
                گیرنده: {a.receiverName} ({a.phone})
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
