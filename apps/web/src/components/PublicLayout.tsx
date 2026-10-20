import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, apiTokens } from '../lib/api';
import { useSessionStore, canUsePanel, canUseSeller } from '../lib/session';

/** پوسته عمومی واکنش‌گرا با ناوبری معرفی، جست‌وجو و دسترسی حساب. */
export function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);
  const home = user ? (canUsePanel(user) ? '/admin' : canUseSeller(user) ? '/seller' : '/') : '/';

  return (
    <div className="flex min-h-full flex-col bg-white">
      <a className="public-skip" href="#public-main">رفتن به محتوای اصلی</a>
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 lg:flex-nowrap lg:px-6">
          <Link to={home} className="group flex shrink-0 items-center gap-2.5" aria-label="صفحه اصلی کارپارت">
            <span className="brand-mark"><i /><i /></span>
            <span><b className="block text-base font-black leading-5">کارپارت</b><small className="hidden text-[9px] font-bold tracking-wide text-muted sm:block">بازار هوشمند قطعات</small></span>
          </Link>

          <nav className="mr-4 hidden items-center gap-5 text-xs font-bold text-slate-600 xl:flex" aria-label="بخش‌های صفحه">
            <a href="/#roles" className="hover:text-primary">راهکارها</a>
            <a href="/#features" className="hover:text-primary">امکانات</a>
            <a href="/#how" className="hover:text-primary">نحوه کار</a>
            <a href="/#download" className="hover:text-primary">دانلود اپ</a>
          </nav>

          <form
            className="order-last flex w-full flex-1 items-center gap-2 md:order-none md:mr-auto md:max-w-sm"
            onSubmit={(event) => {
              event.preventDefault();
              const q = (event.currentTarget.elements.namedItem('q') as HTMLInputElement).value;
              navigate(`/search?q=${encodeURIComponent(q)}`);
            }}
          >
            <div className="relative flex-1"><span className="pointer-events-none absolute right-3 top-2.5 text-slate-400" aria-hidden="true">⌕</span><input name="q" className="cp-field !pr-9" aria-label="جست‌وجوی سریع" placeholder="جست‌وجوی قطعه…" defaultValue={params.get('q') ?? ''} /></div>
            <button type="submit" className="cp-btn-primary shrink-0 !px-3">جست‌وجو</button>
          </form>

          {user ? (
            <div className="mr-auto flex items-center gap-2 md:mr-0">
              <Link to={home} className="cp-btn-ghost max-w-32 truncate text-xs">{user.fullName}</Link>
              <button type="button" className="cp-btn-ghost text-xs text-red-700" onClick={async () => { await api.auth.logout().catch(() => undefined); apiTokens.setAccess(null); clear(); navigate('/'); }}>خروج</button>
            </div>
          ) : (
            <div className="mr-auto flex shrink-0 items-center gap-2 md:mr-0">
              <Link to="/login" className="cp-btn-ghost text-xs">ورود</Link>
              <Link to="/register" className="cp-btn-primary text-xs">شروع رایگان</Link>
            </div>
          )}
        </div>
      </header>

      <main id="public-main" className={`mx-auto w-full flex-1 px-4 py-5 sm:py-7 ${wide ? 'max-w-7xl space-y-20 lg:px-6 lg:py-8' : 'max-w-5xl space-y-6'}`}>{children}</main>

      <footer className="mt-14 border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[1.5fr_1fr_1fr] lg:px-6">
          <div><div className="flex items-center gap-2"><span className="brand-mark brand-mark--dark"><i /><i /></span><b className="text-lg text-white">کارپارت</b></div><p className="mt-4 max-w-md text-xs leading-7 text-slate-400">بازار هوشمند تأمین و ارسال قطعات یدکی؛ برای مکانیک‌ها، خریداران، فروشندگان و پیک‌ها.</p></div>
          <div><b className="text-sm text-white">دسترسی سریع</b><div className="mt-3 flex flex-col gap-2 text-xs"><Link to="/search">جست‌وجوی قطعه</Link><Link to="/register">ثبت‌نام فروشنده</Link><a href="/#download">دانلود اپلیکیشن</a></div></div>
          <div><b className="text-sm text-white">شفافیت</b><p className="mt-3 text-xs leading-7 text-slate-400">مبالغ به تومان است. زمان‌های ارسال تخمینی‌اند و تضمین نمی‌شوند. وضعیت آزمایشی سرویس‌های بیرونی در محصول مشخص می‌شود.</p></div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-[11px] text-slate-500">© کارپارت — همه حقوق محفوظ است.</div>
      </footer>
    </div>
  );
}
