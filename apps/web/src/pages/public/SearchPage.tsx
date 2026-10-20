import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { SearchOffer } from '@carpart/api-client';
import { api } from '../../lib/api';
import { useSessionStore } from '../../lib/session';
import { PublicLayout } from '../../components/PublicLayout';
import { OfferCard } from '../../components/OfferCard';
import { EmptyState, ErrorBox, Spinner } from '../../components/ui';

/** نتایج جست‌وجوی عمومی — رتبه‌بندی شفاف و هشدارهای سازگاری */
export default function SearchPage(): JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const q = params.get('q') ?? '';
  const [sort, setSort] = useState('rank');

  const query = useQuery({
    queryKey: ['search', q, sort],
    queryFn: () => api.catalog.search({ q, sort, pageSize: 30 }),
    enabled: Boolean(q),
  });

  function guardedBuy(offer: SearchOffer): void {
    if (!user) {
      navigate('/login', { state: { from: `/parts/${String(offer.part?.id ?? '')}` } });
      return;
    }
    navigate('/account/checkout', { state: { offer } });
  }

  return (
    <PublicLayout>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-extrabold">
          نتایج جست‌وجو برای «{q}» {query.data ? <span className="text-sm font-normal text-muted">({query.data.meta.total} پیشنهاد)</span> : null}
        </h1>
        <select className="cp-field !w-auto" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="مرتب‌سازی">
          <option value="rank">مرتب‌سازی: بهترین رتبه</option>
          <option value="price">ارزان‌ترین</option>
          <option value="deliveryFee">کمترین هزینه ارسال</option>
        </select>
      </div>

      {query.isLoading ? <Spinner /> : null}
      {query.isError ? <ErrorBox message="دریافت نتایج ممکن نشد" onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.items.length === 0 ? (
        <EmptyState title="نتیجه‌ای پیدا نشد" hint="عبارت دیگری امتحان کنید یا وارد شوید و درخواست قیمت ثبت کنید." />
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {(query.data?.items ?? []).map((offer) => (
          <OfferCard key={offer.id} offer={offer} onBuy={guardedBuy} onRequestQuote={(item) => navigate(`/parts/${String(item.part?.id ?? '')}`)} />
        ))}
      </div>
    </PublicLayout>
  );
}
