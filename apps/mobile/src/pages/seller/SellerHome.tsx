import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@carpart/api-client';
import { api, clearAuthSession } from '../../lib/api';
import { useSessionStore } from '../../lib/session';
import { compactMoney, toFaDigits } from '../../lib/format';
import { ErrorBox, Section, Spinner, StatCard } from '../../components/ui';
import { RoleHero } from '../../components/RoleHero';
import { SellerShell } from './SellerShell';

/** داشبورد فروشنده — داده واقعی از پایگاه‌داده */
export default function SellerHome(): JSX.Element {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const dashboard = useQuery({ queryKey: ['seller-dashboard'], queryFn: () => api.sellers.dashboard() });
  const profile = useQuery({ queryKey: ['seller-me'], queryFn: () => api.sellers.me() });
  const stats = (dashboard.data ?? {}) as Record<string, number>;

  return (
    <SellerShell title={`فروشگاه ${user?.fullName ?? ''}`}>
      <RoleHero
        variant="seller"
        eyebrow="مرکز فروش حرفه‌ای"
        title="فروش را هوشمند مدیریت کنید"
        description="موجودی، سفارش‌ها، استعلام‌ها و تسویه‌ها؛ همه در یک نمای سریع و شفاف."
        metric={dashboard.isLoading ? 'در حال همگام‌سازی…' : `${toFaDigits(Number(stats.ordersToday ?? 0))} سفارش امروز`}
        action={<button type="button" className="cp-btn bg-white text-amber-950 shadow-lg" onClick={() => navigate('/seller/products')}>مدیریت محصولات ←</button>}
      />
      {dashboard.isLoading ? <Spinner /> : null}
      <section className="grid grid-cols-2 gap-2">
        <StatCard label="سفارش امروز" value={toFaDigits(Number(stats.ordersToday ?? 0))} />
        <StatCard label="در جریان" value={toFaDigits(Number(stats.ordersInProgress ?? stats.activeOrders ?? 0))} tone="primary" />
        <StatCard label="درآمد" value={compactMoney(Number(stats.revenue ?? stats.totalRevenue ?? 0))} tone="money" />
        <StatCard label="موجودی کم" value={toFaDigits(Number(stats.lowStockCount ?? 0))} />
      </section>

      <Section title="دسترسی سریع">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="cp-btn-primary" onClick={() => navigate('/seller/products')}>
            + افزودن محصول
          </button>
          <button type="button" className="cp-btn-ghost" onClick={() => navigate('/seller/requests')}>
            درخواست‌های قیمت
          </button>
          <button type="button" className="cp-btn-ghost" onClick={() => navigate('/seller/profile')}>
            🏪 فروشگاه و شعبه‌ها
          </button>
          <button
            type="button"
            className="cp-btn-ghost text-red-700"
            onClick={async () => {
              await api.auth.logout().catch(() => undefined);
              clearAuthSession();
              navigate('/login', { replace: true });
            }}
          >
            خروج از حساب
          </button>
        </div>
      </Section>

      <Section title="وضعیت حساب">
        <div className="cp-card space-y-1 text-xs leading-6">
          <p>
            وضعیت تأیید:{' '}
            <b>{String(profile.data?.verificationStatus === 'APPROVED' ? 'تأییدشده' : profile.data?.verificationStatus === 'DRAFT' ? 'پیش‌نویس' : 'در انتظار بررسی')}</b>
          </p>
          <p>
            امتیاز فروشگاه: <b>{toFaDigits(Number(profile.data?.ratingAvg ?? 0))}</b> از {toFaDigits(Number(profile.data?.ratingCount ?? 0))} نظر
          </p>
          <p className="text-muted">
            برای ویرایش اطلاعات به <Link className="underline" to="/seller/profile">صفحه فروشگاه</Link> بروید.
          </p>
        </div>
      </Section>
    </SellerShell>
  );
}

/** پروفایل فروشگاه: اطلاعات + شعبه + ارسال برای تأیید */
export function SellerProfile(): JSX.Element {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState<{ storeName: string; nationalId: string; city: string; phone: string } | null>(null);
  const [branch, setBranch] = useState({ name: '', city: '', addressText: '' });

  const { isLoading: profileLoading } = useQuery({
    queryKey: ['seller-me'],
    queryFn: async () => {
      const me = await api.sellers.me();
      setForm({ storeName: me.storeName ?? '', nationalId: me.nationalId ?? '', city: me.city ?? '', phone: me.phone ?? '' });
      return me;
    },
  });
  const branches = useQuery({ queryKey: ['seller-branches'], queryFn: () => api.sellers.branches() });

  const save = useMutation({
    mutationFn: () => api.sellers.update(form!),
    onSuccess: () => {
      setOk('ذخیره شد');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['seller-me'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ذخیره ناموفق بود'),
  });

  const addBranch = useMutation({
    mutationFn: () => api.sellers.addBranch({ name: branch.name, city: branch.city, addressText: branch.addressText }),
    onSuccess: () => {
      setBranch({ name: '', city: '', addressText: '' });
      void qc.invalidateQueries({ queryKey: ['seller-branches'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت شعبه ناموفق بود'),
  });

  const submitReview = useMutation({
    mutationFn: () => api.sellers.submitReview(),
    onSuccess: () => {
      setOk('برای بررسی مدیر ارسال شد');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['seller-me'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ارسال ناموفق (اطلاعات/شعبه ناقص است)'),
  });

  return (
    <SellerShell title="فروشگاه و شعبه‌ها">
      {error ? <ErrorBox message={error} /> : null}
      {ok ? <div className="cp-card border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{ok}</div> : null}
      {!form || profileLoading ? (
        <Spinner />
      ) : (
        <div className="cp-card space-y-2">
          <label className="block">
            <span className="cp-label">نام فروشگاه</span>
            <input className="cp-field" value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="cp-label">شناسه ملی</span>
              <input className="cp-field" dir="ltr" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
            </label>
            <label className="block">
              <span className="cp-label">شهر</span>
              <input className="cp-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="cp-label">تلفن</span>
            <input className="cp-field" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="cp-btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
              ذخیره
            </button>
            <button type="button" className="cp-btn-ghost" disabled={submitReview.isPending} onClick={() => submitReview.mutate()}>
              ارسال برای تأیید
            </button>
          </div>
        </div>
      )}

      <Section title="شعبه‌ها">
        {(branches.data ?? []).map((item) => (
          <div key={item.id} className="cp-card">
            <b className="text-sm">{item.name}</b>
            <p className="text-xs text-muted">
              {item.city ?? ''} — {item.addressText ?? ''}
            </p>
          </div>
        ))}
        <div className="cp-card space-y-2">
          <label className="block">
            <span className="cp-label">نام شعبه</span>
            <input className="cp-field" value={branch.name} onChange={(e) => setBranch({ ...branch, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="cp-label">شهر</span>
            <input className="cp-field" value={branch.city} onChange={(e) => setBranch({ ...branch, city: e.target.value })} />
          </label>
          <label className="block">
            <span className="cp-label">نشانی</span>
            <input className="cp-field" value={branch.addressText} onChange={(e) => setBranch({ ...branch, addressText: e.target.value })} />
          </label>
          <button type="button" className="cp-btn-primary w-full" disabled={addBranch.isPending || !branch.name || !branch.city} onClick={() => addBranch.mutate()}>
            افزودن شعبه
          </button>
        </div>
      </Section>
    </SellerShell>
  );
}
