import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { SessionUser } from '@carpart/api-client';
import { Spinner } from './components/ui';
import { useSessionStore, hasRole } from './lib/session';
import { api } from './lib/api';
import { applyNativeChrome, onBackButton, platformName, registerPushToken } from './lib/native';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const MechanicHome = lazy(() => import('./pages/mechanic/MechanicHome'));
const SearchPage = lazy(() => import('./pages/mechanic/SearchPage'));
const CheckoutPage = lazy(() => import('./pages/mechanic/CheckoutPage'));
const SupportPage = lazy(() => import('./pages/mechanic/SupportPage'));
const NotificationsPage = lazy(() => import('./pages/mechanic/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/mechanic/ProfilePage'));
const RequestsPage = lazy(() => import('./pages/mechanic/RequestsPages').then((m) => ({ default: m.RequestsPage })));
const RequestNewPage = lazy(() => import('./pages/mechanic/RequestsPages').then((m) => ({ default: m.RequestNewPage })));
const RequestDetailPage = lazy(() => import('./pages/mechanic/RequestsPages').then((m) => ({ default: m.RequestDetailPage })));
const OrdersPage = lazy(() => import('./pages/mechanic/OrdersPages').then((m) => ({ default: m.OrdersPage })));
const OrderDetailPage = lazy(() => import('./pages/mechanic/OrdersPages').then((m) => ({ default: m.OrderDetailPage })));
const CourierHome = lazy(() => import('./pages/courier/CourierHome'));
const MissionDetailPage = lazy(() => import('./pages/courier/MissionDetailPage'));
const CourierEarningsPage = lazy(() => import('./pages/courier/CourierEarningsPage'));
const CourierProfilePage = lazy(() => import('./pages/courier/CourierProfilePage'));
const SellerHome = lazy(() => import('./pages/seller/SellerHome'));
const SellerProfile = lazy(() => import('./pages/seller/SellerHome').then((m) => ({ default: m.SellerProfile })));
const SellerProducts = lazy(() => import('./pages/seller/SellerProducts'));
const SellerOrders = lazy(() => import('./pages/seller/SellerOrders'));
const SellerRequests = lazy(() => import('./pages/seller/SellerRequests'));
const SellerFinance = lazy(() => import('./pages/seller/SellerFinance'));
const AdminHome = lazy(() => import('./pages/admin/AdminHome'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'));
const AdminOperations = lazy(() => import('./pages/admin/AdminOperations'));

function homeFor(user: SessionUser | null): string {
  if (!user) return '/login';
  if (hasRole(user, 'admin') || hasRole(user, 'operator')) return '/admin';
  if (hasRole(user, 'seller') && !hasRole(user, 'mechanic') && !hasRole(user, 'courier')) return '/seller';
  if (hasRole(user, 'courier') && !hasRole(user, 'mechanic') && !hasRole(user, 'seller')) return '/courier';
  if (hasRole(user, 'mechanic')) return '/mechanic';
  if (hasRole(user, 'seller')) return '/seller';
  if (hasRole(user, 'courier')) return '/courier';
  return '/unsupported';
}

function UnsupportedRole(): JSX.Element {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);
  return <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center"><div className="text-4xl">🔐</div><h1 className="text-lg font-extrabold">نقش حساب پشتیبانی نمی‌شود</h1><p className="text-sm leading-7 text-muted">{user?.fullName ?? ''} عزیز، برای حساب شما نقش قابل استفاده‌ای ثبت نشده است.</p><button type="button" className="cp-btn-ghost text-red-700" onClick={async () => { await api.auth.logout().catch(() => undefined); clear(); navigate('/login', { replace: true }); }}>خروج و ورود با حساب دیگر</button></div>;
}

type AppRole = 'mechanic' | 'courier' | 'seller';
function RequireRole({ role, children }: { role: AppRole; children: ReactNode }): JSX.Element {
  const user = useSessionStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return hasRole(user, role) ? <>{children}</> : <Navigate to={homeFor(user)} replace />;
}
function RequireStaff({ children }: { children: ReactNode }): JSX.Element {
  const user = useSessionStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return hasRole(user, 'admin') || hasRole(user, 'operator') ? <>{children}</> : <Navigate to={homeFor(user)} replace />;
}

const PUSH_TOKEN_KEY = 'carpart_push_token';

export default function App(): JSX.Element {
  const user = useSessionStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    void applyNativeChrome();
    let cleanup: (() => void) | undefined;
    void onBackButton(() => {
      const current = pathRef.current;
      const isRoot = ['/', '/login', '/register', '/mechanic', '/courier', '/seller', '/admin'].includes(current);
      if (isRoot) return false;
      navigate(-1);
      return true;
    }).then((dispose) => { cleanup = dispose; });
    return () => cleanup?.();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const registered = await registerPushToken();
          if (cancelled || !registered) return;
          const appFlavor = hasRole(user, 'admin') || hasRole(user, 'operator') ? 'admin' : hasRole(user, 'courier') ? 'courier' : hasRole(user, 'seller') ? 'seller' : 'mechanic';
          await api.notifications.registerDeviceToken({ token: registered.token, platform: platformName(), appFlavor }).then(() => localStorage.setItem(PUSH_TOKEN_KEY, registered.token)).catch(() => undefined);
        } catch { /* اعلان فشاری نباید اپ را بشکند */ }
      })();
    }, 2500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [user]);

  return (
    <Suspense fallback={<div className="mx-auto flex min-h-full max-w-md items-center justify-center bg-slate-50"><Spinner label="در حال آماده‌سازی…" /></div>}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={homeFor(user)} replace /> : <LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/mechanic" element={<RequireRole role="mechanic"><MechanicHome /></RequireRole>} />
        <Route path="/mechanic/search" element={<RequireRole role="mechanic"><SearchPage /></RequireRole>} />
        <Route path="/mechanic/requests" element={<RequireRole role="mechanic"><RequestsPage /></RequireRole>} />
        <Route path="/mechanic/requests/new" element={<RequireRole role="mechanic"><RequestNewPage /></RequireRole>} />
        <Route path="/mechanic/requests/:id" element={<RequireRole role="mechanic"><RequestDetailPage /></RequireRole>} />
        <Route path="/mechanic/checkout" element={<RequireRole role="mechanic"><CheckoutPage /></RequireRole>} />
        <Route path="/mechanic/support" element={<RequireRole role="mechanic"><SupportPage /></RequireRole>} />
        <Route path="/mechanic/orders" element={<RequireRole role="mechanic"><OrdersPage /></RequireRole>} />
        <Route path="/mechanic/orders/:id" element={<RequireRole role="mechanic"><OrderDetailPage /></RequireRole>} />
        <Route path="/mechanic/notifications" element={<RequireRole role="mechanic"><NotificationsPage /></RequireRole>} />
        <Route path="/mechanic/profile" element={<RequireRole role="mechanic"><ProfilePage /></RequireRole>} />
        <Route path="/courier" element={<RequireRole role="courier"><CourierHome /></RequireRole>} />
        <Route path="/courier/missions/:id" element={<RequireRole role="courier"><MissionDetailPage /></RequireRole>} />
        <Route path="/courier/earnings" element={<RequireRole role="courier"><CourierEarningsPage /></RequireRole>} />
        <Route path="/courier/profile" element={<RequireRole role="courier"><CourierProfilePage /></RequireRole>} />
        <Route path="/seller" element={<RequireRole role="seller"><SellerHome /></RequireRole>} />
        <Route path="/seller/products" element={<RequireRole role="seller"><SellerProducts /></RequireRole>} />
        <Route path="/seller/orders" element={<RequireRole role="seller"><SellerOrders /></RequireRole>} />
        <Route path="/seller/requests" element={<RequireRole role="seller"><SellerRequests /></RequireRole>} />
        <Route path="/seller/finance" element={<RequireRole role="seller"><SellerFinance /></RequireRole>} />
        <Route path="/seller/profile" element={<RequireRole role="seller"><SellerProfile /></RequireRole>} />
        <Route path="/admin" element={<RequireStaff><AdminHome /></RequireStaff>} />
        <Route path="/admin/users" element={<RequireStaff><AdminUsers /></RequireStaff>} />
        <Route path="/admin/reviews" element={<RequireStaff><AdminReviews /></RequireStaff>} />
        <Route path="/admin/operations" element={<RequireStaff><AdminOperations /></RequireStaff>} />
        <Route path="/unsupported" element={user ? <UnsupportedRole /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={homeFor(user)} replace />} />
      </Routes>
    </Suspense>
  );
}
