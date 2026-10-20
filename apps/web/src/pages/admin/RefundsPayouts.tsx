import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa, formatToman, toFaDigits } from '../../lib/format';
import { DataTable, ErrorBox, PageHeader, Spinner } from '../../components/ui';

const REFUND_FA: Record<string, string> = {
  REQUESTED: 'درخواست‌شده', APPROVED: 'تأییدشده', REJECTED: 'ردشده', EXECUTED: 'انجام‌شده', FAILED: 'ناموفق',
};
const PAYOUT_FA: Record<string, string> = {
  PENDING: 'در انتظار', READY: 'آماده تسویه', PROCESSING: 'در حال تسویه', PAID: 'تسویه شد', FAILED: 'ناموفق', CANCELLED: 'لغو شد',
};

/** مدیریت بازپرداخت‌ها: تأیید/رد/اجرا */
export function RefundsPage(): JSX.Element {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const refunds = useQuery({ queryKey: ['admin-refunds'], queryFn: () => api.admin.refunds({ pageSize: 30 }) });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' | 'execute' }) =>
      action === 'approve' ? api.admin.approveRefund(id) : action === 'reject' ? api.admin.rejectRefund(id, 'شرایط بازپرداخت برقرار نیست') : api.admin.executeRefund(id),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin-refunds'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'عملیات ناموفق بود'),
  });

  return (
    <>
      <PageHeader title="بازپرداخت‌ها" subtitle="تأیید، رد و اجرای بازپرداخت مشتریان — همه اقدامات در گزارش ممیزی ثبت می‌شود" />
      {error ? <ErrorBox message={error} /> : null}
      {refunds.isLoading ? <Spinner /> : null}
      <DataTable headers={['کد', 'سفارش', 'مبلغ', 'دلیل', 'وضعیت', 'تاریخ', 'عملیات']}>
        {(refunds.data?.items ?? []).map((row) => (
          <tr key={String(row.id)}>
            <td dir="ltr" className="text-xs">{String(row.code ?? row.id).slice(0, 8)}</td>
            <td dir="ltr" className="text-xs">{String(row.orderCode ?? row.orderId ?? '—').slice(0, 10)}</td>
            <td className="tabular-nums">{formatToman(Number(row.amount ?? 0))}</td>
            <td className="max-w-40 truncate text-xs" title={String(row.reason ?? '')}>{String(row.reason ?? '—')}</td>
            <td><span className="cp-chip bg-slate-100 text-slate-700">{REFUND_FA[String(row.status)] ?? String(row.status)}</span></td>
            <td className="text-xs text-muted">{dateFa(String(row.createdAt ?? ''), false)}</td>
            <td>
              <div className="flex flex-wrap gap-1.5">
                {String(row.status) === 'REQUESTED' ? (
                  <>
                    <button type="button" className="cp-btn !bg-emerald-50 !py-1 text-xs text-emerald-700" disabled={act.isPending} onClick={() => act.mutate({ id: String(row.id), action: 'approve' })}>
                      تأیید
                    </button>
                    <button type="button" className="cp-btn !bg-red-50 !py-1 text-xs text-red-700" disabled={act.isPending} onClick={() => act.mutate({ id: String(row.id), action: 'reject' })}>
                      رد
                    </button>
                  </>
                ) : null}
                {String(row.status) === 'APPROVED' ? (
                  <button type="button" className="cp-btn-primary !py-1 text-xs" disabled={act.isPending} onClick={() => act.mutate({ id: String(row.id), action: 'execute' })}>
                    اجرای بازپرداخت
                  </button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
        {refunds.data?.items.length === 0 ? (
          <tr><td colSpan={7} className="text-center text-xs text-muted">بازپرداختی ثبت نشده است</td></tr>
        ) : null}
      </DataTable>
    </>
  );
}

/** مدیریت تسویه‌های فروشنده/پیک */
export function PayoutsPage(): JSX.Element {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const payouts = useQuery({ queryKey: ['admin-payouts'], queryFn: () => api.admin.adminPayoutsList({ pageSize: 30 }) });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'ready' | 'paid' | 'failed' | 'cancel' }) => api.admin.payoutAction(id, action),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin-payouts'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'عملیات ناموفق بود'),
  });

  return (
    <>
      <PageHeader title="تسویه‌ها" subtitle="کنترل تسویه فروشندگان و پیک‌ها (بدون تسویه مضاعف)" />
      {error ? <ErrorBox message={error} /> : null}
      {payouts.isLoading ? <Spinner /> : null}
      <DataTable headers={['کد', 'گیرنده', 'مبلغ خالص', 'وضعیت', 'تاریخ', 'عملیات']}>
        {(payouts.data?.items ?? []).map((row) => (
          <tr key={String(row.id)}>
            <td dir="ltr" className="text-xs">{String(row.code ?? '—')}</td>
            <td className="text-xs">{String(row.recipientType ?? '')} {String(row.recipientName ?? row.recipientId ?? '').slice(0, 12)}</td>
            <td className="tabular-nums">{formatToman(Number(row.netAmount ?? 0))}</td>
            <td><span className="cp-chip bg-slate-100 text-slate-700">{PAYOUT_FA[String(row.status)] ?? String(row.status)}</span></td>
            <td className="text-xs text-muted">{dateFa(String(row.createdAt ?? ''), false)}</td>
            <td>
              <div className="flex flex-wrap gap-1.5">
                {String(row.status) === 'PENDING' ? (
                  <button type="button" className="cp-btn !bg-sky-50 !py-1 text-xs text-sky-700" disabled={act.isPending} onClick={() => act.mutate({ id: String(row.id), action: 'ready' })}>
                    آماده‌سازی
                  </button>
                ) : null}
                {String(row.status) === 'READY' ? (
                  <button type="button" className="cp-btn !bg-emerald-50 !py-1 text-xs text-emerald-700" disabled={act.isPending} onClick={() => act.mutate({ id: String(row.id), action: 'paid' })}>
                    پرداخت شد
                  </button>
                ) : null}
                {['PENDING', 'READY', 'PROCESSING'].includes(String(row.status)) ? (
                  <button type="button" className="cp-btn !bg-red-50 !py-1 text-xs text-red-700" disabled={act.isPending} onClick={() => act.mutate({ id: String(row.id), action: 'cancel' })}>
                    لغو
                  </button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
        {payouts.data?.items.length === 0 ? (
          <tr><td colSpan={6} className="text-center text-xs text-muted">تسویه‌ای ثبت نشده است</td></tr>
        ) : null}
      </DataTable>
      <p className="text-xs text-muted">تعداد: {toFaDigits(payouts.data?.meta.total ?? 0)}</p>
    </>
  );
}
