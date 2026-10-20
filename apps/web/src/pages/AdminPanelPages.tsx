import {
  DELIVERY_STATUS_META,
  ORDER_STATUS_META,
  PAYOUT_STATUS_META,
  RETURN_STATUS_META,
  ROLE_LABELS_FA,
  TICKET_STATUS_META,
  VERIFICATION_STATUS_META,
  can,
  formatJalali,
  formatToman,
  toPersianDigits,
  type Page,
  type Role,
} from '@carpart/contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  HeadphonesIcon,
  Landmark,
  LayoutDashboard,
  ScrollText,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PanelShell } from '../components/layout/AppLayout';
import { EmptyState, ErrorAlert, LoadingState, StatCard, StatusBadge, StatusFromMap } from '../components/ui/Primitives';
import { api } from '../lib/api-client';
import type {
  AdminDashboardDto,
  CategoryNode,
  DeliveryMissionDto,
  OrderDetailDto,
  PayoutItemDto,
  ReturnRequestDto,
  TicketDto,
} from '../lib/types';
import { useAuthStore } from '../store/auth-store';
import { useToastStore } from '../store/toast-store';

export function AdminPanelLayout() {
  const user = useAuthStore((s) => s.user);
  const roles = user?.roles ?? [];
  const isAdmin = roles.includes('admin');

  return (
    <PanelShell
      roleBadge={isAdmin ? 'پنل مدیر کل پلتفرم' : 'پنل اپراتور پشتیبانی'}
      title="مرکز فرماندهی و نظارت"
      subtitle="شاخص‌های واقعی، عملیات، مالی، پشتیبانی و حسابرسی"
      items={[
        { to: '/admin', label: 'داشبورد و گزارش‌ها', icon: <LayoutDashboard className="h-4 w-4" />, exact: true },
        { to: '/admin/users', label: 'کاربران و احراز هویت', icon: <Users className="h-4 w-4" /> },
        { to: '/admin/operations', label: 'سفارش‌ها و دیسپاچ پیک', icon: <Truck className="h-4 w-4" /> },
        { to: '/admin/catalog', label: 'کاتالوگ مرجع قطعات', icon: <Database className="h-4 w-4" /> },
        { to: '/admin/finance', label: 'مالی، کوپن و تسویه', icon: <Landmark className="h-4 w-4" /> },
        { to: '/admin/support', label: 'تیکت، مرجوعی و دیدگاه', icon: <HeadphonesIcon className="h-4 w-4" /> },
        ...(can(roles, 'setting:manage') || can(roles, 'audit:read')
          ? [{ to: '/admin/settings', label: 'تنظیمات و لاگ حسابرسی', icon: <Settings className="h-4 w-4" /> }]
          : []),
      ]}
    />
  );
}

/* ============================= ۱) داشبورد اجرایی و نمودار روزانه ============================= */
interface DailyReportPoint {
  date: string;
  jalali: string;
  orders: number;
  gmv: number;
  platformRevenue: number;
  requests: number;
}

export function AdminDashboardPage() {
  const dashQuery = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get<AdminDashboardDto>('admin/dashboard'),
  });

  const dailyQuery = useQuery({
    queryKey: ['admin-daily-report'],
    queryFn: () => api.get<DailyReportPoint[]>('admin/reports/daily', { days: 14 }),
  });

  if (dashQuery.isLoading) return <LoadingState />;
  if (dashQuery.error || !dashQuery.data) {
    return <ErrorAlert error={dashQuery.error} onRetry={() => dashQuery.refetch()} />;
  }

  const d = dashQuery.data;

  return (
    <div className="space-y-6">
      {/* تفکیک شفاف GMV از درآمد پلتفرم طبق بند صراحت مالی */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="گردش ناخالص کالا (GMV)"
          value={formatToman(d.money.gmv)}
          sub="کل مبلغ اقلام سفارش‌های تکمیل‌شده"
          tone="brand"
        />
        <StatCard
          label="درآمد خالص پلتفرم (کارمزد)"
          value={formatToman(d.money.platformRevenue)}
          sub="تفکیک‌شده از سهم فروشنده و پیک"
          tone="emerald"
        />
        <StatCard
          label="کل سفارش‌ها"
          value={d.orders.total}
          sub={`در جریان فعلی: ${toPersianDigits(d.orders.inProgress)} • امروز: ${toPersianDigits(d.orders.today)}`}
        />
        <StatCard
          label="صف اقدام فوری عملیات"
          value={d.verifications.seller + d.verifications.courier + d.support.openTickets}
          sub={`احراز هویت: ${toPersianDigits(d.verifications.seller + d.verifications.courier)} • تیکت باز: ${toPersianDigits(d.support.openTickets)}`}
          tone="amber"
        />
      </div>

      <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3 text-xs text-brand-950">
        <strong>یادداشت شفافیت مالی:</strong> {d.money.note} (سهم خالص فروشندگان: {formatToman(d.money.sellerNet)} • سهم
        پیک‌ها: {formatToman(d.money.courierShare)} • مانده تسویه‌نشده: {formatToman(d.money.pendingPayout)})
      </div>

      {/* نمودار روند ۱۴ روزه واقعی از دیتابیس */}
      {dailyQuery.data && dailyQuery.data.length > 0 && (
        <div className="cp-card p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900">
            روند ۱۴ روزه گردش ناخالص (GMV) در برابر درآمد پلتفرم (تومان)
          </h2>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyQuery.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="jalali" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="gmv" name="GMV (تومان)" fill="#0f766e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="platformRevenue" name="درآمد کارمزد (تومان)" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* برترین فروشندگان و آخرین رویدادهای حسابرسی */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="cp-card p-5 space-y-3 text-xs">
          <h3 className="text-sm font-extrabold text-slate-900">عملکرد فروشگاه‌های برتر</h3>
          <div className="divide-y divide-slate-100">
            {d.topSellers.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5">
                <span className="font-bold text-slate-900">{s.storeName}</span>
                <span className="text-slate-600">
                  {toPersianDigits(s.orders)} سفارش • فروش: {formatToman(s.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="cp-card p-5 space-y-3 text-xs">
          <h3 className="text-sm font-extrabold text-slate-900">آخرین وقایع ثبت‌شده در لاگ حسابرسی</h3>
          <div className="divide-y divide-slate-100">
            {d.recentAudit.map((log, idx) => (
              <div key={idx} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-mono font-bold text-slate-800 ltr-num">{log.action}</span>
                  <span className="mr-2 text-slate-500">({log.fa})</span>
                </div>
                <span className="text-[11px] text-slate-400">{formatJalali(log.at, { withTime: true })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================= ۲) مدیریت کاربران و احراز هویت ============================= */
interface AdminVerificationRow {
  kind: 'seller' | 'courier' | 'workshop';
  id: string;
  userId: string;
  displayName: string;
  city: string | null;
  status: string;
  submittedAt: string;
}

interface AdminUserRow {
  id: string;
  fullName: string;
  mobile: string;
  status: string;
  roles: Role[];
}

export function AdminUsersAndVerificationPage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const [queueStatus, setQueueStatus] = useState<'PENDING_REVIEW' | 'APPROVED'>('PENDING_REVIEW');

  const sellersQuery = useQuery({
    queryKey: ['admin-sellers-queue', queueStatus],
    queryFn: () => api.get<AdminVerificationRow[]>('admin/verifications/seller', { status: queueStatus }),
  });

  const couriersQuery = useQuery({
    queryKey: ['admin-couriers-queue', queueStatus],
    queryFn: () => api.get<AdminVerificationRow[]>('admin/verifications/courier', { status: queueStatus }),
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<Page<AdminUserRow>>('admin/users', { pageSize: 20 }),
    enabled: can(roles, 'user:read'),
  });

  const handleDecision = async (kind: 'seller' | 'courier', id: string, action: 'approve' | 'reject') => {
    await api.post(
      `admin/verifications/${kind}/${id}/${action}`,
      action === 'approve' ? { note: 'تأیید مدارک توسط واحد احراز هویت' } : { reason: 'نقص مدارک ارسالی' },
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-sellers-queue'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-couriers-queue'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    ]);
    pushToast({ tone: 'success', title: 'نتیجه بررسی احراز هویت ثبت و در لاگ ممیزی ذخیره شد' });
  };

  return (
    <div className="space-y-6 text-xs">
      <div className="cp-card flex items-center justify-between p-4">
        <span className="font-bold text-slate-900">فیلتر صف بررسی هویت:</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setQueueStatus('PENDING_REVIEW')}
            className={queueStatus === 'PENDING_REVIEW' ? 'cp-btn-primary text-xs' : 'cp-btn-secondary text-xs'}
          >
            در انتظار بررسی
          </button>
          <button
            type="button"
            onClick={() => setQueueStatus('APPROVED')}
            className={queueStatus === 'APPROVED' ? 'cp-btn-primary text-xs' : 'cp-btn-secondary text-xs'}
          >
            تأییدشده‌ها
          </button>
        </div>
      </div>

      {/* بررسی فروشندگان */}
      <div className="cp-card p-5 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900">صف احراز هویت فروشندگان</h2>
        {!sellersQuery.data?.length ? (
          <p className="text-slate-500">موردی در این وضعیت وجود ندارد.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {sellersQuery.data.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{s.displayName}</span>
                  <span className="text-slate-400">({s.city ?? '—'})</span>
                  <StatusFromMap value={s.status} map={VERIFICATION_STATUS_META} size="xs" />
                </div>
                {s.status !== 'APPROVED' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDecision('seller', s.id, 'approve')}
                      className="cp-btn-primary text-xs py-1 px-2.5"
                    >
                      تأیید صلاحیت
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision('seller', s.id, 'reject')}
                      className="cp-btn-danger text-xs py-1 px-2.5"
                    >
                      رد مدارک
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* بررسی پیک‌ها */}
      <div className="cp-card p-5 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900">صف احراز هویت پیک‌ها</h2>
        {!couriersQuery.data?.length ? (
          <p className="text-slate-500">موردی در این وضعیت وجود ندارد.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {couriersQuery.data.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{c.displayName}</span>
                  <span className="text-slate-400">({c.city ?? '—'})</span>
                  <StatusFromMap value={c.status} map={VERIFICATION_STATUS_META} size="xs" />
                </div>
                {c.status !== 'APPROVED' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDecision('courier', c.id, 'approve')}
                      className="cp-btn-primary text-xs py-1 px-2.5"
                    >
                      تأیید پیک
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision('courier', c.id, 'reject')}
                      className="cp-btn-danger text-xs py-1 px-2.5"
                    >
                      رد مدارک
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* فهرست کاربران سامانه */}
      {usersQuery.data && (
        <div className="cp-card p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900">فهرست کاربران سامانه</h2>
          <div className="divide-y divide-slate-100">
            {usersQuery.data.items.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <span className="font-bold text-slate-900">{u.fullName}</span>
                  <span className="mr-3 font-mono text-slate-500 ltr-num">{u.mobile}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.roles.map((r) => (
                    <StatusBadge key={r} tone="info" label={ROLE_LABELS_FA[r]} size="xs" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================= ۳) نظارت سفارش‌ها و دیسپاچ دستی پیک ============================= */
export function AdminOperationsPage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);

  const ordersQuery = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => api.get<Page<OrderDetailDto>>('admin/orders', { pageSize: 20 }),
  });

  const deliveriesQuery = useQuery({
    queryKey: ['admin-deliveries'],
    queryFn: () => api.get<Page<DeliveryMissionDto>>('admin/deliveries', { pageSize: 20 }),
  });

  const couriersQuery = useQuery({
    queryKey: ['admin-approved-couriers'],
    queryFn: () => api.get<AdminVerificationRow[]>('admin/verifications/courier', { status: 'APPROVED' }),
  });

  const handleManualAssign = async (deliveryId: string, courierId: string) => {
    if (!courierId) return;
    await api.post(`admin/deliveries/${deliveryId}/assign`, { courierId });
    await queryClient.invalidateQueries({ queryKey: ['admin-deliveries'] });
    pushToast({ tone: 'success', title: 'پیک به‌صورت دستی به مأموریت تخصیص یافت' });
  };

  return (
    <div className="space-y-6 text-xs">
      <div className="cp-card p-5 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900">مأموریت‌های ارسال و تخصیص دستی پیک</h2>
        {!deliveriesQuery.data?.items.length ? (
          <p className="text-slate-500">مأموریت ارسالی ثبت نشده است.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {deliveriesQuery.data.items.map((del) => (
              <div key={del.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 ltr-num">{del.code}</span>
                  <StatusFromMap value={del.status} map={DELIVERY_STATUS_META} size="xs" />
                  <span className="text-slate-500">کرایه کل: {formatToman(del.deliveryFee)}</span>
                </div>
                {['REQUESTED', 'OFFERED', 'FAILED'].includes(del.status) && couriersQuery.data?.[0] && (
                  <button
                    type="button"
                    onClick={() => handleManualAssign(del.id, couriersQuery.data![0].id)}
                    className="cp-btn-secondary text-xs py-1 px-2.5"
                  >
                    تخصیص دستی به {couriersQuery.data[0].displayName}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cp-card p-5 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900">همه سفارش‌های سامانه</h2>
        <div className="divide-y divide-slate-100">
          {ordersQuery.data?.items.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 ltr-num">{o.code}</span>
                <StatusFromMap value={o.status} map={ORDER_STATUS_META} size="xs" />
              </div>
              <span className="font-bold text-slate-800">{formatToman(o.payableTotal)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================= ۴) مدیریت کاتالوگ مرجع قطعات ============================= */
export function AdminCatalogPage() {
  const pushToast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const [nameFa, setNameFa] = useState('');
  const [technicalCode, setTechnicalCode] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => api.get<CategoryNode[]>('catalog/categories'),
  });

  const handleCreatePart = async (e: FormEvent) => {
    e.preventDefault();
    const cat = categoryId || categoriesQuery.data?.[0]?.id;
    if (!cat) return;
    await api.post('admin/catalog/parts', {
      nameFa,
      categoryId: cat,
      technicalCode: technicalCode || undefined,
    });
    setNameFa('');
    setTechnicalCode('');
    await queryClient.invalidateQueries({ queryKey: ['catalog-search'] });
    pushToast({ tone: 'success', title: 'قطعه مرجع جدید در کاتالوگ رسمی ثبت و تأیید شد' });
  };

  return (
    <div className="cp-card p-5 space-y-4 text-xs">
      <h2 className="text-sm font-extrabold text-slate-900">افزودن قطعه مرجع رسمی به کاتالوگ استاندارد</h2>
      <form onSubmit={handleCreatePart} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input
          value={nameFa}
          onChange={(e) => setNameFa(e.target.value)}
          placeholder="نام استاندارد قطعه (فارسی)"
          className="cp-input"
          required
        />
        <input
          value={technicalCode}
          onChange={(e) => setTechnicalCode(e.target.value)}
          placeholder="کد فنی مرجع"
          className="cp-input ltr-num"
        />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="cp-input">
          {categoriesQuery.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameFa}
            </option>
          ))}
        </select>
        <button type="submit" className="cp-btn-primary">
          + ثبت قطعه مرجع
        </button>
      </form>
    </div>
  );
}

/* ============================= ۵) مالی، کوپن، بازپرداخت و تسویه‌ها ============================= */
interface CouponItem {
  id: string;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  usedCount: number;
  isActive: boolean;
}

export function AdminFinancePage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canWritePayout = can(roles, 'payout:manage:all');

  const [couponCode, setCouponCode] = useState('');
  const [couponValue, setCouponValue] = useState(50_000);

  const payoutsQuery = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => api.get<Page<PayoutItemDto>>('admin/finance/payouts'),
  });

  const couponsQuery = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: () => api.get<Page<CouponItem>>('admin/coupons'),
  });

  const handleMarkPaid = async (id: string) => {
    await api.post(`admin/finance/payouts/${id}/paid`, {
      reference: `SHABA-${Date.now()}`,
      note: 'تسویه پایا ثبت‌شده توسط مدیر مالی',
    });
    await queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
    pushToast({ tone: 'success', title: 'وضعیت تسویه به «واریزشده» تغییر یافت' });
  };

  const handleCreateCoupon = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('admin/coupons', {
      code: couponCode.toUpperCase(),
      kind: 'fixed',
      value: couponValue,
      minOrderAmount: 200_000,
    });
    setCouponCode('');
    await queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    pushToast({ tone: 'success', title: 'کوپن تخفیف جدید فعال شد' });
  };

  return (
    <div className="space-y-6 text-xs">
      <div className="cp-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-slate-900">دسته تسویه‌حساب فروشندگان و پیک‌ها</h2>
        </div>

        {!payoutsQuery.data?.items.length ? (
          <p className="text-slate-500">تسویه ثبت‌شده‌ای وجود ندارد.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {payoutsQuery.data.items.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <span className="font-bold text-slate-900">
                    {p.recipientType === 'seller' ? 'فروشنده' : 'پیک'} — خالص: {formatToman(p.netAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusFromMap value={p.status} map={PAYOUT_STATUS_META} size="xs" />
                  {canWritePayout && p.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(p.id)}
                      className="cp-btn-secondary text-xs py-1 px-2.5"
                    >
                      ثبت شماره پیگیری بانکی
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cp-card p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900">مدیریت کوپن‌های تخفیف</h3>
        <div className="divide-y divide-slate-100">
          {couponsQuery.data?.items.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2">
              <span className="font-mono font-bold text-slate-900 ltr-num">{c.code}</span>
              <span>
                {c.kind === 'percent' ? `${toPersianDigits(c.value)}٪` : formatToman(c.value)} • مصرف‌شده:{' '}
                {toPersianDigits(c.usedCount)} بار
              </span>
            </div>
          ))}
        </div>

        {canWritePayout && (
          <form onSubmit={handleCreateCoupon} className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="کد جدید (مثلاً BAHAR70)"
              className="cp-input w-48 ltr-num uppercase"
              required
              minLength={3}
            />
            <input
              type="number"
              min={5000}
              value={couponValue}
              onChange={(e) => setCouponValue(Number(e.target.value))}
              className="cp-input w-40"
              required
            />
            <button type="submit" className="cp-btn-primary">
              + ایجاد کوپن ثابت
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ============================= ۶) پشتیبانی، داوری مرجوعی و پالایش دیدگاه ============================= */
export function AdminSupportPage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);

  const ticketsQuery = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: () => api.get<Page<TicketDto>>('admin/tickets'),
  });

  const returnsQuery = useQuery({
    queryKey: ['admin-returns'],
    queryFn: () => api.get<Page<ReturnRequestDto>>('admin/returns'),
  });

  const resolveReturn = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await api.post(`admin/returns/${id}/resolve`, {
      status,
      note: 'داوری نهایی واحد پشتیبانی ثبت گردید',
    });
    await queryClient.invalidateQueries({ queryKey: ['admin-returns'] });
    pushToast({ tone: 'success', title: 'نتیجه داوری پرونده مرجوعی ثبت شد' });
  };

  return (
    <div className="space-y-6 text-xs">
      <div className="cp-card p-5 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900">صف تیکت‌های پشتیبانی کاربران</h2>
        {!ticketsQuery.data?.items.length ? (
          <EmptyState title="تیکت بازی در صف پشتیبانی وجود ندارد" />
        ) : (
          <div className="divide-y divide-slate-100">
            {ticketsQuery.data.items.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="font-mono text-slate-400 ltr-num">{t.code}</span>
                  <span className="mr-2 font-bold text-slate-900">{t.subject}</span>
                </div>
                <StatusFromMap value={t.status} map={TICKET_STATUS_META} size="xs" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cp-card p-5 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900">داوری پرونده‌های مرجوعی و اختلاف</h2>
        {!returnsQuery.data?.items.length ? (
          <p className="text-slate-500">پرونده مرجوعی ثبت نشده است.</p>
        ) : (
          returnsQuery.data.items.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2.5">
              <div>
                <span className="font-bold text-slate-900">علت: {r.reason}</span>
                <span className="mr-2 text-slate-500">{r.description}</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusFromMap value={r.status} map={RETURN_STATUS_META} size="xs" />
                {r.status !== 'CLOSED' && r.status !== 'REFUNDED' && (
                  <button
                    type="button"
                    onClick={() => resolveReturn(r.id, 'APPROVED')}
                    className="cp-btn-primary text-xs py-1 px-2.5"
                  >
                    تأیید داوری به نفع خریدار
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ============================= ۷) تنظیمات سیستم، اعلانات و لاگ حسابرسی ============================= */
interface SettingRow {
  key: string;
  valueJson: unknown;
  groupName: string;
  description: string | null;
}

export function AdminSettingsAndAuditPage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canWriteSettings = can(roles, 'setting:manage');

  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');

  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get<SettingRow[]>('admin/settings'),
    enabled: can(roles, 'setting:manage'),
  });

  const auditQuery = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () =>
      api.get<Page<{ id: string; action: string; entityType: string; actorRole: string | null; createdAt: string }>>(
        'admin/audit',
        { pageSize: 20 },
      ),
  });

  const handlePublishAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('admin/announcements', {
      title: annTitle,
      body: annBody,
      level: 'info',
      audience: 'all',
    });
    setAnnTitle('');
    setAnnBody('');
    await queryClient.invalidateQueries({ queryKey: ['public-announcements'] });
    pushToast({ tone: 'success', title: 'اطلاعیه سراسری در نوار بالای سایت منتشر شد' });
  };

  return (
    <div className="space-y-6 text-xs">
      {canWriteSettings && (
        <form onSubmit={handlePublishAnnouncement} className="cp-card p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900">انتشار اطلاعیه سراسری روی سایت</h2>
          <input
            value={annTitle}
            onChange={(e) => setAnnTitle(e.target.value)}
            placeholder="عنوان اطلاعیه (مثلاً: افزایش ساعات کاری ناوگان پیک تهران)"
            className="cp-input"
            required
          />
          <textarea
            rows={2}
            value={annBody}
            onChange={(e) => setAnnBody(e.target.value)}
            placeholder="متن اطلاعیه..."
            className="cp-input"
            required
          />
          <button type="submit" className="cp-btn-primary">
            انتشار فوری اطلاعیه
          </button>
        </form>
      )}

      {settingsQuery.data && (
        <div className="cp-card p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900">پارامترهای پیکربندی زنده سامانه (Database Settings)</h2>
          <div className="divide-y divide-slate-100">
            {settingsQuery.data.slice(0, 12).map((s) => (
              <div key={s.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-mono font-bold text-slate-800 ltr-num">{s.key}</span>
                  {s.description && <p className="text-slate-500">{s.description}</p>}
                </div>
                <code className="rounded bg-slate-100 px-2 py-0.5 text-[11px] ltr-num">
                  {JSON.stringify(s.valueJson)}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cp-card p-5 space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
          <ScrollText className="h-4 w-4 text-brand-700" />
          لاگ تغییرناپذیر حسابرسی امنیتی و مدیریتی
        </h2>
        <div className="divide-y divide-slate-100">
          {auditQuery.data?.items.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between py-2">
              <div>
                <span className="font-mono font-bold text-slate-900 ltr-num">{a.action}</span>
                <span className="mr-2 text-slate-500">
                  موجودیت: {a.entityType} {a.actorRole ? `• نقش: ${a.actorRole}` : ''}
                </span>
              </div>
              <span className="text-slate-400">{formatJalali(a.createdAt, { withTime: true })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
