import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClientError } from '@carpart/api-client';
import { api, apiTokens } from '../lib/api';
import { canUsePanel, useSessionStore } from '../lib/session';
import { ErrorBox } from '../components/ui';

export default function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.set);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [otpMode, setOtpMode] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function finish(session: { user: Parameters<typeof setSession>[0] & object; accessToken: string }): void {
    apiTokens.setAccess(session.accessToken);
    setSession(session.user);
    if (!canUsePanel(session.user)) {
      setError('شما دسترسی به پنل مدیریت ندارید. این پنل فقط برای مدیر و اپراتور پشتیبانی است.');
      apiTokens.setAccess(null);
      setSession(null);
      return;
    }
    navigate('/', { replace: true });
  }

  async function submitPassword(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const session = await api.auth.login(mobile, password);
      finish(session as never);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'خطای ناشناخته');
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (!devCode) {
        const result = await api.auth.requestOtp(mobile, 'login');
        setDevCode(result.devCode ?? null);
      } else {
        const session = await api.auth.verifyOtp(mobile, code, 'login');
        finish(session as never);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : 'خطای ناشناخته');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl text-white">🔧</div>
          <h1 className="text-xl font-extrabold">پنل مدیریت کارپارت</h1>
          <p className="mt-1 text-sm text-muted">ورود مدیر و اپراتور پشتیبانی</p>
        </div>
        <div className="cp-card space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">شماره موبایل</span>
            <input className="cp-field" dir="ltr" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 11))} />
          </label>
          {!otpMode ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">رمز عبور</span>
              <input className="cp-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">کد تأیید</span>
              <input className="cp-field text-center" dir="ltr" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
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
            onClick={otpMode ? submitOtp : submitPassword}
          >
            {otpMode ? (devCode ? 'تأیید کد و ورود' : 'دریافت کد تأیید') : 'ورود'}
          </button>
          <button type="button" className="cp-btn-ghost w-full text-xs" onClick={() => { setOtpMode(!otpMode); setDevCode(null); setError(null); }}>
            {otpMode ? 'ورود با رمز عبور' : 'ورود با کد یکبارمصرف'}
          </button>
          {error ? <ErrorBox message={error} /> : null}
        </div>
      </div>
    </div>
  );
}
