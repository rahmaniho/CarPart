import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, apiTokens, isStaticLanding } from '../lib/api';
import { useSessionStore, canUsePanel, canUseSeller } from '../lib/session';

const publicAsset = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

/** پوسته عمومی؛ ناوبری واقعی، دسترسی نقش‌محور و نسخه موبایل بدون وابستگی جاوااسکریپت. */
export function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = useSessionStore((state) => state.user);
  const clear = useSessionStore((state) => state.clear);
  const home = user ? (canUsePanel(user) ? '/admin' : canUseSeller(user) ? '/seller' : '/') : '/';
  const links = [
    ['/#catalog', 'جست‌وجوی قطعه'],
    ['/#network', 'شبکه کارپارت'],
    ['/#journey', 'نحوه کار'],
    ['/#roles', 'راهکارها'],
    ['/#seller', 'همکاری فروش'],
  ] as const;

  return (
    <div className={`public-shell ${wide ? 'public-shell--cinematic' : ''}`}>
      <a className="public-skip" href="#public-main">رفتن به محتوای اصلی</a>
      <header className="public-header">
        <div className="public-header__inner">
          <Link to={home} className="public-brand" aria-label="صفحه اصلی کارپارت">
            <span className="brand-mark"><i /><i /></span>
            <span><b>کارپارت</b><small>CARPART NETWORK</small></span>
          </Link>

          <nav className="public-nav" aria-label="بخش‌های صفحه">{links.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</nav>

          {!wide && !isStaticLanding ? (
            <form className="header-search" onSubmit={(event) => { event.preventDefault(); const q = (event.currentTarget.elements.namedItem('q') as HTMLInputElement).value; navigate(`/search?q=${encodeURIComponent(q)}`); }}>
              <input name="q" aria-label="جست‌وجوی سریع" placeholder="جست‌وجوی قطعه…" defaultValue={params.get('q') ?? ''} /><button aria-label="اجرای جست‌وجو">⌕</button>
            </form>
          ) : <span className="public-header__spacer" />}

          <div className="public-account">
            {user ? <><Link to={home}>{user.fullName}</Link><button type="button" onClick={async () => { await api.auth.logout().catch(() => undefined); apiTokens.setAccess(null); clear(); navigate('/'); }}>خروج</button></> : isStaticLanding ? <a href="https://github.com/rahmaniho/CarPart/releases/latest" target="_blank" rel="noreferrer">دریافت Android ↗</a> : <><Link to="/login" className="public-login">ورود</Link><Link to="/register" className="public-join">پیوستن به شبکه</Link></>}
          </div>

          <details className="mobile-menu"><summary aria-label="باز کردن منو"><span /><span /></summary><div>{links.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}<Link to="/login">ورود به حساب</Link><Link to="/register">پیوستن به شبکه</Link></div></details>
        </div>
      </header>

      <main id="public-main" className={wide ? 'public-main public-main--wide' : 'public-main'}>{children}</main>

      <footer className="public-footer">
        <div className="public-footer__top">
          <div><Link to="/" className="public-brand"><span className="brand-mark"><i /><i /></span><span><b>کارپارت</b><small>CARPART NETWORK</small></span></Link><p>بازار و شبکهٔ عملیاتی قطعات خودرو برای خریدار، مکانیک، فروشنده و پیک.</p></div>
          <div><b>محصول</b><Link to="/search">جست‌وجوی قطعه</Link><Link to="/#network">سفارش چندفروشنده‌ای</Link><Link to="/account/orders">پیگیری سفارش</Link></div>
          <div><b>همکاری</b><Link to="/register">ثبت‌نام فروشنده</Link><Link to="/register">ثبت‌نام پیک</Link><Link to="/#faq">پرسش‌های متداول</Link></div>
          <div><b>شفافیت</b><p>مبالغ به تومان‌اند. زمان ارسال تخمینی است. سازگاری قطعه تنها در سطح تأییدشده نمایش داده می‌شود.</p></div>
        </div>
        <div className="public-footer__bottom">
          <span>© کارپارت — همه حقوق محفوظ است.</span>
          <a className="karensoft-credit" href="https://www.karen-soft.ir" target="_blank" rel="noopener noreferrer" aria-label="طراحی و توسعه توسط کارن سافت؛ باز کردن وب‌سایت در پنجره جدید">
            <span className="karensoft-credit__label">Designed &amp; Developed by</span>
            <span className="karensoft-credit__brand" aria-hidden="true">
              <span className="karensoft-credit__mark"><img src={publicAsset('images/karensoft/mark.png')} width="256" height="256" alt="" /></span>
              <span className="karensoft-credit__wordmarks">
                <img src={publicAsset('images/karensoft/wordmark-fa.png')} width="383" height="96" alt="" />
                <img src={publicAsset('images/karensoft/wordmark-en.png')} width="410" height="48" alt="" />
              </span>
            </span>
          </a>
          <span>PRECISION · TRUST · CONNECTIVITY</span>
        </div>
      </footer>
    </div>
  );
}
