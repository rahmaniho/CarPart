import { PANEL_ROLES, ROLE_LABELS_FA, toPersianDigits, type Permission, type Role } from '@carpart/contract';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  Bell,
  HeadphonesIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Server,
  ShoppingCart,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { initNativeShell } from '../../lib/native-bridge';
import type { HealthReadyResponse } from '../../lib/types';
import { defaultHomeForRoles, useAuthStore } from '../../store/auth-store';
import { useCartStore } from '../../store/cart-store';
import { LoadingState, ToastViewport } from '../ui/Primitives';
import { MobileBottomNav, OfflineStatusBanner, ServerConnectionModal } from './MobileShell';

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  tone: string;
}

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const cartCount = useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0));
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void initNativeShell(setOnline).then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, []);

  const healthQuery = useQuery({
    queryKey: ['health-ready'],
    queryFn: () => api.get<HealthReadyResponse>('/health/ready', undefined, true),
    staleTime: 60_000,
  });

  const announcementsQuery = useQuery({
    queryKey: ['public-announcements'],
    queryFn: () => api.get<AnnouncementItem[]>('public/announcements'),
    staleTime: 60_000,
  });

  const unreadQuery = useQuery({
    queryKey: ['notifications-unread', user?.id],
    queryFn: () => api.get<{ count: number }>('notifications/unread-count'),
    enabled: Boolean(user),
    refetchInterval: 20_000,
  });

  const isSandboxPayment = healthQuery.data?.components?.payment?.status !== 'ok';
  const isMockMap = healthQuery.data?.components?.map?.status !== 'ok';
  const topAnnouncement = announcementsQuery.data?.[0];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const panelLink = user ? defaultHomeForRoles(user.roles) : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <OfflineStatusBanner online={online} />
      {/* نوار شفافیت محیط آزمایشی / اطلاعیه سراسری */}
      {(isSandboxPayment || isMockMap || topAnnouncement) && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong className="font-bold">{topAnnouncement?.title ?? 'شفافیت وضعیت سرویس:'}</strong>{' '}
                {topAnnouncement?.body ??
                  'درگاه پرداخت در حالت آزمایشی (Sandbox) و محاسبه مسیر در حالت تخمینی است؛ هیچ تراکنش بانکی واقعی کسر نمی‌شود.'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              {isSandboxPayment && (
                <span className="rounded bg-amber-200/70 px-2 py-0.5 text-amber-900">پرداخت: آزمایشی</span>
              )}
              {isMockMap && (
                <span className="rounded bg-amber-200/70 px-2 py-0.5 text-amber-900">نقشه: تخمینی</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* هدر اصلی */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-base font-extrabold tracking-tight text-slate-900">قطعه‌رسان</span>
                <span className="block text-[11px] text-slate-500">تأمین هوشمند لوازم یدکی خودرو</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
              <Link
                to="/"
                className={clsx(
                  'rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900',
                  location.pathname === '/' && 'bg-slate-100 font-bold text-brand-700',
                )}
              >
                صفحه اصلی
              </Link>
              <Link
                to="/search"
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900',
                  location.pathname.startsWith('/search') && 'bg-slate-100 font-bold text-brand-700',
                )}
              >
                <Search className="h-4 w-4" />
                جست‌وجوی قطعه
              </Link>
              <Link
                to="/mechanic/requests/new"
                className={clsx(
                  'rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900',
                  location.pathname === '/mechanic/requests/new' && 'bg-slate-100 font-bold text-brand-700',
                )}
              >
                درخواست تأمین قطعه
              </Link>
              {user && (
                <Link
                  to="/support"
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900',
                    location.pathname.startsWith('/support') && 'bg-slate-100 font-bold text-brand-700',
                  )}
                >
                  <HeadphonesIcon className="h-4 w-4" />
                  پشتیبانی و مرجوعی
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* سبد خرید */}
            <Link
              to="/cart"
              aria-label="سبد خرید"
              className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ShoppingCart className="h-4 w-4 text-brand-700" />
              <span className="hidden sm:inline">سبد</span>
              {cartCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[11px] font-bold text-white">
                  {toPersianDigits(cartCount)}
                </span>
              )}
            </Link>

            {user ? (
              <>
                <Link
                  to="/notifications"
                  aria-label="اعلان‌ها"
                  className="relative inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50"
                >
                  <Bell className="h-4 w-4" />
                  {(unreadQuery.data?.count ?? 0) > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                      {toPersianDigits(unreadQuery.data!.count)}
                    </span>
                  )}
                </Link>

                {panelLink && (
                  <Link
                    to={panelLink}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-800"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>پنل {ROLE_LABELS_FA[user.roles[0]] ?? 'کاربری'}</span>
                  </Link>
                )}

                <Link
                  to="/account"
                  className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  <span>{user.fullName}</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="خروج از حساب"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="cp-btn-primary text-xs py-2 px-3.5">
                  ورود / حساب نمونه
                </Link>
                <Link to="/register" className="hidden sm:inline-flex cp-btn-secondary text-xs py-2 px-3">
                  ثبت‌نام همکاران
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setServerModalOpen(true)}
              title="تنظیم سرور اتصال (اپلیکیشن موبایل / API)"
              aria-label="تنظیم اتصال سرور"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-700"
            >
              <Server className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden rounded-lg border border-slate-200 p-2 text-slate-600"
              aria-label="منوی موبایل"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* منوی بازشونده موبایل */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden space-y-1 text-sm">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-slate-50">
              صفحه اصلی
            </Link>
            <Link
              to="/search"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              جست‌وجوی قطعه
            </Link>
            <Link
              to="/mechanic/requests/new"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              ثبت درخواست تأمین قطعه
            </Link>
            {user && (
              <>
                <Link
                  to="/support"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 hover:bg-slate-50"
                >
                  پشتیبانی و مرجوعی
                </Link>
                <Link
                  to="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 hover:bg-slate-50"
                >
                  حساب کاربری ({user.fullName})
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* محتوای صفحه */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* فوتر */}
      <footer className="hidden md:block border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row">
          <div>
            <strong className="font-bold text-slate-800">قطعه‌رسان (CarPart)</strong> — بازار آنلاین تأمین شفاف و ارسال شهری
            لوازم یدکی خودرو
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>همه مبالغ به عدد صحیح تومان است</span>
            <span>•</span>
            <span>رتبه‌بندی فروشندگان بدون دخالت کارمزد</span>
            <span>•</span>
            <a href="/api/docs" target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
              مستندات زنده API (Swagger)
            </a>
          </div>
        </div>
      </footer>

      <MobileBottomNav />
      <ServerConnectionModal open={serverModalOpen} onClose={() => setServerModalOpen(false)} />
      <ToastViewport />
    </div>
  );
}

export interface PanelNavItem {
  to: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  permission?: Permission;
}

export function PanelShell({
  title,
  subtitle,
  roleBadge,
  items,
  children,
}: {
  title: string;
  subtitle: string;
  roleBadge: string;
  items: PanelNavItem[];
  children?: ReactNode;
}) {
  const location = useLocation();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const visibleItems = items.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <aside className="lg:col-span-3">
        <div className="cp-card p-4 sticky top-20 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <span className="inline-block rounded-md bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-800">
              {roleBadge}
            </span>
            <h1 className="mt-1.5 text-base font-extrabold text-slate-900">{title}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>

          <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {visibleItems.map((item) => {
              const active = item.exact
                ? location.pathname === item.to
                : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={clsx(
                    'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
                    active ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <section className="lg:col-span-9 min-w-0">{children ?? <Outlet />}</section>
    </div>
  );
}

export function RequirePanelAccess({
  panel,
  allowed,
  children,
}: {
  panel?: keyof typeof PANEL_ROLES | 'authenticated';
  allowed?: readonly Role[];
  children?: ReactNode;
}) {
  const { user, bootstrapped } = useAuthStore();
  const location = useLocation();

  if (!bootstrapped) {
    return <LoadingState label="در حال بررسی نشست امنیتی شما..." />;
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if ((!panel && !allowed) || panel === 'authenticated') {
    return <>{children ?? <Outlet />}</>;
  }

  const allowedRoles: readonly Role[] = allowed ?? PANEL_ROLES[panel!];
  const hasAccess = user.roles.some((r) => allowedRoles.includes(r));

  if (!hasAccess) {
    return (
      <div className="cp-card mx-auto max-w-lg p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 font-bold">
          ۴۰۳
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">عدم دسترسی به این پنل</h2>
        <p className="text-sm text-slate-600">
          حساب کاربری شما با نقش «{user.roles.map((r) => ROLE_LABELS_FA[r]).join('، ')}» مجوز ورود به این بخش را ندارد.
          کنترل دسترسی در سمت سرور نیز اعمال می‌شود.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Link to={defaultHomeForRoles(user.roles)} className="cp-btn-primary">
            ورود به پنل من
          </Link>
          <Link to="/" className="cp-btn-secondary">
            صفحه اصلی
          </Link>
        </div>
      </div>
    );
  }

  return <>{children ?? <Outlet />}</>;
}
