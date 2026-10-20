import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiClientError } from '@carpart/api-client';
import { api, apiTokens } from '../lib/api';
import { useSessionStore } from '../lib/session';
import { ErrorBox, Field, OtpInput } from '../components/ui';

/** ثبت‌نام مکانیک یا پیک با تأیید موبایل */
export default function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.set);
  const [role, setRole] = useState<'mechanic' | 'courier'>('mechanic');
  const [mobile, setMobile] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);
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
        workshopName: role === 'mechanic' ? fullName : undefined,
        acceptTerms: true,
      });
      setRegisteredUserId(result.userId);
      setDevCode(result.otp.devCode ?? null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'خطای ناشناخته رخ داد.');
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
      navigate(role === 'courier' ? '/courier' : '/mechanic', { replace: true });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'خطای ناشناخته رخ داد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 bg-slate-100 p-6">
      <h1 className="text-center text-xl font-extrabold">ثبت‌نام در کارپارت</h1>
      <div className="cp-card space-y-4">
        {!registeredUserId ? (
          <>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="نوع حساب">
              {(
                [
                  { value: 'mechanic', label: '🔧 مکانیک / تعمیرگاه' },
                  { value: 'courier', label: '🛵 پیک (پیک موتوری/سواری)' },
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
            <Field label="نام و نام خانوادگی">
              <input className="cp-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="شماره موبایل">
              <input className="cp-field" dir="ltr" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 11))} />
            </Field>
            <Field label="رمز عبور (اختیاری)" hint="حداقل ۸ نویسه، شامل حرف و رقم">
              <input className="cp-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <button
              type="button"
              className="cp-btn-primary w-full"
              disabled={busy || mobile.length !== 11 || fullName.trim().length < 3}
              onClick={submitRegister}
            >
              ثبت‌نام و دریافت کد تأیید
            </button>
            <p className="text-center text-xs text-muted">
              قبلاً ثبت‌نام کرده‌اید؟{' '}
              <Link className="font-semibold text-primary" to="/login">
                ورود
              </Link>
            </p>
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
            <OtpInput value={code} onChange={setCode} disabled={busy} />
            <button type="button" className="cp-btn-primary w-full" disabled={busy || code.length !== 6} onClick={verify}>
              تأیید و ورود
            </button>
          </>
        )}
        {error ? <ErrorBox message={error} /> : null}
      </div>
    </div>
  );
}
