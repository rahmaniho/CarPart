import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { compactMoney, dateFa, toFaDigits } from '../../lib/format';
import { ErrorBox, Section, Spinner, StatCard } from '../../components/ui';
import { RoleHero } from '../../components/RoleHero';
import { AdminShell } from './AdminShell';

export default function AdminHome(): JSX.Element {
  const navigate = useNavigate();
  const dashboard = useQuery({ queryKey: ['admin-mobile-dashboard'], queryFn: () => api.admin.dashboard(30), refetchInterval: 60_000 });
  const data = dashboard.data;
  const pending = data ? data.verifications.seller + data.verifications.courier + data.verifications.workshop : 0;

  return (
    <AdminShell
      title="مرکز فرمان کارپارت"
      headerExtra={<button type="button" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white" onClick={() => void dashboard.refetch()} aria-label="به‌روزرسانی داشبورد">↻ تازه‌سازی</button>}
    >
      <RoleHero
        variant="admin"
        eyebrow="پایش زندهٔ سامانه"
        title="تصمیم دقیق با دادهٔ واقعی"
        description="نمای فشرده از سلامت عملیات، سفارش‌ها، درآمد و صف‌های نیازمند رسیدگی."
        metric={data ? `به‌روزرسانی ${dateFa(data.generatedAt, false)}` : 'در حال دریافت داده…'}
      />
      {dashboard.isLoading ? <Spinner label="در حال همگام‌سازی داشبورد…" /> : null}
      {dashboard.isError ? <ErrorBox message="دریافت داشبورد مدیریت ممکن نشد" onRetry={() => void dashboard.refetch()} /> : null}
      {data ? (
        <>
          <section className="grid grid-cols-2 gap-2">
            <StatCard label="کاربران فعال" value={toFaDigits(data.users.active)} />
            <StatCard label="سفارش امروز" value={toFaDigits(data.orders.today)} tone="primary" />
            <StatCard label="گردش مالی ۳۰ روز" value={compactMoney(data.money.gmv)} tone="money" />
            <StatCard label="درآمد پلتفرم" value={compactMoney(data.money.platformRevenue)} tone="money" />
          </section>
          <Section title="نیازمند اقدام">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="cp-card text-start" onClick={() => navigate('/admin/reviews')}>
                <span className="text-2xl font-black text-blue-600">{toFaDigits(pending)}</span>
                <span className="mt-1 block text-xs font-bold">تأیید هویت</span>
              </button>
              <button type="button" className="cp-card text-start" onClick={() => navigate('/admin/operations')}>
                <span className="text-2xl font-black text-amber-600">{toFaDigits(data.support.openTickets)}</span>
                <span className="mt-1 block text-xs font-bold">تیکت باز</span>
              </button>
              <div className="cp-card">
                <span className="text-2xl font-black text-violet-600">{toFaDigits(data.delivery.waitingForCourier)}</span>
                <span className="mt-1 block text-xs font-bold">در انتظار پیک</span>
              </div>
              <div className="cp-card">
                <span className="text-2xl font-black text-rose-600">{toFaDigits(data.orders.awaitingPayment)}</span>
                <span className="mt-1 block text-xs font-bold">در انتظار پرداخت</span>
              </div>
            </div>
          </Section>
          {data.payments.sandboxActive ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-6 text-amber-900">درگاه پرداخت در حالت آزمایشی (Sandbox) است؛ تراکنش‌ها پرداخت واقعی محسوب نمی‌شوند.</div> : null}
        </>
      ) : null}
    </AdminShell>
  );
}
