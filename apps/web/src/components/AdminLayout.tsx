import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api, apiTokens } from '../lib/api';
import { useSessionStore } from '../lib/session';

const NAV = [
  { to: '/', label: 'داشبورد', icon: '📊' },
  { to: '/users', label: 'کاربران', icon: '👥' },
  { to: '/verifications', label: 'تأیید هویت‌ها', icon: '✅' },
  { to: '/orders', label: 'سفارش‌ها', icon: '🧾' },
  { to: '/deliveries', label: 'ارسال‌ها', icon: '🛵' },
  { to: '/settings', label: 'تنظیمات', icon: '⚙️' },
  { to: '/audit', label: 'گزارش ممیزی', icon: '🛡' },
];

/** چیدمان پنل: نوار کناری راست + محتوا */
export function AdminLayout({ children }: { children: ReactNode }): JSX.Element {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-l border-line bg-white">
        <div className="flex items-center gap-2 border-b border-line px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg text-white">🔧</span>
          <div>
            <b className="block text-sm">کارپارت</b>
            <span className="text-[11px] text-muted">پنل مدیریت</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx('flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold', isActive ? 'bg-primary-soft text-primary-dark' : 'text-muted hover:bg-slate-100')
              }
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <p className="truncate text-xs font-semibold">{user?.fullName}</p>
          <p className="text-[11px] text-muted">{user?.roles?.includes('admin') ? 'مدیر سامانه' : 'اپراتور پشتیبانی'}</p>
          <button
            type="button"
            className="cp-btn-ghost mt-2 w-full text-xs text-red-700"
            onClick={async () => {
              await api.auth.logout().catch(() => undefined);
              apiTokens.setAccess(null);
              clear();
              navigate('/login', { replace: true });
            }}
          >
            خروج
          </button>
        </div>
      </aside>
      <main className="flex-1 space-y-4 p-6">{children}</main>
    </div>
  );
}
