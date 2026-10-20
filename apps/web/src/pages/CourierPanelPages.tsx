import {
  DELIVERY_STATUS_META,
  PAYOUT_STATUS_META,
  VEHICLE_TYPE_META,
  VERIFICATION_STATUS_META,
  formatToman,
  toLatinDigits,
  toPersianDigits,
  type Page,
} from '@carpart/contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, CheckCircle2, LayoutDashboard, MapPin, Navigation, Power, Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PanelShell } from '../components/layout/AppLayout';
import { EmptyState, ErrorAlert, LoadingState, StatCard, StatusBadge, StatusFromMap } from '../components/ui/Primitives';
import { api } from '../lib/api-client';
import type { DeliveryMissionDto, PayoutItemDto } from '../lib/types';
import { useToastStore } from '../store/toast-store';

export function CourierPanelLayout() {
  return (
    <PanelShell
      roleBadge="پنل پیک / راننده"
      title="عملیات ارسال شهری"
      subtitle="پذیرش مأموریت، دریافت با کد فروشگاه و تحویل OTP"
      items={[
        { to: '/courier', label: 'میز کار و وضعیت آنلاین', icon: <LayoutDashboard className="h-4 w-4" />, exact: true },
        { to: '/courier/missions', label: 'مأموریت‌های ارسال', icon: <Bike className="h-4 w-4" /> },
        { to: '/courier/profile', label: 'تسویه و مشخصات خودرو', icon: <Wallet className="h-4 w-4" /> },
      ]}
    />
  );
}

/* ============================= ۱) داشبورد پیک ============================= */
interface CourierDashboardDto {
  profile: { id: string; verificationStatus: string; availability: 'online' | 'offline'; ratingAvg: number; completedDeliveries: number };
  activeMission: { id: string; code: string; status: string } | null;
  availableOffers: number;
  today: { delivered: number; earnings: number };
  pendingPayout: number;
}

export function CourierDashboardPage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const [busy, setBusy] = useState(false);

  const dashQuery = useQuery({
    queryKey: ['courier-dashboard'],
    queryFn: () => api.get<CourierDashboardDto>('couriers/me/dashboard'),
    refetchInterval: 8_000,
  });

  const toggleAvailability = async () => {
    if (!dashQuery.data) return;
    const next = dashQuery.data.profile.availability === 'online' ? 'offline' : 'online';
    setBusy(true);
    try {
      await api.post('couriers/me/availability', { availability: next });
      await queryClient.invalidateQueries({ queryKey: ['courier-dashboard'] });
      pushToast({
        tone: next === 'online' ? 'success' : 'info',
        title: next === 'online' ? 'وضعیت شما «آنلاین و آماده مأموریت» شد' : 'وضعیت شما «آفلاین» شد',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSendSampleLocation = async () => {
    await api.post('couriers/me/location', {
      lat: 35.732,
      lng: 51.398,
      deliveryId: dashQuery.data?.activeMission?.id,
    });
    pushToast({
      tone: 'success',
      title: 'موقعیت مکانی به‌روزرسانی شد',
      detail: 'طبق سیاست حریم خصوصی، سابقه مسیر فقط در حین مأموریت فعال نگهداری می‌شود.',
    });
  };

  if (dashQuery.isLoading) return <LoadingState />;
  if (dashQuery.error || !dashQuery.data) {
    return <ErrorAlert error={dashQuery.error} onRetry={() => dashQuery.refetch()} />;
  }

  const d = dashQuery.data;
  const isOnline = d.profile.availability === 'online';

  return (
    <div className="space-y-6">
      <div className="cp-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <StatusBadge
              tone={isOnline ? 'success' : 'neutral'}
              label={isOnline ? 'آنلاین — آماده دریافت پیشنهاد' : 'آفلاین'}
            />
            <StatusFromMap value={d.profile.verificationStatus} map={VERIFICATION_STATUS_META} size="xs" />
          </div>
          <p className="text-xs text-slate-500">
            امتیاز عملکرد: {toPersianDigits(d.profile.ratingAvg.toFixed(1))} از ۵ • تحویل‌های موفق کل:{' '}
            {toPersianDigits(d.profile.completedDeliveries)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={handleSendSampleLocation} className="cp-btn-secondary text-xs">
            <Navigation className="h-3.5 w-3.5 text-brand-700" />
            ثبت موقعیت فعلی
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={toggleAvailability}
            className={isOnline ? 'cp-btn-danger text-xs' : 'cp-btn-primary text-xs'}
          >
            <Power className="h-4 w-4" />
            {isOnline ? 'تغییر به آفلاین' : 'تغییر به آنلاین'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="پیشنهادهای منتظر پذیرش"
          value={d.availableOffers}
          sub="دارای مهلت محدود پاسخ‌گویی"
          tone="amber"
        />
        <StatCard
          label="درآمد خالص امروز"
          value={formatToman(d.today.earnings)}
          sub={`${toPersianDigits(d.today.delivered)} مأموریت تحویل‌شده امروز`}
          tone="emerald"
        />
        <StatCard label="مانده در انتظار تسویه" value={formatToman(d.pendingPayout)} tone="brand" />
      </div>

      {d.activeMission && (
        <div className="cp-card border-brand-300 bg-brand-50/40 p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-brand-800">مأموریت فعال در دست اقدام:</span>
            <p className="font-mono text-lg font-extrabold text-slate-900 ltr-num">{d.activeMission.code}</p>
          </div>
          <Link to="/courier/missions" className="cp-btn-primary text-xs">
            ادامه مراحل تحویل
          </Link>
        </div>
      )}
    </div>
  );
}

/* ============================= ۲) مأموریت‌های ارسال پیک ============================= */
export function CourierMissionsPage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);

  const [tab, setTab] = useState<'offers' | 'active' | 'history'>('offers');
  const [pickupCodeInput, setPickupCodeInput] = useState<Record<string, string>>({});
  const [otpInput, setOtpInput] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);

  const missionsQuery = useQuery({
    queryKey: ['courier-missions', tab],
    queryFn: () => api.get<Page<DeliveryMissionDto>>('courier/deliveries', { status: tab, pageSize: 25 }),
    refetchInterval: 6_000,
  });

  const reload = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['courier-missions'] }),
      queryClient.invalidateQueries({ queryKey: ['courier-dashboard'] }),
    ]);
  };

  const handleAccept = async (id: string) => {
    setError(null);
    try {
      await api.post(`courier/deliveries/${id}/accept`);
      setTab('active');
      await reload();
      pushToast({ tone: 'success', title: 'مأموریت پذیرفته شد؛ به سمت فروشگاه حرکت کنید' });
    } catch (err) {
      setError(err);
    }
  };

  const handleReject = async (id: string) => {
    setError(null);
    try {
      await api.post(`courier/deliveries/${id}/reject`, { reason: 'عدم امکان حضور در محدوده' });
      await reload();
      pushToast({ tone: 'info', title: 'پیشنهاد رد شد و به صف تخصیص پیک بعدی بازگشت' });
    } catch (err) {
      setError(err);
    }
  };

  const handlePickup = async (id: string) => {
    setError(null);
    try {
      await api.post(`courier/deliveries/${id}/pickup`, {
        pickupCode: toLatinDigits(pickupCodeInput[id] ?? '').trim(),
      });
      await reload();
      pushToast({ tone: 'success', title: 'دریافت بسته از فروشنده با موفقیت ثبت شد' });
    } catch (err) {
      setError(err);
    }
  };

  const handleTransit = async (id: string) => {
    setError(null);
    try {
      await api.post(`courier/deliveries/${id}/transit`);
      await reload();
      pushToast({ tone: 'info', title: 'حرکت به سمت تعمیرگاه مقصد ثبت شد' });
    } catch (err) {
      setError(err);
    }
  };

  const handleDeliver = async (id: string) => {
    setError(null);
    try {
      await api.post(`courier/deliveries/${id}/deliver`, {
        otp: toLatinDigits(otpInput[id] ?? '').trim(),
        note: 'تحویل حضوری با کد تأیید',
      });
      setTab('history');
      await reload();
      pushToast({ tone: 'success', title: 'تحویل نهایی با کد یکبارمصرف ثبت شد!' });
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="cp-card flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="flex gap-2">
          {(
            [
              { key: 'offers', label: 'پیشنهادهای جدید' },
              { key: 'active', label: 'مأموریت‌های فعال' },
              { key: 'history', label: 'تاریخچه تحویل' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={tab === t.key ? 'cp-btn-primary text-xs' : 'cp-btn-secondary text-xs'}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ErrorAlert error={error} />

      {missionsQuery.isLoading ? (
        <LoadingState />
      ) : !missionsQuery.data?.items.length ? (
        <EmptyState title="مأموریتی در این زبانه وجود ندارد" />
      ) : (
        <div className="space-y-3">
          {missionsQuery.data.items.map((m) => (
            <div key={m.id} className="cp-card p-5 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-extrabold text-slate-900 ltr-num">{m.code}</span>
                  <StatusFromMap value={m.status} map={DELIVERY_STATUS_META} size="xs" />
                </div>
                <span className="text-sm font-extrabold text-emerald-700">
                  سهم خالص پیک: {formatToman(m.courierShare)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3 space-y-1">
                  <span className="font-bold text-slate-700">مبدأ بارگیری (فروشگاه):</span>
                  <p className="text-slate-900">{m.pickupPoint.title}</p>
                  <p className="text-slate-500">{m.pickupPoint.addressText}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 space-y-1">
                  <span className="font-bold text-slate-700">مقصد تحویل (تعمیرگاه):</span>
                  <p className="text-slate-900">
                    {m.dropoffPoint.receiverName} ({m.dropoffPoint.phone})
                  </p>
                  <p className="text-slate-500">{m.dropoffPoint.addressText}</p>
                </div>
              </div>

              {m.distanceKm !== null && (
                <p className="flex items-center gap-1 text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  مسافت تخمینی: {toPersianDigits(m.distanceKm)} کیلومتر
                  {m.estimatedMinutes !== null ? ` • زمان تقریبی: ~${toPersianDigits(m.estimatedMinutes)} دقیقه` : ''}
                </p>
              )}

              {/* دکمه‌های گام‌به‌گام ماشین وضعیت ارسال */}
              {m.status === 'OFFERED' && (
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => handleAccept(m.id)} className="cp-btn-primary">
                    پذیرش مأموریت ارسال
                  </button>
                  <button type="button" onClick={() => handleReject(m.id)} className="cp-btn-danger">
                    رد پیشنهاد
                  </button>
                </div>
              )}

              {m.status === 'ACCEPTED' && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <input
                    value={pickupCodeInput[m.id] ?? ''}
                    onChange={(e) => setPickupCodeInput({ ...pickupCodeInput, [m.id]: e.target.value })}
                    placeholder="کد تحویل ۵ رقمی فروشنده (Pickup Code)"
                    className="cp-input w-64 ltr-num"
                  />
                  <button type="button" onClick={() => handlePickup(m.id)} className="cp-btn-primary">
                    ثبت دریافت بسته از فروشگاه
                  </button>
                </div>
              )}

              {m.status === 'PICKED_UP' && (
                <div className="border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => handleTransit(m.id)} className="cp-btn-primary">
                    شروع حرکت به سمت مقصد
                  </button>
                </div>
              )}

              {m.status === 'IN_TRANSIT' && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <input
                    value={otpInput[m.id] ?? ''}
                    onChange={(e) => setOtpInput({ ...otpInput, [m.id]: e.target.value })}
                    placeholder="کد تأیید تحویل گیرنده (OTP)"
                    className="cp-input w-64 ltr-num"
                  />
                  <button type="button" onClick={() => handleDeliver(m.id)} className="cp-btn-accent">
                    <CheckCircle2 className="h-4 w-4" />
                    ثبت تحویل نهایی مرسوله
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================= ۳) پروفایل وسیله نقلیه و تسویه پیک ============================= */
export function CourierProfilePage() {
  const pushToast = useToastStore((s) => s.push);
  const [bankName, setBankName] = useState('ملت');
  const [ownerName, setOwnerName] = useState('');
  const [iban, setIban] = useState('IR062960000000100324200001');

  const meQuery = useQuery({
    queryKey: ['courier-me'],
    queryFn: () =>
      api.get<{
        vehicleType: string;
        vehicleModel: string | null;
        vehiclePlate: string | null;
        serviceCity: string | null;
        capacityKg: number | null;
      }>('couriers/me'),
  });

  const payoutsQuery = useQuery({
    queryKey: ['courier-payouts'],
    queryFn: () => api.get<Page<PayoutItemDto>>('courier/finance/payouts'),
  });

  const handleSaveBank = async (e: FormEvent) => {
    e.preventDefault();
    await api.put('couriers/me/payout-info', { bankName, ownerName, iban });
    pushToast({ tone: 'success', title: 'اطلاعات شبا پیک رمزنگاری و ذخیره شد' });
  };

  return (
    <div className="space-y-6 text-xs">
      {meQuery.data && (
        <div className="cp-card p-5 space-y-2">
          <h2 className="text-sm font-extrabold text-slate-900">مشخصات ناوگان ثبت‌شده شما</h2>
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <StatusFromMap value={meQuery.data.vehicleType} map={VEHICLE_TYPE_META} size="xs" />
            {meQuery.data.vehicleModel && <span>مدل: {meQuery.data.vehicleModel}</span>}
            {meQuery.data.vehiclePlate && <span>پلاک: {meQuery.data.vehiclePlate}</span>}
            {meQuery.data.serviceCity && <span>شهر خدمت: {meQuery.data.serviceCity}</span>}
          </div>
        </div>
      )}

      <form onSubmit={handleSaveBank} className="cp-card p-5 space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900">حساب شبا جهت واریز کرایه مأموریت‌ها</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="نام بانک" className="cp-input" required />
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="نام صاحب حساب"
            className="cp-input"
            required
          />
          <input value={iban} onChange={(e) => setIban(e.target.value)} className="cp-input ltr-num" required />
        </div>
        <button type="submit" className="cp-btn-primary">
          ذخیره شبا
        </button>
      </form>

      <div className="cp-card p-5 space-y-2">
        <h3 className="text-sm font-extrabold text-slate-900">تسویه‌های انجام‌شده</h3>
        {!payoutsQuery.data?.items.length ? (
          <p className="text-slate-500">هنوز تسویه ثبت‌شده‌ای وجود ندارد.</p>
        ) : (
          payoutsQuery.data.items.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-slate-100 py-2">
              <span>{formatToman(p.netAmount)}</span>
              <StatusFromMap value={p.status} map={PAYOUT_STATUS_META} size="xs" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
