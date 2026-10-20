import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, clearAuthSession } from '../../lib/api';
import { useSessionStore } from '../../lib/session';
import { AppShell } from '../../components/AppShell';
import { ErrorBox, Field, Section, Spinner } from '../../components/ui';
import { COURIER_TABS } from './CourierHome';

/** پروفایل پیک: اطلاعات حساب، وسیله نقلیه، خروج */
export default function CourierProfilePage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const profile = useQuery({ queryKey: ['courier-me'], queryFn: () => api.couriers.me() });
  const [vehicleType, setVehicleType] = useState('');
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: () => api.couriers.update({ vehicleType }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courier-me'] });
      setError(null);
    },
    onError: () => setError('بروزرسانی پروفایل ناموفق بود'),
  });

  return (
    <AppShell title="پروفایل پیک" tabs={COURIER_TABS}>
      <div className="cp-card flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-xl">🛵</div>
        <div>
          <b className="text-sm">{user?.fullName}</b>
          <p className="text-xs text-muted" dir="ltr">
            {user?.mobile}
          </p>
          <p className="text-[11px] text-muted">
            {profile.data?.verificationStatus === 'APPROVED' ? 'حساب تأییدشده' : 'در انتظار تأیید مدیریت'} · امتیاز:{' '}
            {profile.data?.ratingAvg ? String(profile.data.ratingAvg) : '—'}
          </p>
        </div>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      <Section title="وسیله نقلیه">
        {profile.isLoading ? <Spinner /> : null}
        <div className="cp-card space-y-2">
          <Field label="نوع وسیله نقلیه">
            <select className="cp-field" value={vehicleType || String(profile.data?.vehicleType ?? '')} onChange={(e) => setVehicleType(e.target.value)}>
              <option value="">انتخاب کنید</option>
              <option value="motorcycle">موتورسیکلت</option>
              <option value="car">سواری</option>
              <option value="van">وانت</option>
            </select>
          </Field>
          <button type="button" className="cp-btn-primary w-full" disabled={update.isPending || !vehicleType} onClick={() => update.mutate()}>
            ذخیره
          </button>
        </div>
      </Section>

      <button
        type="button"
        className="cp-btn-ghost w-full text-red-700"
        onClick={async () => {
          await api.auth.logout().catch(() => undefined);
          clearAuthSession();
          navigate('/login', { replace: true });
        }}
      >
        خروج از حساب
      </button>
    </AppShell>
  );
}
