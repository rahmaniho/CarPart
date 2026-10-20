import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { dateFa, formatToman, toFaDigits } from '../../lib/format';
import { AppShell } from '../../components/AppShell';
import { EmptyState, Section, Spinner } from '../../components/ui';
import { COURIER_TABS } from './CourierHome';

const PAYOUT_FA: Record<string, string> = {
  PENDING: 'در انتظار',
  READY: 'آماده تسویه',
  PROCESSING: 'در حال تسویه',
  PAID: 'تسویه شد',
  FAILED: 'ناموفق',
  CANCELLED: 'لغو شد',
};

/** درآمد و تسویه‌های پیک (داده واقعی از پایگاه‌داده) */
export default function CourierEarningsPage(): JSX.Element {
  const dashboard = useQuery({ queryKey: ['courier-dashboard'], queryFn: () => api.couriers.dashboard() });
  const payouts = useQuery({ queryKey: ['courier-payouts'], queryFn: () => api.finance.courierPayouts({ pageSize: 10 }) });
  const history = useQuery({ queryKey: ['missions', 'history'], queryFn: () => api.delivery.list({ status: 'history', pageSize: 5 }) });

  const stats = (dashboard.data ?? {}) as Record<string, number>;

  return (
    <AppShell title="درآمد و تسویه" tabs={COURIER_TABS}>
      {dashboard.isLoading ? <Spinner /> : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="cp-card text-center">
          <p className="text-xs text-muted">مأموریت‌های تحویل‌شده</p>
          <b className="text-xl">{toFaDigits(String(stats.deliveredCount ?? stats.delivered ?? 0))}</b>
        </div>
        <div className="cp-card text-center">
          <p className="text-xs text-muted">درآمد کل (تومان)</p>
          <b className="text-xl text-primary">{formatToman(Number(stats.totalEarnings ?? stats.courierShareTotal ?? 0))}</b>
        </div>
      </div>

      <Section title="آخرین تسویه‌ها">
        {payouts.isLoading ? <Spinner /> : null}
        {payouts.data && payouts.data.items.length === 0 ? <EmptyState title="هنوز تسویه‌ای ثبت نشده است" hint="پس از تحویل موفق مأموریت‌ها، تسویه شما محاسبه می‌شود." /> : null}
        <div className="space-y-2">
          {(payouts.data?.items ?? []).map((payout) => (
            <div key={String(payout.id)} className="cp-card flex items-center justify-between">
              <div>
                <b className="text-sm">{formatToman(Number(payout.netAmount ?? payout.amount ?? 0))}</b>
                <p className="text-xs text-muted">{dateFa(String(payout.createdAt ?? ''))}</p>
              </div>
              <span className="cp-chip bg-slate-100 text-slate-700">{PAYOUT_FA[String(payout.status)] ?? String(payout.status)}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="آخرین مأموریت‌ها">
        <div className="space-y-2">
          {(history.data?.items ?? []).map((mission) => (
            <div key={mission.id} className="cp-card flex items-center justify-between">
              <div>
                <b className="text-sm" dir="ltr">
                  {mission.code}
                </b>
                <p className="text-xs text-muted">{dateFa(String(mission.deliveredAt ?? mission.createdAt), false)}</p>
              </div>
              <b className="text-primary">{formatToman(mission.courierShare)}</b>
            </div>
          ))}
          {history.data && history.data.items.length === 0 ? <p className="text-xs text-muted">تاریخچه‌ای نیست.</p> : null}
        </div>
      </Section>
    </AppShell>
  );
}
