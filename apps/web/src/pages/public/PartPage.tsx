import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useSessionStore } from '../../lib/session';
import { PublicLayout } from '../../components/PublicLayout';
import { OfferCard } from '../../components/OfferCard';
import { EmptyState, ErrorBox, Section, Spinner } from '../../components/ui';

/** جزئیات قطعه + همه پیشنهادهای فروشندگان برای آن */
export default function PartPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);

  const part = useQuery({ queryKey: ['part', id], queryFn: () => api.catalog.part(id!), enabled: Boolean(id) });
  const partName = String((part.data as { nameFa?: string } | undefined)?.nameFa ?? '');
  const offers = useQuery({ queryKey: ['part-offers', partName], queryFn: () => api.catalog.search({ q: partName, pageSize: 30 }), enabled: Boolean(partName) });

  return (
    <PublicLayout>
      {part.isLoading ? <Spinner /> : null}
      {part.isError ? <ErrorBox message="دریافت اطلاعات قطعه ممکن نشد" onRetry={() => part.refetch()} /> : null}
      {part.data ? (
        <section className="cp-card">
          <h1 className="text-lg font-extrabold">{String((part.data as { nameFa?: string }).nameFa ?? 'قطعه')}</h1>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted md:grid-cols-4">
            <div>برند: <b className="text-ink">{String((part.data as { brandNameFa?: string }).brandNameFa ?? '—')}</b></div>
            <div>دسته‌بندی: <b className="text-ink">{String((part.data as { categoryFa?: string }).categoryFa ?? '—')}</b></div>
            <div>کد فنی: <b dir="ltr">{String((part.data as { technicalCode?: string }).technicalCode ?? '—')}</b></div>
            <div>کد OEM: <b dir="ltr">{String((part.data as { oemCode?: string }).oemCode ?? '—')}</b></div>
          </div>
          {part.data.descriptionFa ? <p className="mt-3 text-xs leading-6">{String(part.data.descriptionFa)}</p> : null}
        </section>
      ) : null}

      <Section title={`پیشنهادهای فروشندگان (${offers.data?.meta.total ?? 0})`}>
        {offers.isLoading ? <Spinner /> : null}
        {offers.data && offers.data.items.length === 0 ? <EmptyState title="فعلاً پیشنهادی برای این قطعه ثبت نشده است" /> : null}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {(offers.data?.items ?? []).map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              onBuy={(item) => {
                if (!user) {
                  navigate('/login', { state: { from: `/parts/${id}` } });
                  return;
                }
                navigate('/account/checkout', { state: { offer: item } });
              }}
            />
          ))}
        </div>
      </Section>
    </PublicLayout>
  );
}
