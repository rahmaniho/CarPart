import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { dateFa, toFaDigits } from '../lib/format';
import { DataTable, ErrorBox, PageHeader, Spinner } from '../components/ui';

/** گزارش ممیزی عملیات حساس (فقط admin طبق نقش‌ها) */
export default function AuditPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const audit = useQuery({ queryKey: ['audit', page], queryFn: () => api.audit.list({ page, pageSize: 30 }) });

  return (
    <>
      <PageHeader title="گزارش ممیزی" subtitle="تاریخچه عملیات حساس: تغییر تنظیمات، تأیید هویت‌ها، تغییر نقش‌ها و…" />
      {audit.isError ? <ErrorBox message="دریافت گزارش ممیزی ممکن نشد (نیازمند دسترسی admin)" onRetry={() => audit.refetch()} /> : null}
      {audit.isLoading ? <Spinner /> : null}
      <DataTable headers={['زمان', 'عملیات', 'شرح', 'انجام‌دهنده', 'هدف']}>
        {(audit.data?.items ?? []).map((row) => (
          <tr key={String(row.id)}>
            <td className="text-xs text-muted">{dateFa(String(row.createdAt))}</td>
            <td dir="ltr" className="text-xs">
              {String(row.action)}
            </td>
            <td className="text-xs">{String(row.fa ?? '—')}</td>
            <td className="text-xs">{String(row.actor ?? row.actorId ?? 'سامانه')}</td>
            <td className="text-xs text-muted" dir="ltr">
              {row.targetType ? `${String(row.targetType)} / ${String(row.targetId ?? '').slice(0, 8)}` : '—'}
            </td>
          </tr>
        ))}
      </DataTable>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">صفحه {toFaDigits(page)} از {toFaDigits(audit.data?.meta.totalPages ?? 1)}</p>
        <div className="flex gap-2">
          <button type="button" className="cp-btn-ghost text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            قبلی
          </button>
          <button type="button" className="cp-btn-ghost text-xs" disabled={page >= (audit.data?.meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>
            بعدی
          </button>
        </div>
      </div>
    </>
  );
}
