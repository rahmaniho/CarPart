import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { SearchOffer } from '@carpart/api-client';
import { api } from '../../lib/api';
import { idempotencyKey } from '../../lib/hooks';
import { AppShell } from '../../components/AppShell';
import { EmptyState, ErrorBox, Money, Section, Spinner } from '../../components/ui';
import { MECHANIC_TABS } from './MechanicHome';

const QUALITY_FA: Record<string, string> = {
  genuine: 'اصلی',
  aftermarket_high: 'aftermarket درجه یک',
  aftermarket_standard: 'aftermarket استاندارد',
  used: 'دست‌دوم',
};

const COMPAT_FA: Record<string, string> = {
  exact: 'سازگاری دقیق',
  likely: 'احتمال سازگاری',
  unknown: 'سازگاری نامشخص',
  incompatible: 'ناسازگار',
};

export default function SearchPage(): JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['search', params.get('q')],
    queryFn: () => api.catalog.search({ q: params.get('q') ?? '', pageSize: 20 }),
    enabled: Boolean(params.get('q')),
  });

  async function buyNow(offer: SearchOffer): Promise<void> {
    setBuying(offer.sellerProductId);
    setBuyError(null);
    try {
      const order = await api.orders.create(
        { items: [{ sellerProductId: offer.sellerProductId, quantity: 1 }], urgency: 'normal' },
        idempotencyKey('order'),
      );
      navigate(`/mechanic/orders/${order.id}`);
    } catch (error) {
      setBuyError(error instanceof Error ? error.message : 'ثبت سفارش ناموفق بود');
    } finally {
      setBuying(null);
    }
  }

  return (
    <AppShell title="جست‌وجوی قطعه" tabs={MECHANIC_TABS}>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(`/mechanic/search?q=${encodeURIComponent(q)}`);
        }}
      >
        <input className="cp-field" value={q} onChange={(event) => setQ(event.target.value)} placeholder="نام قطعه، کد فنی یا OEM" />
        <button type="submit" className="cp-btn-primary shrink-0">
          جست‌وجو
        </button>
      </form>

      {buyError ? <ErrorBox message={buyError} /> : null}

      {query.isLoading ? <Spinner /> : null}
      {query.isError ? <ErrorBox message="دریافت نتایج ممکن نشد" onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.items.length === 0 ? (
        <EmptyState title="نتیجه‌ای پیدا نشد" hint="عبارت دیگری امتحان کنید یا درخواست قیمت ثبت کنید." action={
          <button type="button" className="cp-btn-primary mt-2" onClick={() => navigate('/mechanic/requests/new', { state: { partNameFa: params.get('q') ?? '' } })}>
            ثبت درخواست قیمت
          </button>
        } />
      ) : null}

      <Section title={query.data ? `${query.data.meta.total} پیشنهاد یافت شد` : 'نتایج'}>
        <div className="space-y-3">
          {(query.data?.items ?? []).map((offer) => (
            <article key={offer.id} className="cp-card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold leading-6">{String(offer.part?.nameFa ?? 'قطعه')}</h3>
                  <p className="text-xs text-muted">
                    {offer.seller.name} · {offer.seller.branchName} · {offer.seller.city}
                  </p>
                </div>
                <div className="text-left">
                  <Money amount={offer.price} className="text-base font-extrabold text-primary" />
                  <p className="mt-0.5 text-[11px] text-muted">موجودی: {offer.stock}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="cp-chip bg-slate-100 text-slate-700">{QUALITY_FA[offer.quality] ?? offer.quality}</span>
                <span
                  className={`cp-chip ${
                    offer.compatibility.level === 'exact'
                      ? 'bg-emerald-100 text-emerald-800'
                      : offer.compatibility.level === 'incompatible'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {COMPAT_FA[offer.compatibility.level] ?? offer.compatibility.level}
                </span>
                <span className="cp-chip bg-slate-100 text-slate-700">ارسال: {offer.deliveryFee > 0 ? `${offer.deliveryFee.toLocaleString('fa-IR')} تومان` : 'رایگان'}</span>
                <span className="cp-chip bg-indigo-100 text-indigo-800">امتیاز رتبه‌بندی: {Math.round(offer.rank.total)}</span>
              </div>

              {offer.warnings.length ? (
                <ul className="space-y-1 rounded-xl bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
                  {offer.warnings.map((warning) => (
                    <li key={warning}>⚠️ {warning}</li>
                  ))}
                </ul>
              ) : null}

              <button
                type="button"
                className="text-xs font-semibold text-primary"
                onClick={() => setExpanded(expanded === offer.id ? null : offer.id)}
              >
                {expanded === offer.id ? 'بستن جزئیات رتبه‌بندی' : 'چرا این رتبه؟ (رتبه‌بندی شفاف)'}
              </button>
              {expanded === offer.id ? (
                <ul className="space-y-1 rounded-xl bg-slate-50 p-2 text-[11px] leading-5">
                  {offer.rank.factors.map((factor) => (
                    <li key={factor.key} className="flex items-center justify-between gap-2">
                      <span>
                        {factor.fa} <span className="text-muted">(وزن {factor.weight})</span>
                      </span>
                      <b className="tabular-nums">{factor.contribution}</b>
                    </li>
                  ))}
                  <li className="border-t border-line pt-1 text-[10px] text-muted">
                    کمیسیون فروشنده هرگز در رتبه‌بندی اثر ندارد؛ امتیاز فقط از معیارهای فوق ساخته می‌شود.
                  </li>
                </ul>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="cp-btn-primary"
                  disabled={offer.stock <= 0 || buying === offer.sellerProductId}
                  onClick={() => buyNow(offer)}
                >
                  {buying === offer.sellerProductId ? 'در حال ثبت…' : 'خرید مستقیم'}
                </button>
                <button
                  type="button"
                  className="cp-btn-ghost"
                  onClick={() => navigate('/mechanic/requests/new', { state: { partNameFa: String(offer.part?.nameFa ?? ''), sellerProductId: offer.sellerProductId } })}
                >
                  استعلام قیمت
                </button>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </AppShell>
  );
}
