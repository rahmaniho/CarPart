import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, apiTokens } from '../lib/api';
import { useSessionStore, canUsePanel, canUseSeller } from '../lib/session';

/** چیدمان عمومی: هدر با جست‌وجو + فوتر — مناسب بازدیدکننده بدون ورود */
export function PublicLayout({ children }: { children: ReactNode }): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);

  const home = user ? (canUsePanel(user) ? '/admin' : canUseSeller(user) ? '/seller' : '/') : '/';

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to={home} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg text-white">🔧</span>
            <b className="text-base">کارپارت</b>
          </Link>
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const q = (event.currentTarget.elements.namedItem('q') as HTMLInputElement).value;
              navigate(`/search?q=${encodeURIComponent(q)}`);
            }}
          >
            <input name="q" className="cp-field" placeholder="جست‌وجوی قطعه (مثلاً لنت ترمز پراید)…" defaultValue={params.get('q') ?? ''} />
            <button type="submit" className="cp-btn-primary shrink-0">
              جست‌وجو
            </button>
          </form>
          {user ? (
            <div className="flex items-center gap-2">
              <Link to={home} className="cp-btn-ghost text-xs">
                {user.fullName}
              </Link>
              <button
                type="button"
                className="cp-btn-ghost text-xs text-red-700"
                onClick={async () => {
                  await api.auth.logout().catch(() => undefined);
                  apiTokens.setAccess(null);
                  clear();
                  navigate('/');
                }}
              >
                خروج
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="cp-btn-ghost text-xs">
                ورود
              </Link>
              <Link to="/register" className="cp-btn-primary text-xs">
                ثبت‌نام
              </Link>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">{children}</main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-5xl space-y-2 px-4 py-6 text-xs leading-6 text-muted">
          <p>
            <b className="text-ink">کارپارت</b> — بازار هوشمند تأمین و ارسال سریع قطعات یدکی خودرو برای مکانیک‌ها، فروشندگان و پیک‌ها.
          </p>
          <p>
            مبالغ به <b>تومان</b> است. زمان‌های اعلام‌شده برای ارسال <b>تخمینی</b>‌اند و تضمین‌شده نیستند. درگاه پرداخت در این استقرار در حالت
            آزمایشی (Sandbox) است.
          </p>
          <p>پشتیبانی: ۰۲۱-۹۱۰۰۰۰۰۰ | همه حقوق محفوظ است.</p>
        </div>
      </footer>
    </div>
  );
}
