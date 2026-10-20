import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSessionStore, hasRole } from './lib/session';
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

/** نگهبان مسیر: بدون نشست → ورود؛ بدون نقش → مسیر نقش خودش */
function RequireRole({ role, children }: { role: 'mechanic' | 'courier'; children: ReactNode }): JSX.Element {
  const user = useSessionStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!hasRole(user, role)) {
    return <Navigate to={hasRole(user, 'courier') ? '/courier' : '/mechanic'} replace />;
  }
  return <>{children}</>;
}

export default function App(): JSX.Element {
  const user = useSessionStore((s) => s.user);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={hasRole(user, 'mechanic') ? '/mechanic' : '/courier'} replace /> : <LoginPage />} />
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

      <Route path="*" element={<Navigate to={user ? (hasRole(user, 'mechanic') ? '/mechanic' : '/courier') : '/login'} replace />} />
    </Routes>
  );
}
