import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type RequestRow } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa, formatToman, toFaDigits } from '../../lib/format';
import { SellerLayout } from '../../components/SellerLayout';
import { DataTable, ErrorBox, PageHeader, Spinner, StatCard } from '../../components/ui';

/** درخواست‌های قیمت هدف‌گیری‌شده + ثبت پیشنهاد + پیشنهادهای من */
export default function SellerRequests(): JSX.Element {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [unitPrice, setUnitPrice] = useState('');
  const [preparationMinutes, setPreparationMinutes] = useState('30');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [tab, setTab] = useState<'open' | 'mine'>('open');

  const requests = useQuery({ queryKey: ['seller-requests'], queryFn: () => api.sellers.requests({ pageSize: 20 }) });
  const myQuotes = useQuery({ queryKey: ['seller-quotes'], queryFn: () => api.sellers.myQuotes({ pageSize: 20 }), enabled: tab === 'mine' });
  const quoteStats = useQuery({ queryKey: ['seller-quote-stats'], queryFn: () => api.sellers.quoteStats() });

  const submitQuote = useMutation({
    mutationFn: () =>
      api.sellers.submitQuote(selected!.id, {
        items: [{ sellerProductId: '', quantity: Number(selected!.quantity) || 1, unitPrice: Number(unitPrice) }],
        preparationMinutes: Number(preparationMinutes) || 30,
        note: note || undefined,
      }),
    onSuccess: () => {
      setOk('پیشنهاد شما ثبت شد');
      setError(null);
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ['seller-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['seller-quotes'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت پیشنهاد ناموفق بود (مهلت گذشته یا محصول مرتبط ندارید)'),
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => api.sellers.withdrawQuote(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['seller-quotes'] }),
    onError: () => setError('انصراف از پیشنهاد ممکن نشد'),
  });

  return (
    <SellerLayout>
      <PageHeader title="درخواست‌های قیمت (RFQ)" subtitle="درخواست‌های مشتریان در محدوده شما — پیشنهاد ثبت کنید" />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="پیشنهادهای ثبت‌شده" value={toFaDigits(Number(quoteStats.data?.submitted ?? 0))} />
        <StatCard label="پذیرفته‌شده" value={toFaDigits(Number(quoteStats.data?.accepted ?? 0))} tone="primary" />
        <StatCard label="در انتظار پاسخ" value={toFaDigits(Number(quoteStats.data?.pending ?? 0))} />
        <StatCard label="نرخ برد" value={quoteStats.data?.winRate !== undefined ? `${toFaDigits(Math.round(Number(quoteStats.data.winRate)))}٪` : '—'} />
      </section>

      <div className="flex gap-2">
        <button type="button" className={tab === 'open' ? 'cp-btn-primary' : 'cp-btn-ghost'} onClick={() => setTab('open')}>درخواست‌های باز</button>
        <button type="button" className={tab === 'mine' ? 'cp-btn-primary' : 'cp-btn-ghost'} onClick={() => setTab('mine')}>پیشنهادهای من</button>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</div> : null}

      {tab === 'open' ? (
        <>
          {requests.isLoading ? <Spinner /> : null}
          <DataTable headers={['عنوان', 'تعداد', 'فوریت', 'مهلت', 'وضعیت', 'عملیات']}>
            {(requests.data?.items ?? []).map((request) => (
              <tr key={request.id}>
                <td className="font-semibold">{request.titleFa}</td>
                <td className="tabular-nums">{toFaDigits(request.quantity)}</td>
                <td>{String(request.urgency === 'urgent' ? 'فوری' : request.urgency === 'critical' ? 'بحرانی' : 'عادی')}</td>
                <td className="text-xs text-muted">{dateFa(request.deadlineAt)}</td>
                <td className="text-xs">{String(request.status)}</td>
                <td>
                  <button type="button" className="cp-btn-primary !py-1 text-xs" onClick={() => setSelected(request)}>
                    ثبت پیشنهاد
                  </button>
                </td>
              </tr>
            ))}
            {requests.data?.items.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-xs text-muted">درخواست بازی نیست</td></tr>
            ) : null}
          </DataTable>
          {selected ? (
            <div className="cp-card space-y-3">
              <h3 className="text-sm font-bold">پیشنهاد برای «{selected.titleFa}» ({toFaDigits(selected.quantity)} عدد)</h3>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">قیمت هر واحد (تومان)</span>
                  <input className="cp-field" inputMode="numeric" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value.replace(/\D/g, ''))} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">زمان آماده‌سازی (دقیقه)</span>
                  <input className="cp-field" inputMode="numeric" value={preparationMinutes} onChange={(e) => setPreparationMinutes(e.target.value.replace(/\D/g, ''))} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">توضیح (اختیاری)</span>
                  <input className="cp-field" value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
              </div>
              {unitPrice ? (
                <p className="text-xs text-muted">
                  مبلغ کل پیشنهادی: <b className="text-ink">{formatToman(Number(unitPrice) * (Number(selected.quantity) || 1))}</b>
                </p>
              ) : null}
              <div className="flex gap-2">
                <button type="button" className="cp-btn-primary" disabled={submitQuote.isPending || !unitPrice} onClick={() => submitQuote.mutate()}>
                  ارسال پیشنهاد
                </button>
                <button type="button" className="cp-btn-ghost" onClick={() => setSelected(null)}>
                  انصراف
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {myQuotes.isLoading ? <Spinner /> : null}
          <DataTable headers={['درخواست', 'مبلغ کل', 'آماده‌سازی', 'وضعیت', 'اعتبار تا', 'عملیات']}>
            {(myQuotes.data?.items ?? []).map((quote) => (
              <tr key={quote.id}>
                <td className="text-xs">{String((quote as { requestTitle?: string }).requestTitle ?? quote.requestId)}</td>
                <td className="tabular-nums">{formatToman(Number(quote.total ?? 0))}</td>
                <td className="tabular-nums">{toFaDigits(Number(quote.preparationMinutes ?? 0))} دقیقه</td>
                <td className="text-xs">{String(quote.status)}</td>
                <td className="text-xs text-muted">{quote.validUntil ? dateFa(String(quote.validUntil)) : '—'}</td>
                <td>
                  {String(quote.status) === 'SUBMITTED' ? (
                    <button type="button" className="cp-btn-ghost !py-1 text-xs text-red-700" disabled={withdraw.isPending} onClick={() => withdraw.mutate(quote.id)}>
                      انصراف
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {myQuotes.data?.items.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-xs text-muted">پیشنهادی ثبت نکرده‌اید</td></tr>
            ) : null}
          </DataTable>
        </>
      )}
    </SellerLayout>
  );
}
