import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { AppShell, type TabDef } from '../../components/AppShell';

export const SELLER_TABS: TabDef[] = [
  { to: '/seller', label: 'خانه', icon: '🏠' },
  { to: '/seller/products', label: 'محصولات', icon: '📦' },
  { to: '/seller/orders', label: 'سفارش‌ها', icon: '🧾' },
  { to: '/seller/requests', label: 'درخواست‌ها', icon: '📋' },
  { to: '/seller/finance', label: 'مالی', icon: '💰' },
];

/** پوسته مشترک پنل فروشنده + بنر وضعیت تأیید */
export function SellerShell({ title, children, headerExtra }: { title: string; children: ReactNode; headerExtra?: ReactNode }): JSX.Element {
  const profile = useQuery({ queryKey: ['seller-me'], queryFn: () => api.sellers.me() });
  const notApproved = profile.data && profile.data.verificationStatus !== 'APPROVED';

  return (
    <AppShell title={title} tabs={SELLER_TABS} headerExtra={headerExtra}>
      {notApproved ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
          حساب فروشگاه هنوز تأیید نشده است ({String(profile.data?.verificationStatus === 'DRAFT' ? 'پیش‌نویس' : 'در انتظار بررسی')}). تا تأیید مدیر، ثبت
          محصول و پیشنهاد ممکن نیست. <Link className="font-semibold underline" to="/seller/profile">تکمیل اطلاعات فروشگاه</Link>
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
