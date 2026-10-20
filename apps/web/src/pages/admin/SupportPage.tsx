import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa, formatToman } from '../../lib/format';
import { DataTable, ErrorBox, PageHeader, Spinner } from '../../components/ui';

const TICKET_FA: Record<string, string> = {
  OPEN: 'باز', IN_PROGRESS: 'در حال بررسی', WAITING_FOR_USER: 'در انتظار کاربر', RESOLVED: 'حل‌شده', CLOSED: 'بسته',
};
const RETURN_FA: Record<string, string> = {
  REQUESTED: 'درخواست‌شده', APPROVED: 'تأییدشده', RECEIVED: 'دریافت‌شده', REJECTED: 'ردشده', COMPLETED: 'تکمیل‌شده',
};

/** تیکت‌های پشتیبانی و درخواست‌های مرجوعی */
export default function SupportPage(): JSX.Element {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'tickets' | 'returns'>('tickets');
  const [error, setError] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const tickets = useQuery({ queryKey: ['admin-tickets'], queryFn: () => api.admin.supportTickets({ pageSize: 30 }), enabled: tab === 'tickets' });
  const returns = useQuery({ queryKey: ['admin-returns'], queryFn: () => api.admin.returns({ pageSize: 30 }), enabled: tab === 'returns' });

  const reply = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.admin.replyTicket(id, body),
    onSuccess: () => {
      setReplyFor(null);
      setReplyBody('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin-tickets'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت پاسخ ناموفق بود'),
  });

  const resolveReturn = useMutation({
    mutationFn: (id: string) => api.admin.resolveReturn(id, { resolution: 'accepted', note: 'بررسی و تأیید شد' }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin-returns'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'بررسی مرجوعی ناموفق بود'),
  });

  return (
    <>
      <PageHeader title="پشتیبانی" subtitle="تیکت‌های کاربران و درخواست‌های مرجوعی" />
      <div className="flex gap-2">
        <button type="button" className={tab === 'tickets' ? 'cp-btn-primary' : 'cp-btn-ghost'} onClick={() => setTab('tickets')}>
          تیکت‌ها
        </button>
        <button type="button" className={tab === 'returns' ? 'cp-btn-primary' : 'cp-btn-ghost'} onClick={() => setTab('returns')}>
          مرجوعی‌ها
        </button>
      </div>
      {error ? <ErrorBox message={error} /> : null}

      {tab === 'tickets' ? (
        <>
          {tickets.isLoading ? <Spinner /> : null}
          <DataTable headers={['موضوع', 'وضعیت', 'اولویت', 'تاریخ', 'عملیات']}>
            {(tickets.data?.items ?? []).map((row) => (
              <tr key={String(row.id)}>
                <td className="font-semibold">{String(row.subject ?? row.title ?? '—')}</td>
                <td><span className="cp-chip bg-slate-100 text-slate-700">{TICKET_FA[String(row.status)] ?? String(row.status)}</span></td>
                <td className="text-xs">{String(row.priority ?? '—')}</td>
                <td className="text-xs text-muted">{dateFa(String(row.createdAt ?? ''), false)}</td>
                <td>
                  {replyFor === String(row.id) ? (
                    <div className="flex gap-1.5">
                      <input className="cp-field !w-48 !py-1 text-xs" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="متن پاسخ…" />
                      <button type="button" className="cp-btn-primary !py-1 text-xs" disabled={reply.isPending || !replyBody} onClick={() => reply.mutate({ id: String(row.id), body: replyBody })}>
                        ارسال
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="cp-btn-ghost !py-1 text-xs" onClick={() => setReplyFor(String(row.id))}>
                      پاسخ
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tickets.data?.items.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-xs text-muted">تیکتی ثبت نشده است</td></tr>
            ) : null}
          </DataTable>
        </>
      ) : (
        <>
          {returns.isLoading ? <Spinner /> : null}
          <DataTable headers={['کد', 'سفارش', 'مبلغ بازپرداخت', 'دلیل', 'وضعیت', 'تاریخ', 'عملیات']}>
            {(returns.data?.items ?? []).map((row) => (
              <tr key={String(row.id)}>
                <td dir="ltr" className="text-xs">{String(row.code ?? '—')}</td>
                <td dir="ltr" className="text-xs">{String(row.orderCode ?? row.orderId ?? '—').slice(0, 10)}</td>
                <td className="tabular-nums">{formatToman(Number(row.refundAmount ?? row.amount ?? 0))}</td>
                <td className="max-w-40 truncate text-xs" title={String(row.reason ?? '')}>{String(row.reason ?? '—')}</td>
                <td><span className="cp-chip bg-slate-100 text-slate-700">{RETURN_FA[String(row.status)] ?? String(row.status)}</span></td>
                <td className="text-xs text-muted">{dateFa(String(row.createdAt ?? ''), false)}</td>
                <td>
                  {String(row.status) === 'REQUESTED' ? (
                    <button type="button" className="cp-btn !bg-emerald-50 !py-1 text-xs text-emerald-700" disabled={resolveReturn.isPending} onClick={() => resolveReturn.mutate(String(row.id))}>
                      تأیید مرجوعی
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {returns.data?.items.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-xs text-muted">مرجوعی ثبت نشده است</td></tr>
            ) : null}
          </DataTable>
        </>
      )}
    </>
  );
}
