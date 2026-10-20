import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiClientError, type SessionUser } from '@carpart/api-client';
import { api, apiTokens } from '../../lib/api';
import { canUsePanel, canUseSeller, useSessionStore } from '../../lib/session';
import { PublicLayout } from '../../components/PublicLayout';
import { ErrorBox } from '../../components/ui';

function homeFor(user: SessionUser): string {
  if (canUsePanel(user)) return '/admin';
  if (canUseSeller(user)) return '/seller';
  return '/';
}

/** ورود عمومی — پس از ورود بر اساس نقش به پنل مربوطه هدایت می‌شود */
export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useSessionStore((s) => s.set);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [otpMode, setOtpMode] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from;

  function finish(session: { user: SessionUser; accessToken: string }): void {
    apiTokens.setAccess(session.accessToken);
    setSession(session.user);
    navigate(from ?? homeFor(session.user), { replace: true });
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (otpMode && !devCode) {
        const result = await api.auth.requestOtp(mobile, 'login');
        setDevCode(result.devCode ?? null);
      } else if (otpMode) {
        finish(await api.auth.verifyOtp(mobile, code, 'login'));
      } else {
        finish(await api.auth.login(mobile, password));
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'خطای ناشناخته');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-sm space-y-4">
        <div className="cp-card space-y-3">
          <h1 className="text-lg font-extrabold">ورود به کارپارت</h1>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">شماره موبایل</span>
            <input className="cp-field" dir="ltr" inputMode="numeric" aria-label="شماره موبایل" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 11))} />
          </label>
          {!otpMode ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">رمز عبور</span>
              <input className="cp-field" type="password" aria-label="رمز عبور" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">کد تأیید</span>
              <input className="cp-field text-center" dir="ltr" inputMode="numeric" aria-label="کد تأیید" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              {devCode ? (
                <span className="mt-1 block text-[11px] text-amber-700">
                  کد آزمایشی (محیط توسعه): <b dir="ltr">{devCode}</b>
                </span>
              ) : null}
            </label>
          )}
          <button
            type="button"
            className="cp-btn-primary w-full"
            disabled={busy || mobile.length !== 11 || (!otpMode && !password) || (otpMode && Boolean(devCode) && code.length !== 6)}
            onClick={submit}
          >
            {otpMode ? (devCode ? 'تأیید کد و ورود' : 'دریافت کد تأیید') : 'ورود'}
          </button>
          <button type="button" className="cp-btn-ghost w-full text-xs" onClick={() => { setOtpMode(!otpMode); setDevCode(null); setError(null); }}>
            {otpMode ? 'ورود با رمز عبور' : 'ورود با کد یکبارمصرف'}
          </button>
          {error ? <ErrorBox message={error} /> : null}
          <p className="text-center text-xs text-muted">
            حساب ندارید؟{' '}
            <Link className="font-semibold text-primary" to="/register">
              ثبت‌نام
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

/** ثبت‌نام مکانیک/فروشنده/پیک با تأیید موبایل */
export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.set);
  const [role, setRole] = useState<'mechanic' | 'seller' | 'courier'>('mechanic');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitRegister(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await api.auth.register({
        mobile,
        fullName,
        role,
        password: password || undefined,
        storeName: role === 'seller' ? fullName : undefined,
        workshopName: role === 'mechanic' ? fullName : undefined,
        acceptTerms: true,
      });
      setDevCode(result.otp.devCode ?? null);
      setRegistered(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'خطای ناشناخته');
    } finally {
      setBusy(false);
    }
  }

  async function verify(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const session = await api.auth.verifyOtp(mobile, code, 'mobile_verify');
      apiTokens.setAccess(session.accessToken);
      setSession(session.user);
      navigate(homeFor(session.user), { replace: true });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'خطای ناشناخته');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-sm space-y-4">
        <div className="cp-card space-y-3">
          <h1 className="text-lg font-extrabold">ثبت‌نام در کارپارت</h1>
          {!registered ? (
            <>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="نوع حساب">
                {(
                  [
                    { value: 'mechanic', label: '🔧 مکانیک' },
                    { value: 'seller', label: '🏪 فروشنده' },
                    { value: 'courier', label: '🛵 پیک' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={role === option.value}
                    className={role === option.value ? 'cp-btn-primary' : 'cp-btn-ghost'}
                    onClick={() => setRole(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">نام و نام خانوادگی</span>
                <input className="cp-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">شماره موبایل</span>
                <input className="cp-field" dir="ltr" inputMode="numeric" aria-label="شماره موبایل" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 11))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">رمز عبور (اختیاری — حداقل ۸ نویسه با حرف و رقم)</span>
                <input className="cp-field" type="password" aria-label="رمز عبور" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <button type="button" className="cp-btn-primary w-full" disabled={busy || mobile.length !== 11 || fullName.trim().length < 3} onClick={submitRegister}>
                ثبت‌نام و دریافت کد تأیید
              </button>
            </>
          ) : (
            <>
              <p className="text-sm">
                کد تأیید به شماره <b dir="ltr">{mobile}</b> ارسال شد.
              </p>
              {devCode ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  کد آزمایشی (فقط در محیط توسعه): <b className="text-base" dir="ltr">{devCode}</b>
                </div>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">کد تأیید</span>
                <input className="cp-field text-center" dir="ltr" inputMode="numeric" aria-label="کد تأیید" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </label>
              <button type="button" className="cp-btn-primary w-full" disabled={busy || code.length !== 6} onClick={verify}>
                تأیید و ورود
              </button>
            </>
          )}
          {error ? <ErrorBox message={error} /> : null}
        </div>
      </div>
    </PublicLayout>
  );
}
