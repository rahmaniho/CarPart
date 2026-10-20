import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@carpart/api-client';
import { api } from '../../lib/api';
import { openInMaps } from '../../lib/native';
import { dateFa, formatToman, toFaDigits } from '../../lib/format';
import { AppShell } from '../../components/AppShell';
import { ErrorBox, Field, Section, Spinner, StatusChip } from '../../components/ui';
import { COURIER_TABS } from './CourierHome';

/** جزئیات مأموریت پیک: پذیرش → تحویل از فروشگاه → ارسال → تحویل با OTP */
export default function MissionDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pickupCode, setPickupCode] = useState('');
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [failReason, setFailReason] = useState('');

  const detail = useQuery({ queryKey: ['mission', id], queryFn: () => api.delivery.detail(id!), enabled: Boolean(id) });

  function run(action: () => Promise<unknown>, message: string): void {
    setError(null);
    setSuccess(null);
    action()
      .then(() => {
        setSuccess(message);
        void queryClient.invalidateQueries({ queryKey: ['mission', id] });
        void queryClient.invalidateQueries({ queryKey: ['missions'] });
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.userMessage : 'عملیات ناموفق بود'));
  }

  const mission = detail.data;

  return (
    <AppShell title={`مأموریت ${mission?.code ?? ''}`} tabs={COURIER_TABS}>
      {detail.isLoading ? <Spinner /> : null}
      {detail.isError ? <ErrorBox message="دریافت مأموریت ممکن نشد" onRetry={() => detail.refetch()} /> : null}
      {error ? <ErrorBox message={error} /> : null}
      {success ? <div className="cp-card border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{success}</div> : null}

      {mission ? (
        <>
          <div className="cp-card space-y-2">
            <div className="flex items-center justify-between">
              <StatusChip status={mission.status} kind="delivery" />
              <b className="text-primary">{formatToman(mission.courierShare)}</b>
            </div>
            <div className="space-y-2 text-sm">
              <div className="rounded-xl bg-slate-50 p-2">
                <b className="text-xs text-muted">مبدأ (تحویل از فروشگاه)</b>
                <p>{String(mission.pickupPoint?.title ?? 'فروشگاه')}</p>
                <p className="text-xs text-muted">{String(mission.pickupPoint?.addressText ?? '')}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <b className="text-xs text-muted">مقصد (تحویل به مشتری)</b>
                <p>{String(mission.dropoffPoint?.addressText ?? '')}</p>
                {/* اطلاعات تماس مشتری عمداً محدود است؛ فقط اپراتور/مالک به شماره کامل دسترسی دارد */}
                <p className="text-xs text-muted">گیرنده: {String(mission.dropoffPoint?.receiverName ?? 'مشتری')} (شماره تماس مخفی است)</p>
              </div>
              <button type="button" className="cp-btn-ghost w-full" disabled={mission.dropoffPoint?.lat == null || mission.dropoffPoint?.lng == null} onClick={() => openInMaps(Number(mission.dropoffPoint?.lat), Number(mission.dropoffPoint?.lng), 'مقصد تحویل')}>
                🗺 باز کردن مسیر در نقشه
              </button>
            </div>
            <p className="text-[11px] text-muted">
              مسافت: {mission.distanceKm ? `${toFaDigits(mission.distanceKm.toFixed(1))} کیلومتر` : 'تخمینی'} · ثبت {dateFa(mission.createdAt)}
            </p>
          </div>

          <Section title="اقدام‌ها">
            <div className="space-y-2">
              {mission.status === 'OFFERED' ? (
                <button type="button" className="cp-btn-primary w-full" onClick={() => run(() => api.delivery.accept(mission.id), 'مأموریت پذیرفته شد')}>
                  پذیرش مأموریت
                </button>
              ) : null}

              {['ACCEPTED'].includes(mission.status) ? (
                <div className="cp-card space-y-2">
                  <Field label="کد تحویل از فروشگاه (روی بسته است)">
                    <input className="cp-field" dir="ltr" inputMode="numeric" value={pickupCode} onChange={(e) => setPickupCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                  </Field>
                  <button
                    type="button"
                    className="cp-btn-primary w-full"
                    disabled={pickupCode.length < 4}
                    onClick={() => run(() => api.delivery.pickup(mission.id, pickupCode), 'تحویل از فروشگاه ثبت شد')}
                  >
                    تأیید تحویل از فروشگاه
                  </button>
                </div>
              ) : null}

              {mission.status === 'PICKED_UP' ? (
                <button type="button" className="cp-btn-primary w-full" onClick={() => run(() => api.delivery.transit(mission.id), 'حرکت به سمت مقصد ثبت شد')}>
                  🛵 حرکت به سمت مقصد
                </button>
              ) : null}

              {['IN_TRANSIT', 'DELIVERY_ATTEMPTED'].includes(mission.status) ? (
                <div className="cp-card space-y-2">
                  <Field label="کد تحویل (OTP) — از مشتری بگیرید">
                    <input className="cp-field" dir="ltr" inputMode="numeric" value={deliveryOtp} onChange={(e) => setDeliveryOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                  </Field>
                  <button
                    type="button"
                    className="cp-btn-primary w-full"
                    disabled={deliveryOtp.length < 4}
                    onClick={() => run(() => api.delivery.deliver(mission.id, deliveryOtp), 'تحویل سفارش با موفقیت ثبت شد 🎉')}
                  >
                    تأیید تحویل به مشتری
                  </button>
                  <Field label="دلیل عدم تحویل (اختیاری)">
                    <input className="cp-field" value={failReason} onChange={(e) => setFailReason(e.target.value)} />
                  </Field>
                  <button
                    type="button"
                    className="cp-btn-ghost w-full text-red-700"
                    onClick={() => run(() => api.delivery.fail(mission.id, failReason || 'مشتری در دسترس نبود'), 'عدم تحویل ثبت شد')}
                  >
                    ثبت عدم تحویل
                  </button>
                </div>
              ) : null}

              {['DELIVERED', 'FAILED', 'CANCELLED'].includes(mission.status) ? (
                <button type="button" className="cp-btn-ghost w-full" onClick={() => navigate('/courier')}>
                  بازگشت به مأموریت‌ها
                </button>
              ) : null}
            </div>
          </Section>
        </>
      ) : null}
    </AppShell>
  );
}
