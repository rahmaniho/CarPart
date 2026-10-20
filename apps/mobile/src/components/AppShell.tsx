import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

export interface TabDef {
  to: string;
  label: string;
  icon: string;
}

/** پوسته موبایل: هدر + محتوا + نوار پایین (تب‌ها) با رعایت RTL */
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
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-line bg-primary text-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-base font-bold">{title}</h1>
          {headerExtra}
        </div>
      </header>
      <main className="flex-1 space-y-4 p-4 pb-24">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-flow-col">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-semibold',
                    isActive ? 'text-primary' : 'text-muted hover:text-ink',
                  )
                }
              >
                <span className="text-lg leading-none" aria-hidden>
                  {tab.icon}
                </span>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
