import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeliveryMission } from '@carpart/api-client';
import { api } from '../../lib/api';
import { useCountdown } from '../../lib/hooks';
import { getCurrentPosition } from '../../lib/native';
import { formatToman, toFaDigits } from '../../lib/format';
import { AppShell, type TabDef } from '../../components/AppShell';
import { EmptyState, ErrorBox, Section, Spinner } from '../../components/ui';

export const COURIER_TABS: TabDef[] = [
  { to: '/courier', label: 'مأموریت‌ها', icon: '🛵' },
  { to: '/courier/earnings', label: 'درآمد', icon: '💰' },
  { to: '/courier/profile', label: 'پروفایل', icon: '👤' },
];

function OfferCard({ mission, onChanged }: { mission: DeliveryMission; onChanged: () => void }): JSX.Element {
  const navigate = useNavigate();
  const seconds = useCountdown(mission.offerExpiresAt);
  const [error, setError] = useState<string | null>(null);

  const accept = useMutation({
    mutationFn: () => api.delivery.accept(mission.id),
    onSuccess: () => navigate(`/courier/missions/${mission.id}`),
    onError: () => setError('پذیرش مأموریت ناموفق بود؛ ممکن است مهلت گذشته باشد.'),
  });

  const reject = useMutation({
    mutationFn: () => api.delivery.reject(mission.id, 'خارج از مسیر'),
    onSuccess: onChanged,
    onError: () => setError('رد مأموریت ناموفق بود'),
  });

  return (
    <article className="cp-card space-y-2">
      <div className="flex items-center justify-between">
        <b className="text-sm" dir="ltr">
          {mission.code}
        </b>
        <span className={`cp-chip ${seconds > 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
          ⏱ {seconds > 0 ? `${toFaDigits(Math.floor(seconds / 60))}:${toFaDigits(String(seconds % 60).padStart(2, '0'))}` : 'مهلت گذشته'}
        </span>
      </div>
      <p className="text-xs leading-6">
        🏪 {String(mission.pickupPoint?.title ?? 'فروشگاه')} — {String(mission.pickupPoint?.city ?? '')}
        <br />📍 {String(mission.dropoffPoint?.addressText ?? mission.dropoffPoint?.city ?? 'مقصد')}
      </p>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{mission.distanceKm ? `${toFaDigits(mission.distanceKm.toFixed(1))} کیلومتر` : 'مسافت تخمینی'}</span>
        <b className="text-base text-primary">{formatToman(mission.courierShare)} (کرایه شما)</b>
      </div>
      {mission.isUrgent ? <span className="cp-chip bg-red-100 text-red-800">فوری</span> : null}
      {error ? <ErrorBox message={error} /> : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="cp-btn-primary" disabled={accept.isPending || seconds <= 0} onClick={() => accept.mutate()}>
          پذیرش مأموریت
        </button>
        <button type="button" className="cp-btn-ghost" disabled={reject.isPending} onClick={() => reject.mutate()}>
          رد می‌کنم
        </button>
      </div>
    </article>
  );
}

export default function CourierHome(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const profile = useQuery({ queryKey: ['courier-me'], queryFn: () => api.couriers.me() });
  const offers = useQuery({
    queryKey: ['missions', 'offers'],
    queryFn: () => api.delivery.list({ status: 'offers', pageSize: 10 }),
    refetchInterval: 15_000,
  });
  const active = useQuery({ queryKey: ['missions', 'active'], queryFn: () => api.delivery.list({ status: 'active', pageSize: 10 }) });

  const toggleOnline = useMutation({
    mutationFn: (isOnline: boolean) => api.couriers.setAvailability(isOnline),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courier-me'] });
      setError(null);
    },
    onError: () => setError('تغییر وضعیت آنلاین ناموفق بود'),
  });

  const sendLocation = useMutation({
    mutationFn: async () => {
      const position = await getCurrentPosition();
      return api.couriers.sendLocation(position.lat, position.lng);
    },
    onSuccess: () => setError(null),
    onError: (err) => setError(err instanceof Error ? err.message : 'ارسال موقعیت ناموفق بود'),
  });

  const isOnline = Boolean(profile.data?.isOnline);

  return (
    <AppShell
      title="مأموریت‌های ارسال"
      tabs={COURIER_TABS}
      headerExtra={
        <button
          type="button"
          className={isOnline ? 'cp-btn-ghost !bg-white !text-emerald-700' : 'cp-btn-ghost !bg-white/15 !text-white'}
          disabled={toggleOnline.isPending}
          onClick={() => toggleOnline.mutate(!isOnline)}
        >
          {isOnline ? '🟢 آنلاین — غیرفعال کردن' : '⚪ آفلاین — آنلاین شوم'}
        </button>
      }
    >
      {error ? <ErrorBox message={error} /> : null}

      {!isOnline ? (
        <div className="cp-card border-amber-200 bg-amber-50 text-xs leading-6 text-amber-900">
          برای دریافت مأموریت، وضعیت خود را «آنلاین» کنید. مأموریت‌ها بر اساس نزدیکی و محدوده، به شما پیشنهاد می‌شوند.
        </div>
      ) : null}

      <button type="button" className="cp-btn-ghost w-full" disabled={sendLocation.isPending} onClick={() => sendLocation.mutate()}>
        📍 ارسال موقعیت فعلی من
      </button>

      <Section title={`پیشنهادهای جدید (${offers.data?.meta.total ?? 0})`}>
        {offers.isLoading ? <Spinner /> : null}
        {offers.data && offers.data.items.length === 0 ? <EmptyState title="فعلاً پیشنهاد جدیدی نیست" hint="وقتی مأموریت جدیدی در محدوده شما ثبت شود، اینجا نمایش داده می‌شود." /> : null}
        <div className="space-y-3">
          {(offers.data?.items ?? []).map((mission) => (
            <OfferCard key={mission.id} mission={mission} onChanged={() => void queryClient.invalidateQueries({ queryKey: ['missions'] })} />
          ))}
        </div>
      </Section>

      <Section title="مأموریت‌های فعال">
        <div className="space-y-2">
          {(active.data?.items ?? []).map((mission) => (
            <button key={mission.id} type="button" className="cp-card w-full text-start" onClick={() => navigate(`/courier/missions/${mission.id}`)}>
              <div className="flex items-center justify-between">
                <b className="text-sm" dir="ltr">
                  {mission.code}
                </b>
                <span className="cp-chip bg-sky-100 text-sky-800">در جریان</span>
              </div>
              <p className="mt-1 text-xs text-muted">{String(mission.dropoffPoint?.addressText ?? '')}</p>
            </button>
          ))}
          {active.data && active.data.items.length === 0 ? <p className="text-xs text-muted">مأموریت فعالی ندارید.</p> : null}
        </div>
      </Section>
    </AppShell>
  );
}
