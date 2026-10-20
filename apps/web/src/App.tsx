import { PANEL_ROLES } from '@carpart/contract';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout, RequirePanelAccess } from './components/layout/AppLayout';
import {
  AdminCatalogPage,
  AdminDashboardPage,
  AdminFinancePage,
  AdminOperationsPage,
  AdminPanelLayout,
  AdminSettingsAndAuditPage,
  AdminSupportPage,
  AdminUsersAndVerificationPage,
} from './pages/AdminPanelPages';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { CartPage } from './pages/CartPage';
import {
  CourierDashboardPage,
  CourierMissionsPage,
  CourierPanelLayout,
  CourierProfilePage,
} from './pages/CourierPanelPages';
import {
  MechanicGaragePage,
  MechanicOrderDetailPage,
  MechanicOrdersPage,
  MechanicOverviewPage,
  MechanicPanelLayout,
  MechanicRequestDetailPage,
  MechanicRequestsListPage,
  NewPartRequestPage,
} from './pages/MechanicPanelPages';
import { HomePage, PartDetailPage, PublicSellerPage, SearchPage } from './pages/PublicPages';
import {
  SellerDashboardPage,
  SellerFinancePage,
  SellerOrdersPage,
  SellerPanelLayout,
  SellerProductsPage,
  SellerProfilePage,
  SellerRequestsPage,
} from './pages/SellerPanelPages';
import { AccountSecurityPage, NotificationsPage, SupportCenterPage } from './pages/SharedAccountPages';
import { useAuthStore } from './store/auth-store';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* صفحات عمومی */}
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="parts/:id" element={<PartDetailPage />} />
        <Route path="sellers/:id" element={<PublicSellerPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        {/* صفحات مشترک کاربران احرازهویت‌شده */}
        <Route element={<RequirePanelAccess />}>
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="support" element={<SupportCenterPage />} />
          <Route path="account" element={<AccountSecurityPage />} />
        </Route>

        {/* پنل ۱: مکانیک / تعمیرگاه */}
        <Route element={<RequirePanelAccess allowed={PANEL_ROLES.mechanic} />}>
          <Route path="mechanic" element={<MechanicPanelLayout />}>
            <Route index element={<MechanicOverviewPage />} />
            <Route path="orders" element={<MechanicOrdersPage />} />
            <Route path="orders/:id" element={<MechanicOrderDetailPage />} />
            <Route path="requests" element={<MechanicRequestsListPage />} />
            <Route path="requests/new" element={<NewPartRequestPage />} />
            <Route path="requests/:id" element={<MechanicRequestDetailPage />} />
            <Route path="garage" element={<MechanicGaragePage />} />
          </Route>
        </Route>

        {/* پنل ۲: فروشنده لوازم یدکی */}
        <Route element={<RequirePanelAccess allowed={PANEL_ROLES.seller} />}>
          <Route path="seller" element={<SellerPanelLayout />}>
            <Route index element={<SellerDashboardPage />} />
            <Route path="products" element={<SellerProductsPage />} />
            <Route path="requests" element={<SellerRequestsPage />} />
            <Route path="orders" element={<SellerOrdersPage />} />
            <Route path="finance" element={<SellerFinancePage />} />
            <Route path="profile" element={<SellerProfilePage />} />
          </Route>
        </Route>

        {/* پنل ۳: پیک / راننده */}
        <Route element={<RequirePanelAccess allowed={PANEL_ROLES.courier} />}>
          <Route path="courier" element={<CourierPanelLayout />}>
            <Route index element={<CourierDashboardPage />} />
            <Route path="missions" element={<CourierMissionsPage />} />
            <Route path="profile" element={<CourierProfilePage />} />
          </Route>
        </Route>

        {/* پنل ۴: مدیر پلتفرم / اپراتور پشتیبانی */}
        <Route element={<RequirePanelAccess allowed={PANEL_ROLES.admin} />}>
          <Route path="admin" element={<AdminPanelLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersAndVerificationPage />} />
            <Route path="operations" element={<AdminOperationsPage />} />
            <Route path="catalog" element={<AdminCatalogPage />} />
            <Route path="finance" element={<AdminFinancePage />} />
            <Route path="support" element={<AdminSupportPage />} />
            <Route path="settings" element={<AdminSettingsAndAuditPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </BrowserRouter>
  );
}
