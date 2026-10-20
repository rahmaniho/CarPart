import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { compactMoney, dateFa, formatToman, toFaDigits } from '../../lib/format';
import { Spinner, StatCard } from '../../components/ui';
import { SellerShell } from './SellerShell';

const PAYOUT_FA: Record<string, string> = {
  PENDING: 'در انتظار', READY: 'آماده تسویه', PROCESSING: 'در حال تسویه', PAID: 'تسویه شد', FAILED: 'ناموفق', CANCELLED: 'لغو شد',
};

/** امور مالی فروشنده */
export default function SellerFinance(): JSX.Element {
  const summary = useQuery({ queryKey: ['seller-finance'], queryFn: () => api.sellers.financeSummary() });
  const rate = useQuery({ queryKey: ['seller-rate'], queryFn: () => api.sellers.commissionRate() });
  const payouts = useQuery({ queryKey: ['seller-payouts'], queryFn: () => api.sellers.payouts({ pageSize: 10 }) });
  const data = (summary.data ?? {}) as Record<string, number>;

  return (
    <SellerShell
      title="امور مالی"
      headerExtra={rate.data ? <span className="text-xs text-white/80">کمیسیون: {toFaDigits(String((rate.data as { percent?: number }).percent ?? ''))}٪</span> : undefined}
    >
      {summary.isLoading ? <Spinner /> : null}
      <section className="grid grid-cols-2 gap-2">
        <StatCard label="درآمد ناخالص" value={compactMoney(Number(data.grossRevenue ?? data.revenue ?? 0))} tone="money" />
        <StatCard label="کمیسیون پلتفرم" value={compactMoney(Number(data.commission ?? data.platformCommission ?? 0))} />
        <StatCard label="درآمد خالص" value={compactMoney(Number(data.netRevenue ?? data.sellerNet ?? 0))} tone="money" />
        <StatCard label="پرداخت‌شده" value={compactMoney(Number(data.paidOut ?? 0))} />
      </section>

      <div className="space-y-2">
        {(payouts.data?.items ?? []).map((row) => (
          <article key={String(row.id)} className="cp-card flex items-center justify-between">
            <div>
              <b className="text-sm">{formatToman(Number(row.netAmount ?? 0))}</b>
              <p className="text-xs text-muted">{dateFa(String(row.createdAt ?? ''), false)}</p>
            </div>
            <span className="cp-chip bg-slate-100 text-slate-700">{PAYOUT_FA[String(row.status)] ?? String(row.status)}</span>
          </article>
        ))}
        {payouts.data?.items.length === 0 ? <p className="cp-card text-center text-xs text-muted">تسویه‌ای ثبت نشده است.</p> : null}
      </div>
    </SellerShell>
  );
}
