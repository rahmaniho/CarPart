import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiClientError } from '@carpart/api-client';
import { api, apiTokens } from '../lib/api';
import { useSessionStore } from '../lib/session';
import { ErrorBox, Field, OtpInput, Spinner } from '../components/ui';

type Step = 'mobile' | 'otp' | 'password';

/** ورود با کد یکبارمصرف یا رمز عبور — پیام‌ها و خطاها فارسی */
export default function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.set);
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goHome(roles: string[]): void {
    if (roles.includes('courier') && !roles.includes('mechanic')) navigate('/courier', { replace: true });
    else navigate('/mechanic', { replace: true });
  }

  async function requestOtp(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await api.auth.requestOtp(mobile, 'login');
      setDevCode(result.devCode ?? null);
      setNotice(result.simulated ? result.notice ?? 'ارسال پیامک در این استقرار شبیه‌سازی است.' : null);
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'خطای ناشناخته رخ داد.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const session = await api.auth.verifyOtp(mobile, code, 'login');
      apiTokens.setAccess(session.accessToken);
      setSession(session.user);
      goHome(session.user.roles);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'خطای ناشناخته رخ داد.');
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPassword(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const session = await api.auth.login(mobile, password);
      apiTokens.setAccess(session.accessToken);
      setSession(session.user);
      goHome(session.user.roles);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'خطای ناشناخته رخ داد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 bg-slate-100 p-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl">🔧</div>
        <h1 className="text-xl font-extrabold">کارپارت</h1>
        <p className="mt-1 text-sm text-muted">تأمین و ارسال سریع قطعات یدکی</p>
      </div>

      <div className="cp-card space-y-4">
        {step === 'mobile' ? (
          <>
            <Field label="شماره موبایل">
              <input
                className="cp-field"
                dir="ltr"
                inputMode="numeric"
                placeholder="09xxxxxxxxx"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 11))}
              />
            </Field>
            <button type="button" className="cp-btn-primary w-full" disabled={busy || mobile.length !== 11} onClick={requestOtp}>
              {busy ? <Spinner label="در حال ارسال…" /> : 'دریافت کد تأیید'}
            </button>
            <button type="button" className="cp-btn-ghost w-full" onClick={() => setStep('password')}>
              ورود با رمز عبور
            </button>
            <p className="text-center text-xs text-muted">
              حساب ندارید؟{' '}
              <Link className="font-semibold text-primary" to="/register">
                ثبت‌نام
              </Link>
            </p>
          </>
        ) : null}

        {step === 'otp' ? (
          <>
            <p className="text-sm">
              کد تأیید به شماره <b dir="ltr">{mobile}</b> ارسال شد.
            </p>
            {devCode ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
                کد آزمایشی (فقط در محیط توسعه): <b className="text-base" dir="ltr">{devCode}</b>
                {notice ? <p className="mt-1">{notice}</p> : null}
              </div>
            ) : null}
            <OtpInput value={code} onChange={setCode} disabled={busy} />
            <button type="button" className="cp-btn-primary w-full" disabled={busy || code.length !== 6} onClick={verifyOtp}>
              تأیید و ورود
            </button>
            <button type="button" className="cp-btn-ghost w-full" onClick={() => setStep('mobile')}>
              تغییر شماره
            </button>
          </>
        ) : null}

        {step === 'password' ? (
          <>
            <Field label="شماره موبایل">
              <input className="cp-field" dir="ltr" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 11))} />
            </Field>
            <Field label="رمز عبور">
              <input className="cp-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <button type="button" className="cp-btn-primary w-full" disabled={busy || !mobile || !password} onClick={loginWithPassword}>
              ورود
            </button>
            <button type="button" className="cp-btn-ghost w-full" onClick={() => setStep('mobile')}>
              ورود با کد یکبارمصرف
            </button>
          </>
        ) : null}

        {error ? <ErrorBox message={error} /> : null}
      </div>

      <p className="text-center text-[11px] leading-5 text-muted">
        با ورود، <span className="font-semibold">شرایط استفاده</span> و <span className="font-semibold">حریم خصوصی</span> کارپارت را می‌پذیرید.
      </p>
    </div>
  );
}
