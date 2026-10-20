import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa } from '../../lib/format';
import { EmptyState, ErrorBox, Spinner } from '../../components/ui';
import { AdminShell } from './AdminShell';

type Kind = 'seller' | 'courier' | 'workshop';
const KINDS: Array<{ id: Kind; label: string }> = [{ id: 'seller', label: 'فروشندگان' }, { id: 'courier', label: 'پیک‌ها' }, { id: 'workshop', label: 'تعمیرگاه‌ها' }];

export default function AdminReviews(): JSX.Element {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>('seller');
  const [error, setError] = useState<string | null>(null);
  const reviews = useQuery({ queryKey: ['admin-mobile-reviews', kind], queryFn: () => api.admin.verifications(kind) });
  const decide = useMutation({
    mutationFn: ({ action, id, reason }: { action: 'approve' | 'reject'; id: string; reason?: string }) => action === 'approve' ? api.admin.approve(kind, id, 'تأیید از اپ مدیریت') : api.admin.reject(kind, id, reason ?? ''),
    onSuccess: () => { setError(null); void qc.invalidateQueries({ queryKey: ['admin-mobile-reviews'] }); void qc.invalidateQueries({ queryKey: ['admin-mobile-dashboard'] }); },
    onError: (reason) => setError(reason instanceof ApiClientError ? reason.userMessage : 'ثبت تصمیم ناموفق بود'),
  });

  return (
    <AdminShell title="صف تأیید هویت">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/70 p-1" role="tablist">
        {KINDS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={kind === item.id} className={`rounded-xl px-2 py-2 text-xs font-bold transition ${kind === item.id ? 'bg-white text-blue-700 shadow-sm' : 'text-muted'}`} onClick={() => setKind(item.id)}>{item.label}</button>)}
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs leading-6 text-blue-900">پیش از تصمیم، اصالت مدارک و تطابق اطلاعات را بررسی کنید. همهٔ تصمیم‌ها در گزارش ممیزی ثبت می‌شوند.</div>
      {error ? <ErrorBox message={error} /> : null}
      {reviews.isLoading ? <Spinner /> : null}
      <div className="space-y-2">
        {(reviews.data ?? []).map((row) => (
          <article key={row.id} className="cp-card">
            <div className="flex items-start justify-between gap-2">
              <div><h2 className="text-sm font-black">{row.displayName}</h2><p className="mt-1 text-xs text-muted">{row.city || 'شهر ثبت نشده'} · {dateFa(row.submittedAt, false)}</p></div>
              <span className="cp-chip bg-amber-50 text-amber-800">در انتظار</span>
            </div>
            {row.documents?.length ? <p className="mt-3 text-xs font-semibold text-slate-600">{row.documents.length.toLocaleString('fa-IR')} مدرک پیوست شده است</p> : <p className="mt-3 text-xs font-semibold text-red-600">مدرکی پیوست نشده است</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="cp-btn bg-emerald-600 text-white" disabled={decide.isPending} onClick={() => { if (window.confirm(`هویت ${row.displayName} تأیید شود؟`)) decide.mutate({ action: 'approve', id: row.id }); }}>تأیید</button>
              <button type="button" className="cp-btn bg-red-50 text-red-700" disabled={decide.isPending} onClick={() => { const reason = window.prompt('دلیل رد (الزامی):'); if (reason?.trim()) decide.mutate({ action: 'reject', id: row.id, reason: reason.trim() }); }}>رد با دلیل</button>
            </div>
          </article>
        ))}
      </div>
      {reviews.data?.length === 0 ? <EmptyState title="صف بررسی خالی است" hint="در حال حاضر موردی نیازمند تصمیم نیست." /> : null}
    </AdminShell>
  );
}
