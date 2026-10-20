import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toFaDigits } from '../../lib/format';
import { PublicLayout } from '../../components/PublicLayout';
import { ErrorBox, Section, Spinner, StatusChip } from '../../components/ui';

/** صفحه عمومی فروشگاه — فقط فروشگاه‌های تأییدشده نمایش داده می‌شوند و اطلاعات حساس پنهان است */
export default function StorePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const store = useQuery({ queryKey: ['store', id], queryFn: () => api.sellers.storePublic(id!), enabled: Boolean(id) });

  const data = store.data as
    | {
        storeName?: string;
        city?: string;
        description?: string;
        ratingAvg?: number;
        ratingCount?: number;
        branches?: Array<{ id: string; name: string; city?: string; addressText?: string }>;
      }
    | undefined;

  return (
    <PublicLayout>
      {store.isLoading ? <Spinner /> : null}
      {store.isError ? <ErrorBox message="فروشگاه یافت نشد یا هنوز تأیید نشده است." onRetry={() => store.refetch()} /> : null}
      {data ? (
        <>
          <section className="cp-card">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-2xl">🏪</div>
              <div>
                <h1 className="text-lg font-extrabold">{data.storeName}</h1>
                <p className="text-xs text-muted">
                  {data.city ?? ''} · امتیاز {toFaDigits(Number(data.ratingAvg ?? 0))} از {toFaDigits(Number(data.ratingCount ?? 0))} نظر
                </p>
                <div className="mt-1">
                  <StatusChip status="APPROVED" />
                </div>
              </div>
            </div>
            {data.description ? <p className="mt-3 text-xs leading-6 text-muted">{data.description}</p> : null}
          </section>

          <Section title="شعبه‌ها">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {(data.branches ?? []).map((branch) => (
                <div key={branch.id} className="cp-card">
                  <b className="text-sm">{branch.name}</b>
                  <p className="mt-1 text-xs text-muted">{branch.addressText ?? ''}</p>
                </div>
              ))}
              {(data.branches ?? []).length === 0 ? <p className="text-xs text-muted">شعبه‌ای ثبت نشده است.</p> : null}
            </div>
          </Section>
        </>
      ) : null}
    </PublicLayout>
  );
}
