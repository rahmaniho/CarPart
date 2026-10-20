import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa, toFaDigits } from '../../lib/format';
import { EmptyState, ErrorBox, Spinner } from '../../components/ui';
import { AdminShell } from './AdminShell';

const ROLE_FA: Record<string, string> = { admin: 'مدیر', operator: 'اپراتور', seller: 'فروشنده', mechanic: 'مکانیک', courier: 'پیک' };

export default function AdminUsers(): JSX.Element {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const query = useDeferredValue(search.trim());
  const users = useQuery({ queryKey: ['admin-mobile-users', query], queryFn: () => api.admin.users({ q: query || undefined, pageSize: 30 }) });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.admin.updateUser(id, { isActive }),
    onSuccess: () => { setError(null); void qc.invalidateQueries({ queryKey: ['admin-mobile-users'] }); },
    onError: (reason) => setError(reason instanceof ApiClientError ? reason.userMessage : 'تغییر وضعیت کاربر ناموفق بود'),
  });

  return (
    <AdminShell title="مدیریت کاربران">
      <label className="block">
        <span className="cp-label">جست‌وجوی امن در کاربران</span>
        <input className="cp-field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="نام یا شماره موبایل…" autoComplete="off" />
      </label>
      {error ? <ErrorBox message={error} /> : null}
      {users.isLoading ? <Spinner /> : null}
      {users.data ? <p className="text-xs font-semibold text-muted">{toFaDigits(users.data.meta.total)} کاربر یافت شد</p> : null}
      <div className="space-y-2">
        {(users.data?.items ?? []).map((user) => (
          <article key={user.id} className="cp-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black">{user.fullName}</h2>
                <p className="mt-1 text-xs text-muted" dir="ltr">{user.mobile}</p>
              </div>
              <span className={`cp-chip ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{user.isActive ? 'فعال' : 'غیرفعال'}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">{user.roles.map((role) => <span key={role} className="cp-chip bg-slate-100 text-slate-700">{ROLE_FA[role] ?? role}</span>)}</div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-[11px] text-muted">عضویت {dateFa(user.createdAt, false)}</span>
              <button
                type="button"
                className={`cp-btn !min-h-9 !px-3 !py-1 text-xs ${user.isActive ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
                disabled={toggle.isPending}
                onClick={() => { if (window.confirm(`وضعیت حساب ${user.fullName} تغییر کند؟`)) toggle.mutate({ id: user.id, isActive: !user.isActive }); }}
              >{user.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</button>
            </div>
          </article>
        ))}
      </div>
      {users.data?.items.length === 0 ? <EmptyState title="کاربری یافت نشد" hint="عبارت جست‌وجو را تغییر دهید." /> : null}
    </AdminShell>
  );
}
