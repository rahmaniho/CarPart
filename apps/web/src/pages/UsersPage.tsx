import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@carpart/contract';
import { api } from '../lib/api';
import { dateFa, toFaDigits } from '../lib/format';
import { isAdmin, useSessionStore } from '../lib/session';
import { DataTable, ErrorBox, PageHeader, Spinner } from '../components/ui';

const ROLE_FA: Record<string, string> = {
  mechanic: 'مکانیک',
  seller: 'فروشنده',
  courier: 'پیک',
  operator: 'اپراتور',
  admin: 'مدیر',
};

const ALL_ROLES: Role[] = ['mechanic', 'seller', 'courier', 'operator', 'admin'];

export default function UsersPage(): JSX.Element {
  const queryClient = useQueryClient();
  const me = useSessionStore((s) => s.user);
  const admin = isAdmin(me);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const users = useQuery({ queryKey: ['admin-users', q], queryFn: () => api.admin.users({ q: q || undefined, pageSize: 50 }) });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { roles?: Role[]; isActive?: boolean } }) => api.admin.updateUser(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setError(null);
    },
    onError: () => setError('تغییر کاربر ناموفق بود (ممکن است دسترسی لازم را نداشته باشید)'),
  });

  return (
    <>
      <PageHeader title="مدیریت کاربران" subtitle="تغییر نقش و وضعیت حساب — همه تغییرات در گزارش ممیزی ثبت می‌شود" />
      <div className="flex gap-2">
        <input className="cp-field max-w-xs" placeholder="جست‌وجوی نام یا شماره موبایل…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {users.isLoading ? <Spinner /> : null}
      <DataTable headers={['نام', 'موبایل', 'نقش‌ها', 'وضعیت', 'تاریخ عضویت', 'عملیات']}>
        {(users.data?.items ?? []).map((user) => (
          <tr key={user.id}>
            <td className="font-semibold">{user.fullName}</td>
            <td dir="ltr" className="text-xs">
              {user.mobile}
            </td>
            <td>
              <div className="flex flex-wrap gap-1">
                {user.roles.map((role) => (
                  <span key={role} className="cp-chip bg-slate-100 text-slate-700">
                    {ROLE_FA[role] ?? role}
                  </span>
                ))}
              </div>
            </td>
            <td>
              <span className={`cp-chip ${user.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{user.isActive ? 'فعال' : 'غیرفعال'}</span>
            </td>
            <td className="text-xs text-muted">{dateFa(user.createdAt, false)}</td>
            <td>
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  className="cp-field !w-auto !py-1 text-xs"
                  value={user.roles[0] ?? ''}
                  disabled={!admin || user.id === me?.id}
                  onChange={(e) => update.mutate({ id: user.id, input: { roles: [e.target.value as Role] } })}
                >
                  {ALL_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_FA[role]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`cp-btn !py-1 text-xs ${user.isActive ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
                  disabled={!admin || user.id === me?.id}
                  onClick={() => update.mutate({ id: user.id, input: { isActive: !user.isActive } })}
                >
                  {user.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                </button>
              </div>
            </td>
          </tr>
        ))}
        {users.data?.items.length === 0 ? (
          <tr>
            <td colSpan={6} className="text-center text-xs text-muted">
              کاربری یافت نشد
            </td>
          </tr>
        ) : null}
      </DataTable>
      <p className="text-xs text-muted">مجموع: {toFaDigits(users.data?.meta.total ?? 0)} کاربر</p>
    </>
  );
}
