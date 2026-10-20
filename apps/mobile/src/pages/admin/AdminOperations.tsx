import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@carpart/api-client';
import { api } from '../../lib/api';
import { ErrorBox, Spinner, StatusChip } from '../../components/ui';
import { toFaDigits } from '../../lib/format';
import { AdminShell } from './AdminShell';

type View = 'tickets' | 'refunds' | 'orders';
const text = (row: Record<string, unknown>, key: string, fallback = '—') => String(row[key] ?? fallback);

export default function AdminOperations(): JSX.Element {
  const qc = useQueryClient();
  const [view, setView] = useState<View>('tickets');
  const [error, setError] = useState<string | null>(null);
  const tickets = useQuery({ queryKey: ['admin-mobile-tickets'], queryFn: () => api.admin.supportTickets({ pageSize: 20, status: 'OPEN' }), enabled: view === 'tickets' });
  const refunds = useQuery({ queryKey: ['admin-mobile-refunds'], queryFn: () => api.admin.refunds({ pageSize: 20 }), enabled: view === 'refunds' });
  const orders = useQuery({ queryKey: ['admin-mobile-orders'], queryFn: () => api.admin.orders({ pageSize: 20 }), enabled: view === 'orders' });
  const reply = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.admin.replyTicket(id, body),
    onSuccess: () => { setError(null); void qc.invalidateQueries({ queryKey: ['admin-mobile-tickets'] }); },
    onError: (reason) => setError(reason instanceof ApiClientError ? reason.userMessage : 'ارسال پاسخ ناموفق بود'),
  });
  const loading = tickets.isLoading || refunds.isLoading || orders.isLoading;

  return (
    <AdminShell title="مرکز عملیات">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/70 p-1">
        {([['tickets', 'پشتیبانی'], ['refunds', 'بازپرداخت'], ['orders', 'سفارش‌ها']] as Array<[View, string]>).map(([id, label]) => <button key={id} type="button" className={`rounded-xl px-1 py-2 text-xs font-bold ${view === id ? 'bg-white text-blue-700 shadow-sm' : 'text-muted'}`} onClick={() => setView(id)}>{label}</button>)}
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {loading ? <Spinner /> : null}
      {view === 'tickets' ? <div className="space-y-2">{(tickets.data?.items ?? []).map((row) => <article key={text(row, 'id')} className="cp-card"><div className="flex items-center justify-between"><b className="text-sm">{text(row, 'subject')}</b><span className="cp-chip bg-blue-50 text-blue-700">{text(row, 'priority', 'عادی')}</span></div><p className="mt-2 text-xs text-muted">{text(row, 'code')} · {text(row, 'category', 'عمومی')}</p><button type="button" className="cp-btn-primary mt-3 w-full" disabled={reply.isPending} onClick={() => { const body = window.prompt('پاسخ پشتیبانی:'); if (body?.trim()) reply.mutate({ id: text(row, 'id'), body: body.trim() }); }}>ثبت پاسخ</button></article>)}</div> : null}
      {view === 'refunds' ? <div className="space-y-2">{(refunds.data?.items ?? []).map((row) => <article key={text(row, 'id')} className="cp-card"><div className="flex items-center justify-between"><b className="text-sm">درخواست {text(row, 'code', text(row, 'id').slice(0, 8))}</b><span className="cp-chip bg-amber-50 text-amber-800">{text(row, 'status')}</span></div><p className="mt-2 text-xs leading-6 text-muted">مبلغ: {Number(row.amount ?? 0).toLocaleString('fa-IR')} تومان<br />دلیل: {text(row, 'reason')}</p></article>)}</div> : null}
      {view === 'orders' ? <div className="space-y-2">{(orders.data?.items ?? []).map((row) => <article key={row.id} className="cp-card"><div className="flex items-center justify-between"><b dir="ltr" className="text-sm">{row.code}</b><StatusChip status={row.status} /></div><p className="mt-2 text-xs text-muted">{toFaDigits(row.items?.length ?? 0)} قلم · {Number(row.payableTotal).toLocaleString('fa-IR')} تومان</p></article>)}</div> : null}
    </AdminShell>
  );
}
