import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, clearAuthSession } from '../../lib/api';
import { useSessionStore } from '../../lib/session';
import { AppShell } from '../../components/AppShell';
import { ErrorBox, Field, Section, Spinner } from '../../components/ui';
import { MECHANIC_TABS } from './MechanicHome';

/** پروفایل مکانیک: خودروها، نشانی‌ها، خروج */
export default function ProfilePage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);

  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: () => api.workshops.vehicles() });
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api.workshops.addresses() });

  const [plate, setPlate] = useState('');
  const [nickname, setNickname] = useState('');
  const [city, setCity] = useState('');
  const [addressText, setAddressText] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addVehicle = useMutation({
    mutationFn: () => api.workshops.addVehicle({ nickname: nickname || plate, plateDigits: plate || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setPlate('');
      setNickname('');
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'ثبت خودرو ناموفق بود'),
  });

  const addAddress = useMutation({
    mutationFn: () =>
      api.workshops.addAddress({
        city,
        addressText,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setCity('');
      setAddressText('');
      setLat('');
      setLng('');
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'ثبت نشانی ناموفق بود'),
  });

  return (
    <AppShell title="پروفایل من" tabs={MECHANIC_TABS}>
      <div className="cp-card flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-xl">👤</div>
        <div>
          <b className="text-sm">{user?.fullName}</b>
          <p className="text-xs text-muted" dir="ltr">
            {user?.mobile}
          </p>
          <p className="text-[11px] text-muted">{user?.verificationStatus === 'APPROVED' ? 'حساب تأییدشده' : 'در انتظار تأیید'}</p>
        </div>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      <Section title="خودروهای من">
        {vehicles.isLoading ? <Spinner /> : null}
        <div className="space-y-2">
          {(vehicles.data ?? []).map((vehicle) => (
            <div key={vehicle.id} className="cp-card flex items-center justify-between">
              <div>
                <b className="text-sm">
                  {String((vehicle.model as { nameFa?: string } | undefined)?.nameFa ?? 'خودرو')} {String(vehicle.nickname ?? '')}
                </b>
                {vehicle.plateDigits ? <p className="text-xs text-muted">پلاک: {String(vehicle.plateDigits)}</p> : null}
              </div>
            </div>
          ))}
          <div className="cp-card space-y-2">
            <Field label="نام خودرو (مثلاً پراید ۱۳۱)">
              <input className="cp-field" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </Field>
            <Field label="آخرین ارقام پلاک (اختیاری)">
              <input className="cp-field" dir="ltr" value={plate} onChange={(e) => setPlate(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            </Field>
            <button type="button" className="cp-btn-primary w-full" disabled={addVehicle.isPending || !nickname} onClick={() => addVehicle.mutate()}>
              افزودن خودرو
            </button>
          </div>
        </div>
      </Section>

      <Section title="نشانی‌های من">
        {addresses.isLoading ? <Spinner /> : null}
        <div className="space-y-2">
          {(addresses.data ?? []).map((address) => (
            <div key={address.id} className="cp-card">
              <b className="text-sm">{address.city}</b>
              <p className="mt-1 text-xs leading-6 text-muted">{address.addressText}</p>
            </div>
          ))}
          <div className="cp-card space-y-2">
            <Field label="شهر">
              <input className="cp-field" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="نشانی کامل">
              <textarea className="cp-field min-h-20" value={addressText} onChange={(e) => setAddressText(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="عرض جغرافیایی">
                <input className="cp-field" dir="ltr" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="35.7" />
              </Field>
              <Field label="طول جغرافیایی">
                <input className="cp-field" dir="ltr" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="51.4" />
              </Field>
            </div>
            <button
              type="button"
              className="cp-btn-primary w-full"
              disabled={addAddress.isPending || !city || !addressText}
              onClick={() => addAddress.mutate()}
            >
              افزودن نشانی
            </button>
          </div>
        </div>
      </Section>

      <button type="button" className="cp-btn-ghost w-full" onClick={() => navigate('/mechanic/support')}>
        🎧 پشتیبانی و تیکت‌های من
      </button>

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
