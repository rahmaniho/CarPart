import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { dateFa } from '../lib/format';
import { DataTable, EmptyState, ErrorBox, PageHeader, Spinner } from '../components/ui';

type Kind = 'seller' | 'courier' | 'workshop';

const KIND_LABELS: Array<{ kind: Kind; label: string }> = [
  { kind: 'seller', label: 'فروشندگان' },
  { kind: 'courier', label: 'پیک‌ها' },
  { kind: 'workshop', label: 'تعمیرگاه‌ها' },
];

export default function VerificationsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<Kind>('seller');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useQuery({ queryKey: ['verification-counts'], queryFn: () => api.admin.verificationCounts() });
  const queue = useQuery({ queryKey: ['verifications', kind], queryFn: () => api.admin.verifications(kind) });

  const decide = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      action === 'approve' ? api.admin.approve(kind, id, reason) : api.admin.reject(kind, id, reason ?? 'مدارک کافی نیست'),
    onSettled: () => {
      setBusyId(null);
      void queryClient.invalidateQueries({ queryKey: ['verifications'] });
      void queryClient.invalidateQueries({ queryKey: ['verification-counts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: () => setError('عملیات ناموفق بود'),
  });

  return (
    <>
      <PageHeader title="صف تأیید هویت‌ها" subtitle="بررسی مدارک فروشندگان، پیک‌ها و تعمیرگاه‌ها" />
      <div className="flex gap-2">
        {KIND_LABELS.map((item) => (
          <button
            key={item.kind}
            type="button"
            className={kind === item.kind ? 'cp-btn-primary' : 'cp-btn-ghost'}
            onClick={() => setKind(item.kind)}
          >
            {item.label}
            {counts.data ? ` (${counts.data[item.kind]})` : ''}
          </button>
        ))}
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {queue.isLoading ? <Spinner /> : null}
      {queue.data?.length === 0 ? <EmptyState title="در صف تأیید موردی نیست" hint="همه درخواست‌ها بررسی شده‌اند." /> : null}
      <DataTable headers={['نام', 'شهر', 'وضعیت', 'تاریخ ارسال', 'عملیات']}>
        {(queue.data ?? []).map((row) => (
          <tr key={row.id}>
            <td className="font-semibold">{row.displayName}</td>
            <td>{row.city ?? '—'}</td>
            <td className="text-xs">{row.status === 'PENDING_REVIEW' ? 'در انتظار بررسی' : row.status}</td>
            <td className="text-xs text-muted">{dateFa(row.submittedAt)}</td>
            <td>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="cp-btn !bg-emerald-50 !py-1 text-xs text-emerald-700"
                  disabled={busyId === row.id}
                  onClick={() => {
                    setBusyId(row.id);
                    decide.mutate({ id: row.id, action: 'approve', reason: 'مدارک بررسی و تأیید شد' });
                  }}
                >
                  تأیید
                </button>
                <button
                  type="button"
                  className="cp-btn !bg-red-50 !py-1 text-xs text-red-700"
                  disabled={busyId === row.id}
                  onClick={() => {
                    const reason = window.prompt('دلیل رد (برای کاربر ارسال می‌شود):') ?? '';
                    if (!reason.trim()) return;
                    setBusyId(row.id);
                    decide.mutate({ id: row.id, action: 'reject', reason });
                  }}
                >
                  رد
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
