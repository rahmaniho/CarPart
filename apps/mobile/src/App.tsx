import { useEffect, useRef, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useSessionStore, hasRole } from './lib/session';
import type { SessionUser } from '@carpart/api-client';
import { api } from './lib/api';
import { applyNativeChrome, onBackButton, platformName, registerPushToken } from './lib/native';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MechanicHome from './pages/mechanic/MechanicHome';
import SearchPage from './pages/mechanic/SearchPage';
import { RequestDetailPage, RequestNewPage, RequestsPage } from './pages/mechanic/RequestsPages';
import { OrderDetailPage, OrdersPage } from './pages/mechanic/OrdersPages';
import NotificationsPage from './pages/mechanic/NotificationsPage';
import ProfilePage from './pages/mechanic/ProfilePage';
import CourierHome from './pages/courier/CourierHome';
import MissionDetailPage from './pages/courier/MissionDetailPage';
import CourierEarningsPage from './pages/courier/CourierEarningsPage';
import CourierProfilePage from './pages/courier/CourierProfilePage';
import SellerHome, { SellerProfile } from './pages/seller/SellerHome';
import SellerProducts from './pages/seller/SellerProducts';
import SellerOrders from './pages/seller/SellerOrders';
import SellerRequests from './pages/seller/SellerRequests';
import SellerFinance from './pages/seller/SellerFinance';

/** نگهبان مسیر: بدون نشست → ورود؛ بدون نقش → مسیر نقش خودش */
function homeFor(user: SessionUser | null): string {
  if (!user) return '/login';
  if (hasRole(user, 'seller')) return '/seller';
  if (hasRole(user, 'courier') && !hasRole(user, 'mechanic')) return '/courier';
  return '/mechanic';
}

function RequireRole({ role, children }: { role: 'mechanic' | 'courier' | 'seller'; children: ReactNode }): JSX.Element {
  const user = useSessionStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!hasRole(user, role)) {
    return <Navigate to={homeFor(user)} replace />;
  }
  return <>{children}</>;
}

const PUSH_TOKEN_KEY = 'carpart_push_token';

export default function App(): JSX.Element {
  const user = useSessionStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  // یکپارچه‌سازی نیتیو: نوار وضعیت برند + فقط یک listener برای دکمه بازگشت (با cleanup)
  useEffect(() => {
    void applyNativeChrome();
    let cleanup: (() => void) | undefined;
    void onBackButton(() => {
      const current = pathRef.current;
      const isRoot = ['/', '/login', '/register', '/mechanic', '/courier', '/seller'].includes(current);
      if (isRoot) return false; // رفتار پیش‌فرض سیستم (خروج از اپ در صفحه اصلی)
      navigate(-1);
      return true;
    }).then((dispose) => {
      cleanup = dispose;
    });
    return () => cleanup?.();
  }, [navigate]);

  // اعلان فشاری: فقط وقتی کاربر وارد شده (و با تأخیر تا آماده شدن کامل UI)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const registered = await registerPushToken();
          if (cancelled || !registered) return;
          await api.notifications
            .registerDeviceToken({
              token: registered.token,
              platform: platformName(),
              appFlavor: hasRole(user, 'courier') ? 'courier' : hasRole(user, 'seller') ? 'seller' : 'mechanic',
            })
            .then(() => localStorage.setItem(PUSH_TOKEN_KEY, registered.token))
            .catch(() => undefined);
        } catch {
          /* اعلان فشاری هرگز نباید اپ را بشکند */
        }
      })();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user]);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user)} replace /> : <LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/mechanic" element={<RequireRole role="mechanic"><MechanicHome /></RequireRole>} />
      <Route path="/mechanic/search" element={<RequireRole role="mechanic"><SearchPage /></RequireRole>} />
      <Route path="/mechanic/requests" element={<RequireRole role="mechanic"><RequestsPage /></RequireRole>} />
      <Route path="/mechanic/requests/new" element={<RequireRole role="mechanic"><RequestNewPage /></RequireRole>} />
      <Route path="/mechanic/requests/:id" element={<RequireRole role="mechanic"><RequestDetailPage /></RequireRole>} />
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

      <Route path="*" element={<Navigate to={homeFor(user)} replace />} />
    </Routes>
  );
}
