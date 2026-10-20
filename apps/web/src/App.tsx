import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { canUsePanel, canUseSeller, useSessionStore } from './lib/session';
import { AdminLayout } from './components/AdminLayout';
import { SellerLayout } from './components/SellerLayout';
import HomePage from './pages/public/HomePage';
import SearchPage from './pages/public/SearchPage';
import PartPage from './pages/public/PartPage';
import StorePage from './pages/public/StorePage';
import { LoginPage, RegisterPage } from './pages/public/AuthPages';
import { AccountOrderDetailPage, AccountOrdersPage, CheckoutPage } from './pages/account/AccountPages';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import VerificationsPage from './pages/VerificationsPage';
import OrdersAdminPage, { DeliveriesAdminPage } from './pages/OrdersPages';
import SettingsPage from './pages/SettingsPage';
import AuditPage from './pages/AuditPage';
import { CouponsPage, AnnouncementsPage } from './pages/admin/CouponsAnnouncements';
import { PayoutsPage, RefundsPage } from './pages/admin/RefundsPayouts';
import SupportPage from './pages/admin/SupportPage';
import SellerDashboard from './pages/seller/SellerDashboard';
import SellerProducts from './pages/seller/SellerProducts';
import SellerOrders from './pages/seller/SellerOrders';
import SellerRequests from './pages/seller/SellerRequests';
import SellerFinance from './pages/seller/SellerFinance';
import SellerProfile from './pages/seller/SellerProfile';

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

export default function App(): JSX.Element {
  return (
    <Routes>
      {/* صفحات عمومی */}
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/parts/:id" element={<PartPage />} />
      <Route path="/sellers/:id" element={<StorePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* حساب کاربری (خرید و سفارش در وب) */}
      <Route path="/account/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
      <Route path="/account/orders" element={<RequireAuth><AccountOrdersPage /></RequireAuth>} />
      <Route path="/account/orders/:id" element={<RequireAuth><AccountOrderDetailPage /></RequireAuth>} />

      {/* پنل مدیریت */}
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

      {/* پنل فروشنده */}
      <Route path="/seller" element={<RequireSeller><SellerDashboard /></RequireSeller>} />
      <Route path="/seller/products" element={<RequireSeller><SellerProducts /></RequireSeller>} />
      <Route path="/seller/orders" element={<RequireSeller><SellerOrders /></RequireSeller>} />
      <Route path="/seller/requests" element={<RequireSeller><SellerRequests /></RequireSeller>} />
      <Route path="/seller/finance" element={<RequireSeller><SellerFinance /></RequireSeller>} />
      <Route path="/seller/profile" element={<RequireSeller><SellerProfile /></RequireSeller>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
