import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useSessionStore } from '../../lib/session';
import { AppShell, type TabDef } from '../../components/AppShell';
import { EmptyState, Section, Spinner, StatusChip } from '../../components/ui';
import { RoleHero } from '../../components/RoleHero';
import { dateFa, formatToman } from '../../lib/format';

export const MECHANIC_TABS: TabDef[] = [
  { to: '/mechanic', label: 'خانه', icon: '🏠' },
  { to: '/mechanic/requests', label: 'درخواست‌ها', icon: '📋' },
  { to: '/mechanic/orders', label: 'سفارش‌ها', icon: '🧾' },
  { to: '/mechanic/notifications', label: 'اعلان‌ها', icon: '🔔' },
  { to: '/mechanic/profile', label: 'پروفایل', icon: '👤' },
];

export default function MechanicHome(): JSX.Element {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const [q, setQ] = useState('');

  const orders = useQuery({
    queryKey: ['orders', 'home'],
    queryFn: () => api.orders.list({ pageSize: 3 }),
  });

  const announcements = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.settings.announcements(),
  });

  return (
    <AppShell title={`سلام، ${user?.fullName ?? 'همکار گرامی'}`} tabs={MECHANIC_TABS}>
      <RoleHero
        variant="mechanic"
        eyebrow="تأمین هوشمند قطعه"
        title="قطعهٔ درست، بدون اتلاف وقت"
        description="جست‌وجوی دقیق بر اساس خودرو، مقایسهٔ شفاف فروشندگان و پیگیری یکپارچه تا تحویل."
        action={<button type="button" className="cp-btn bg-white text-slate-950 shadow-lg" onClick={() => navigate('/mechanic/search')}>شروع جست‌وجو ←</button>}
      />
      <form
        className="cp-card space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(`/mechanic/search?q=${encodeURIComponent(q)}`);
        }}
      >
        <label className="cp-label" htmlFor="home-search">
          چه قطعه‌ای لازم دارید؟
        </label>
        <div className="flex gap-2">
          <input
            id="home-search"
            className="cp-field"
            placeholder="مثلاً: لنت ترمز جلو پراید"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <button type="submit" className="cp-btn-primary shrink-0">
            جست‌وجو
          </button>
        </div>
        <button type="button" className="cp-btn-ghost w-full" onClick={() => navigate('/mechanic/requests/new')}>
          📣 ثبت درخواست قیمت (استعلام از فروشندگان)
        </button>
      </form>

      <Section
        title="آخرین سفارش‌ها"
        action={
          <button type="button" className="text-xs font-semibold text-primary" onClick={() => navigate('/mechanic/orders')}>
            همه
          </button>
        }
      >
        {orders.isLoading ? <Spinner /> : null}
        {orders.isError ? <EmptyState title="دریافت سفارش‌ها ممکن نشد" hint="اتصال خود را بررسی کنید" /> : null}
        {orders.data && orders.data.items.length === 0 ? (
          <EmptyState title="هنوز سفارشی ثبت نکرده‌اید" hint="از جست‌وجوی قطعه یا ثبت درخواست قیمت شروع کنید." />
        ) : null}
        <div className="space-y-2">
          {(orders.data?.items ?? []).map((order) => (
            <button key={order.id} type="button" className="cp-card w-full text-start" onClick={() => navigate(`/mechanic/orders/${order.id}`)}>
              <div className="flex items-center justify-between">
                <b className="text-sm" dir="ltr">
                  {order.code}
                </b>
                <StatusChip status={order.status} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>{dateFa(order.createdAt, false)}</span>
                <span className="font-bold text-ink">{formatToman(order.payableTotal)}</span>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {announcements.data?.length ? (
        <Section title="اطلاعیه‌ها">
          <div className="space-y-2">
            {announcements.data.slice(0, 3).map((item, index) => (
              <div key={index} className="cp-card border-sky-200 bg-sky-50 text-xs leading-6">
                <b className="block text-sm">{String((item as { titleFa?: string }).titleFa ?? 'اطلاعیه')}</b>
                {String((item as { bodyFa?: string }).bodyFa ?? '')}
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </AppShell>
  );
}
