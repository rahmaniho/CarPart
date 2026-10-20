import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { compactMoney, toFaDigits } from '../../lib/format';
import { SellerLayout } from '../../components/SellerLayout';
import { ErrorBox, PageHeader, Spinner, StatCard } from '../../components/ui';

/** داشبورد فروشنده — داده واقعی از پایگاه‌داده */
export default function SellerDashboard(): JSX.Element {
  const dashboard = useQuery({ queryKey: ['seller-dashboard'], queryFn: () => api.sellers.dashboard() });
  const stats = (dashboard.data ?? {}) as Record<string, number>;
  const profile = useQuery({ queryKey: ['seller-me'], queryFn: () => api.sellers.me() });

  const notApproved = profile.data && profile.data.verificationStatus !== 'APPROVED';

  return (
    <SellerLayout
      banner={
        notApproved ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
            حساب فروشگاه شما هنوز تأیید نشده است ({String(profile.data?.verificationStatus === 'DRAFT' ? 'پیش‌نویس' : 'در انتظار بررسی')}). تا زمان تأیید مدیر،
            ثبت محصول و پیشنهاد قیمت ممکن نیست. اطلاعات را در{' '}
            <Link className="font-semibold underline" to="/seller/profile">
              صفحه فروشگاه
            </Link>{' '}
            تکمیل و ارسال کنید.
          </div>
        ) : null
      }
    >
      <PageHeader title="داشبورد فروشگاه" actions={<button type="button" className="cp-btn-ghost" onClick={() => void dashboard.refetch()}>به‌روزرسانی</button>} />
      {dashboard.isLoading ? <Spinner /> : null}
      {dashboard.isError ? <ErrorBox message="دریافت داشبورد ممکن نشد" onRetry={() => dashboard.refetch()} /> : null}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="سفارش‌های امروز" value={toFaDigits(Number(stats.ordersToday ?? 0))} />
        <StatCard label="سفارش‌های در جریان" value={toFaDigits(Number(stats.ordersInProgress ?? stats.activeOrders ?? 0))} tone="primary" />
        <StatCard label="درآمد (تومان)" value={compactMoney(Number(stats.revenue ?? stats.totalRevenue ?? 0))} tone="money" />
        <StatCard label="موجودی رو به پایان" value={toFaDigits(Number(stats.lowStockCount ?? 0))} hint="محصولات با موجودی کم" />
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="پیشنهادهای ارسال‌شده" value={toFaDigits(Number(stats.quotesSubmitted ?? 0))} />
        <StatCard label="پیشنهادهای پذیرفته‌شده" value={toFaDigits(Number(stats.quotesAccepted ?? 0))} />
        <StatCard label="نرخ پاسخ‌گویی" value={stats.responseRate !== undefined ? `${toFaDigits(Math.round(Number(stats.responseRate)))}٪` : '—'} />
        <StatCard label="میانگین امتیاز" value={toFaDigits(Number(profile.data?.ratingAvg ?? 0))} hint={`از ${toFaDigits(Number(profile.data?.ratingCount ?? 0))} نظر`} />
      </section>
    </SellerLayout>
  );
}
