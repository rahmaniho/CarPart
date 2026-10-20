import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type QuoteComparisonRow } from '@carpart/api-client';
import { api } from '../../lib/api';
import { idempotencyKey } from '../../lib/hooks';
import { countdownFa, dateFa, formatToman } from '../../lib/format';
import { AppShell } from '../../components/AppShell';
import { EmptyState, ErrorBox, Field, Section, Spinner } from '../../components/ui';
import { MECHANIC_TABS } from './MechanicHome';

const REQUEST_STATUS_FA: Record<string, string> = {
  OPEN: 'باز',
  QUOTED: 'دارای پیشنهاد',
  CONVERTED: 'تبدیل‌شده به سفارش',
  EXPIRED: 'منقضی',
  UNFULFILLED: 'تأمین‌نشده',
  CANCELLED: 'لغو شده',
};

const URGENCY_FA: Record<string, string> = { normal: 'عادی', urgent: 'فوری', critical: 'بحرانی' };

export function RequestsPage(): JSX.Element {
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['requests'], queryFn: () => api.requests.list({ pageSize: 20 }) });

  return (
    <AppShell
      title="درخواست‌های تأمین"
      tabs={MECHANIC_TABS}
      headerExtra={
        <button type="button" className="cp-btn-ghost !bg-white/15 !text-white" onClick={() => navigate('/mechanic/requests/new')}>
          + جدید
        </button>
      }
    >
      {list.isLoading ? <Spinner /> : null}
      {list.isError ? <ErrorBox message="دریافت درخواست‌ها ممکن نشد" onRetry={() => list.refetch()} /> : null}
      {list.data && list.data.items.length === 0 ? (
        <EmptyState
          title="درخواستی ثبت نکرده‌اید"
          hint="با ثبت درخواست قیمت، از چند فروشنده به‌صورت هم‌زمان پیشنهاد بگیرید."
          action={
            <button type="button" className="cp-btn-primary mt-2" onClick={() => navigate('/mechanic/requests/new')}>
              ثبت درخواست قیمت
            </button>
          }
        />
      ) : null}
      <div className="space-y-2">
        {(list.data?.items ?? []).map((request) => (
          <button key={request.id} type="button" className="cp-card w-full text-start" onClick={() => navigate(`/mechanic/requests/${request.id}`)}>
            <div className="flex items-center justify-between">
              <b className="text-sm">{request.titleFa}</b>
              <span className="cp-chip bg-slate-100 text-slate-700">{REQUEST_STATUS_FA[request.status] ?? request.status}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {request.quantity} عدد · فوریت {URGENCY_FA[String(request.urgency)] ?? String(request.urgency)} · {request.quoteCount} پیشنهاد
            </p>
            <p className="mt-1 text-[11px] text-muted">مهلت: {dateFa(request.deadlineAt)}</p>
          </button>
        ))}
      </div>
    </AppShell>
  );
}

export function RequestNewPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as { partNameFa?: string };
  const [titleFa, setTitleFa] = useState(state.partNameFa ?? '');
  const [quantity, setQuantity] = useState('1');
  const [urgency, setUrgency] = useState('normal');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: () => api.workshops.vehicles() });
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api.workshops.addresses() });
  const [vehicleId, setVehicleId] = useState('');
  const [addressId, setAddressId] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.requests.create({
        titleFa,
        partNameFa: titleFa,
        quantity: Number(quantity) || 1,
        urgency,
        description: description || undefined,
        vehicleId: vehicleId || undefined,
        deliveryAddressId: addressId || undefined,
      }),
    onSuccess: (request) => navigate(`/mechanic/requests/${request.id}`, { replace: true }),
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت درخواست ناموفق بود'),
  });

  return (
    <AppShell title="ثبت درخواست قیمت" tabs={MECHANIC_TABS}>
      <div className="cp-card space-y-3">
        <Field label="عنوان قطعه (الزامی)">
          <input className="cp-field" value={titleFa} onChange={(e) => setTitleFa(e.target.value)} placeholder="مثلاً: واتر پمپ پراید" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تعداد">
            <input className="cp-field" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          </Field>
          <Field label="فوریت">
            <select className="cp-field" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
              <option value="normal">عادی</option>
              <option value="urgent">فوری</option>
              <option value="critical">بحرانی</option>
            </select>
          </Field>
        </div>
        <Field label="خودرو (اختیاری)">
          <select className="cp-field" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">بدون خودرو</option>
            {(vehicles.data ?? []).map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {String((vehicle.model as { nameFa?: string } | undefined)?.nameFa ?? 'خودرو')} {String(vehicle.nickname ?? '')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="نشانی تحویل (اختیاری)">
          <select className="cp-field" value={addressId} onChange={(e) => setAddressId(e.target.value)}>
            <option value="">انتخاب نشانی</option>
            {(addresses.data ?? []).map((address) => (
              <option key={address.id} value={address.id}>
                {address.city} — {address.addressText.slice(0, 40)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="توضیحات">
          <textarea className="cp-field min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error ? <ErrorBox message={error} /> : null}
        <button type="button" className="cp-btn-primary w-full" disabled={create.isPending || titleFa.trim().length < 2} onClick={() => create.mutate()}>
          {create.isPending ? 'در حال ثبت…' : 'ثبت درخواست و ارسال برای فروشندگان'}
        </button>
      </div>
    </AppShell>
  );
}

export function RequestDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const detail = useQuery({ queryKey: ['request', id], queryFn: () => api.requests.quotes(id!), enabled: Boolean(id) });

  const accept = useMutation({
    mutationFn: (quoteId: string) => api.requests.acceptQuote(quoteId, idempotencyKey('accept-quote')),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/mechanic/orders/${order.id}`);
    },
    onError: (err) => setAcceptError(err instanceof ApiClientError ? err.userMessage : 'پذیرش پیشنهاد ناموفق بود'),
  });

  const request = detail.data?.request;
  const quotes = detail.data?.quotes ?? [];
  const countdown = request ? countdownFa(request.deadlineAt) : null;

  return (
    <AppShell title="جزئیات درخواست" tabs={MECHANIC_TABS}>
      {detail.isLoading ? <Spinner /> : null}
      {detail.isError ? <ErrorBox message="دریافت درخواست ممکن نشد" onRetry={() => detail.refetch()} /> : null}
      {request ? (
        <div className="cp-card space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">{request.titleFa}</h2>
            <span className="cp-chip bg-slate-100 text-slate-700">{REQUEST_STATUS_FA[request.status] ?? request.status}</span>
          </div>
          <p className="text-xs text-muted">
            {request.quantity} عدد · کد {request.code} · ثبت {dateFa(request.createdAt, false)}
          </p>
          {countdown && !countdown.expired ? (
            <p className="rounded-xl bg-emerald-50 p-2 text-xs text-emerald-800">⏱ مهلت دریافت پیشنهاد: {countdown.text}</p>
          ) : (
            <p className="rounded-xl bg-slate-100 p-2 text-xs text-muted">مهلت دریافت پیشنهاد به پایان رسیده است.</p>
          )}
        </div>
      ) : null}

      {acceptError ? <ErrorBox message={acceptError} /> : null}

      <Section title={`پیشنهادهای دریافتی (${quotes.length})`}>
        {quotes.length === 0 && detail.data ? <EmptyState title="هنوز پیشنهادی ثبت نشده است" hint="فروشندگان منتخب در حال بررسی درخواست شما هستند." /> : null}
        <div className="space-y-3">
          {quotes.map((row: QuoteComparisonRow) => (
            <article key={row.quoteId} className="cp-card space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <b className="text-sm">{row.sellerName ?? 'فروشنده'}</b>
                  <p className="text-xs text-muted">{row.branchName ?? ''}</p>
                </div>
                <div className="text-left">
                  <span className="cp-chip bg-indigo-100 text-indigo-800">رتبه {row.rank}</span>
                  <p className="mt-1 text-base font-extrabold text-primary">{formatToman(row.total)}</p>
                </div>
              </div>
              {row.warnings?.length ? (
                <ul className="rounded-xl bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
                  {row.warnings.map((warning) => (
                    <li key={warning}>⚠️ {warning}</li>
                  ))}
                </ul>
              ) : null}
              <button type="button" className="text-xs font-semibold text-primary" onClick={() => setExpanded(expanded === row.quoteId ? null : row.quoteId)}>
                {expanded === row.quoteId ? 'بستن' : 'جزئیات امتیازدهی'}
              </button>
              {expanded === row.quoteId ? (
                <ul className="space-y-1 rounded-xl bg-slate-50 p-2 text-[11px]">
                  {row.explanation.factors.map((factor) => (
                    <li key={factor.key} className="flex justify-between">
                      <span>{factor.fa}</span>
                      <b className="tabular-nums">{factor.contribution}</b>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                className="cp-btn-primary w-full"
                disabled={accept.isPending || request?.status !== 'QUOTED'}
                onClick={() => accept.mutate(row.quoteId)}
              >
                پذیرش این پیشنهاد و ثبت سفارش
              </button>
            </article>
          ))}
        </div>
      </Section>
    </AppShell>
  );
}
