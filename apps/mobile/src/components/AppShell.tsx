import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';

export interface TabDef {
  to: string;
  label: string;
  icon: string;
}

function NetworkStatus(): JSX.Element | null {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return <div className="network-banner" role="status">اتصال اینترنت قطع است؛ اطلاعات آنلاین پس از اتصال دریافت می‌شود.</div>;
}

/** پوستهٔ نقش‌محور با safe-area، ناوبری دسترس‌پذیر و بازخورد اتصال. */
export function AppShell({
  title,
  tabs,
  children,
  headerExtra,
}: {
  title: string;
  tabs: TabDef[];
  children: ReactNode;
  headerExtra?: ReactNode;
}): JSX.Element {
  const { pathname } = useLocation();
  const role = pathname.split('/')[1] || 'mechanic';

  return (
    <div className={clsx('app-shell', `theme-${role}`)}>
      <a className="skip-link" href="#main-content">رفتن به محتوای اصلی</a>
      <NetworkStatus />
      <header className="app-header">
        <div className="app-header__glow" />
        <div className="relative flex items-center justify-between gap-3 px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[.16em] text-white/55">CARPART</p>
            <h1 className="truncate text-base font-black text-white">{title}</h1>
          </div>
          {headerExtra}
        </div>
      </header>
      <main id="main-content" className="app-content">{children}</main>
      <nav className="app-nav" aria-label="منوی اصلی">
        <ul className="grid grid-flow-col">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.to.split('/').filter(Boolean).length === 1}
                className={({ isActive }) => clsx('app-nav__item', isActive && 'app-nav__item--active')}
              >
                <span className="app-nav__icon" aria-hidden>{tab.icon}</span>
                <span>{tab.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
