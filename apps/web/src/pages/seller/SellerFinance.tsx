import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { compactMoney, dateFa, formatToman, toFaDigits } from '../../lib/format';
import { SellerLayout } from '../../components/SellerLayout';
import { DataTable, PageHeader, Spinner, StatCard } from '../../components/ui';

const PAYOUT_FA: Record<string, string> = {
  PENDING: 'در انتظار', READY: 'آماده تسویه', PROCESSING: 'در حال تسویه', PAID: 'تسویه شد', FAILED: 'ناموفق', CANCELLED: 'لغو شد',
};

/** امور مالی فروشنده: خلاصه درآمد، کمیسیون‌ها و تسویه‌ها */
export default function SellerFinance(): JSX.Element {
  const summary = useQuery({ queryKey: ['seller-finance'], queryFn: () => api.sellers.financeSummary() });
  const rate = useQuery({ queryKey: ['seller-rate'], queryFn: () => api.sellers.commissionRate() });
  const commissions = useQuery({ queryKey: ['seller-commissions'], queryFn: () => api.sellers.commissions({ pageSize: 15 }) });
  const payouts = useQuery({ queryKey: ['seller-payouts'], queryFn: () => api.sellers.payouts({ pageSize: 10 }) });

  const data = (summary.data ?? {}) as Record<string, number>;

  return (
    <SellerLayout>
      <PageHeader
        title="امور مالی"
        subtitle={rate.data ? `نرخ کمیسیون شما: ${toFaDigits(String((rate.data as { percent?: number }).percent ?? ''))}٪ (قابل تنظیم توسط مدیر)` : undefined}
      />
      {summary.isLoading ? <Spinner /> : null}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="درآمد ناخالص" value={`${compactMoney(Number(data.grossRevenue ?? data.revenue ?? 0))} تومان`} tone="money" />
        <StatCard label="کمیسیون پلتفرم" value={`${compactMoney(Number(data.commission ?? data.platformCommission ?? 0))} تومان`} />
        <StatCard label="درآمد خالص" value={`${compactMoney(Number(data.netRevenue ?? data.sellerNet ?? 0))} تومان`} tone="money" />
        <StatCard label="تسویه‌های پرداخت‌شده" value={`${compactMoney(Number(data.paidOut ?? 0))} تومان`} />
      </section>

      <h2 className="text-sm font-bold">کمیسیون‌های اخیر</h2>
      <DataTable headers={['سفارش', 'مبلغ سفارش', 'کمیسیون', 'خالص شما', 'تاریخ']}>
        {(commissions.data?.items ?? []).map((row) => (
          <tr key={String(row.id)}>
            <td dir="ltr" className="text-xs">{String(row.orderCode ?? row.orderId ?? '—')}</td>
            <td className="tabular-nums">{formatToman(Number(row.orderAmount ?? row.grossAmount ?? 0))}</td>
            <td className="tabular-nums">{formatToman(Number(row.amount ?? row.commissionAmount ?? 0))}</td>
            <td className="tabular-nums">{formatToman(Number(row.netAmount ?? 0))}</td>
            <td className="text-xs text-muted">{dateFa(String(row.createdAt ?? ''), false)}</td>
          </tr>
        ))}
        {commissions.data?.items.length === 0 ? (
          <tr><td colSpan={5} className="text-center text-xs text-muted">هنوز کمیسیونی ثبت نشده است</td></tr>
        ) : null}
      </DataTable>

      <h2 className="text-sm font-bold">تسویه‌ها</h2>
      <DataTable headers={['کد', 'مبلغ خالص', 'وضعیت', 'تاریخ ثبت']}>
        {(payouts.data?.items ?? []).map((row) => (
          <tr key={String(row.id)}>
            <td dir="ltr" className="text-xs">{String(row.code ?? '—')}</td>
            <td className="tabular-nums">{formatToman(Number(row.netAmount ?? 0))}</td>
            <td><span className="cp-chip bg-slate-100 text-slate-700">{PAYOUT_FA[String(row.status)] ?? String(row.status)}</span></td>
            <td className="text-xs text-muted">{dateFa(String(row.createdAt ?? ''), false)}</td>
          </tr>
        ))}
        {payouts.data?.items.length === 0 ? (
          <tr><td colSpan={4} className="text-center text-xs text-muted">تسویه‌ای ثبت نشده است</td></tr>
        ) : null}
      </DataTable>
    </SellerLayout>
  );
}
