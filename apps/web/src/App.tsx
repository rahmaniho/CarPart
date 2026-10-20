import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { canUsePanel, canUseSeller, useSessionStore } from './lib/session';
import { AdminLayout } from './components/AdminLayout';
import { SellerLayout } from './components/SellerLayout';
import { Spinner } from './components/ui';

const HomePage = lazy(() => import('./pages/public/HomePage'));
const SearchPage = lazy(() => import('./pages/public/SearchPage'));
const PartPage = lazy(() => import('./pages/public/PartPage'));
const StorePage = lazy(() => import('./pages/public/StorePage'));
const LoginPage = lazy(() => import('./pages/public/AuthPages').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/public/AuthPages').then((m) => ({ default: m.RegisterPage })));
const CheckoutPage = lazy(() => import('./pages/account/AccountPages').then((m) => ({ default: m.CheckoutPage })));
const AccountOrdersPage = lazy(() => import('./pages/account/AccountPages').then((m) => ({ default: m.AccountOrdersPage })));
const AccountOrderDetailPage = lazy(() => import('./pages/account/AccountPages').then((m) => ({ default: m.AccountOrderDetailPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const VerificationsPage = lazy(() => import('./pages/VerificationsPage'));
const OrdersAdminPage = lazy(() => import('./pages/OrdersPages'));
const DeliveriesAdminPage = lazy(() => import('./pages/OrdersPages').then((m) => ({ default: m.DeliveriesAdminPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const CouponsPage = lazy(() => import('./pages/admin/CouponsAnnouncements').then((m) => ({ default: m.CouponsPage })));
const AnnouncementsPage = lazy(() => import('./pages/admin/CouponsAnnouncements').then((m) => ({ default: m.AnnouncementsPage })));
const PayoutsPage = lazy(() => import('./pages/admin/RefundsPayouts').then((m) => ({ default: m.PayoutsPage })));
const RefundsPage = lazy(() => import('./pages/admin/RefundsPayouts').then((m) => ({ default: m.RefundsPage })));
const SupportPage = lazy(() => import('./pages/admin/SupportPage'));
const SellerDashboard = lazy(() => import('./pages/seller/SellerDashboard'));
const SellerProducts = lazy(() => import('./pages/seller/SellerProducts'));
const SellerOrders = lazy(() => import('./pages/seller/SellerOrders'));
const SellerRequests = lazy(() => import('./pages/seller/SellerRequests'));
const SellerFinance = lazy(() => import('./pages/seller/SellerFinance'));
const SellerProfile = lazy(() => import('./pages/seller/SellerProfile'));

function RequirePanel({ children }: { children: ReactNode }): JSX.Element {
  const user = useSessionStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!canUsePanel(user)) return <Navigate to="/login" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}
function RequireSeller({ children }: { children: ReactNode }): JSX.Element {
  const user = useSessionStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!canUseSeller(user)) return <Navigate to="/login" replace />;
  return <SellerLayout>{children}</SellerLayout>;
}
function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  const user = useSessionStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function PageFallback(): JSX.Element {
  return <div className="flex min-h-[60vh] items-center justify-center"><Spinner label="در حال آماده‌سازی صفحه…" /></div>;
}

export default function App(): JSX.Element {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/parts/:id" element={<PartPage />} />
        <Route path="/sellers/:id" element={<StorePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/account/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
        <Route path="/account/orders" element={<RequireAuth><AccountOrdersPage /></RequireAuth>} />
        <Route path="/account/orders/:id" element={<RequireAuth><AccountOrderDetailPage /></RequireAuth>} />
        <Route path="/admin" element={<RequirePanel><DashboardPage /></RequirePanel>} />
        <Route path="/admin/users" element={<RequirePanel><UsersPage /></RequirePanel>} />
        <Route path="/admin/verifications" element={<RequirePanel><VerificationsPage /></RequirePanel>} />
        <Route path="/admin/orders" element={<RequirePanel><OrdersAdminPage /></RequirePanel>} />
        <Route path="/admin/deliveries" element={<RequirePanel><DeliveriesAdminPage /></RequirePanel>} />
        <Route path="/admin/settings" element={<RequirePanel><SettingsPage /></RequirePanel>} />
        <Route path="/admin/audit" element={<RequirePanel><AuditPage /></RequirePanel>} />
        <Route path="/admin/refunds" element={<RequirePanel><RefundsPage /></RequirePanel>} />
        <Route path="/admin/payouts" element={<RequirePanel><PayoutsPage /></RequirePanel>} />
        <Route path="/admin/coupons" element={<RequirePanel><CouponsPage /></RequirePanel>} />
        <Route path="/admin/announcements" element={<RequirePanel><AnnouncementsPage /></RequirePanel>} />
        <Route path="/admin/support" element={<RequirePanel><SupportPage /></RequirePanel>} />
        <Route path="/seller" element={<RequireSeller><SellerDashboard /></RequireSeller>} />
        <Route path="/seller/products" element={<RequireSeller><SellerProducts /></RequireSeller>} />
        <Route path="/seller/orders" element={<RequireSeller><SellerOrders /></RequireSeller>} />
        <Route path="/seller/requests" element={<RequireSeller><SellerRequests /></RequireSeller>} />
        <Route path="/seller/finance" element={<RequireSeller><SellerFinance /></RequireSeller>} />
        <Route path="/seller/profile" element={<RequireSeller><SellerProfile /></RequireSeller>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
