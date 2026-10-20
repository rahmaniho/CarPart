import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type RequestRow } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa, formatToman, toFaDigits } from '../../lib/format';
import { ErrorBox, Field, Spinner, StatCard } from '../../components/ui';
import { SellerShell } from './SellerShell';

/** درخواست‌های قیمت + ثبت/انصراف پیشنهاد */
export default function SellerRequests(): JSX.Element {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [unitPrice, setUnitPrice] = useState('');
  const [preparationMinutes, setPreparationMinutes] = useState('30');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

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
      setUnitPrice('');
      void qc.invalidateQueries({ queryKey: ['seller-requests'] });
      void qc.invalidateQueries({ queryKey: ['seller-quotes'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت پیشنهاد ناموفق (مهلت گذشته یا محصول مرتبط ندارید)'),
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => api.sellers.withdrawQuote(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['seller-quotes'] }),
    onError: () => setError('انصراف ممکن نشد'),
  });

  return (
    <SellerShell title="درخواست‌های قیمت">
      <section className="grid grid-cols-3 gap-2">
        <StatCard label="ثبت‌شده" value={toFaDigits(Number(quoteStats.data?.submitted ?? 0))} />
        <StatCard label="پذیرفته" value={toFaDigits(Number(quoteStats.data?.accepted ?? 0))} tone="primary" />
        <StatCard label="نرخ برد" value={quoteStats.data?.winRate !== undefined ? `${toFaDigits(Math.round(Number(quoteStats.data.winRate)))}٪` : '—'} />
      </section>

      <div className="flex gap-2">
        <button type="button" className={tab === 'open' ? 'cp-btn-primary' : 'cp-btn-ghost'} onClick={() => setTab('open')}>
          درخواست‌های باز
        </button>
        <button type="button" className={tab === 'mine' ? 'cp-btn-primary' : 'cp-btn-ghost'} onClick={() => setTab('mine')}>
          پیشنهادهای من
        </button>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {ok ? <div className="cp-card border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{ok}</div> : null}

      {tab === 'open' ? (
        <>
          {requests.isLoading ? <Spinner /> : null}
          <div className="space-y-2">
            {(requests.data?.items ?? []).map((request) => (
              <article key={request.id} className="cp-card">
                <div className="flex items-center justify-between">
                  <b className="text-sm">{request.titleFa}</b>
                  <span className="cp-chip bg-slate-100 text-slate-700">{toFaDigits(request.quantity)} عدد</span>
                </div>
                <p className="mt-1 text-xs text-muted">مهلت: {dateFa(request.deadlineAt)}</p>
                {selected?.id === request.id ? (
                  <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-2">
                    <Field label="قیمت هر واحد (تومان)">
                      <input className="cp-field !py-1.5 text-xs" inputMode="numeric" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value.replace(/\D/g, ''))} />
                    </Field>
                    <Field label="زمان آماده‌سازی (دقیقه)">
                      <input className="cp-field !py-1.5 text-xs" inputMode="numeric" value={preparationMinutes} onChange={(e) => setPreparationMinutes(e.target.value.replace(/\D/g, ''))} />
                    </Field>
                    <Field label="توضیح (اختیاری)">
                      <input className="cp-field !py-1.5 text-xs" value={note} onChange={(e) => setNote(e.target.value)} />
                    </Field>
                    {unitPrice ? (
                      <p className="text-[11px] text-muted">
                        مبلغ کل: <b className="text-ink">{formatToman(Number(unitPrice) * (Number(request.quantity) || 1))}</b>
                      </p>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" className="cp-btn-primary !py-1.5 text-xs" disabled={submitQuote.isPending || !unitPrice} onClick={() => submitQuote.mutate()}>
                        ارسال پیشنهاد
                      </button>
                      <button type="button" className="cp-btn-ghost !py-1.5 text-xs" onClick={() => setSelected(null)}>
                        انصراف
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="cp-btn-primary mt-2 w-full !py-1.5 text-xs" onClick={() => setSelected(request)}>
                    ثبت پیشنهاد
                  </button>
                )}
              </article>
            ))}
            {requests.data?.items.length === 0 ? <p className="cp-card text-center text-xs text-muted">درخواست بازی نیست.</p> : null}
          </div>
        </>
      ) : (
        <>
          {myQuotes.isLoading ? <Spinner /> : null}
          <div className="space-y-2">
            {(myQuotes.data?.items ?? []).map((quote) => (
              <article key={quote.id} className="cp-card">
                <div className="flex items-center justify-between">
                  <b className="text-sm">{formatToman(Number(quote.total ?? 0))}</b>
                  <span className="cp-chip bg-slate-100 text-slate-700">{String(quote.status)}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  آماده‌سازی: {toFaDigits(Number(quote.preparationMinutes ?? 0))} دقیقه · اعتبار: {quote.validUntil ? dateFa(String(quote.validUntil)) : '—'}
                </p>
                {String(quote.status) === 'SUBMITTED' ? (
                  <button type="button" className="cp-btn-ghost mt-2 w-full !py-1.5 text-xs text-red-700" disabled={withdraw.isPending} onClick={() => withdraw.mutate(quote.id)}>
                    انصراف از پیشنهاد
                  </button>
                ) : null}
              </article>
            ))}
            {myQuotes.data?.items.length === 0 ? <p className="cp-card text-center text-xs text-muted">پیشنهادی ثبت نکرده‌اید.</p> : null}
          </div>
        </>
      )}
    </SellerShell>
  );
}
