import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { canUsePanel, useSessionStore } from './lib/session';
import { AdminLayout } from './components/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import VerificationsPage from './pages/VerificationsPage';
import OrdersAdminPage, { DeliveriesAdminPage } from './pages/OrdersPages';
import SettingsPage from './pages/SettingsPage';
import AuditPage from './pages/AuditPage';

function RequirePanel({ children }: { children: ReactNode }): JSX.Element {
  const user = useSessionStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!canUsePanel(user)) return <Navigate to="/login" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

export default function App(): JSX.Element {
  const user = useSessionStore((s) => s.user);
  return (
    <Routes>
      <Route path="/login" element={user && canUsePanel(user) ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<RequirePanel><DashboardPage /></RequirePanel>} />
      <Route path="/users" element={<RequirePanel><UsersPage /></RequirePanel>} />
      <Route path="/verifications" element={<RequirePanel><VerificationsPage /></RequirePanel>} />
      <Route path="/orders" element={<RequirePanel><OrdersAdminPage /></RequirePanel>} />
      <Route path="/deliveries" element={<RequirePanel><DeliveriesAdminPage /></RequirePanel>} />
      <Route path="/settings" element={<RequirePanel><SettingsPage /></RequirePanel>} />
      <Route path="/audit" element={<RequirePanel><AuditPage /></RequirePanel>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
