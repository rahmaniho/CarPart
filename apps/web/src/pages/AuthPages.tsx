import {
  ROLE_LABELS_FA,
  normalizeIranMobile,
  toLatinDigits,
  type CurrentUserDto,
  type Role,
} from '@carpart/contract';
import { KeyRound, Smartphone, Sparkles, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorAlert } from '../components/ui/Primitives';
import { api } from '../lib/api-client';
import { defaultHomeForRoles, useAuthStore } from '../store/auth-store';
import { useToastStore } from '../store/toast-store';

interface AuthSuccessPayload {
  user: CurrentUserDto;
  accessToken: string;
}

const DEMO_ACCOUNTS: Array<{ label: string; sub: string; mobile: string }> = [
  { label: 'مکانیک / تعمیرگاه', sub: 'رضا محمدی — تعمیرگاه تکنیک خودرو', mobile: '09121110001' },
  { label: 'فروشنده قطعه', sub: 'حسین رحیمی — یدک مرکزی پایتخت', mobile: '09122220001' },
  { label: 'پیک ناوگان', sub: 'مهدی قاسمی — موتورسیکلت تهران', mobile: '09123330001' },
  { label: 'اپراتور پشتیبانی', sub: 'سارا احمدی — دسترسی عملیاتی غیرمالی', mobile: '09120000001' },
  { label: 'مدیر پلتفرم', sub: 'مدیر سامانه — دسترسی کامل مدیریتی و مالی', mobile: '09120000000' },
];

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const pushToast = useToastStore((s) => s.push);

  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [mobile, setMobile] = useState('09121110001');
  const [password, setPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const finishLogin = (result: AuthSuccessPayload) => {
    setSession(result.user, result.accessToken);
    pushToast({
      tone: 'success',
      title: `خوش آمدید، ${result.user.fullName}`,
      detail: `ورود با نقش ${result.user.roles.map((r) => ROLE_LABELS_FA[r]).join('، ')}`,
    });
    const redirect = searchParams.get('redirect');
    navigate(redirect || defaultHomeForRoles(result.user.roles), { replace: true });
  };

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = normalizeIranMobile(mobile);
    if (!clean) {
      setError(new Error('شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۱۱۰۰۰۱).'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ devCode?: string; simulated?: boolean }>('auth/otp/request', {
        mobile: clean,
        purpose: 'login',
      });
      setOtpSent(true);
      if (res.devCode) {
        setDevCodeHint(res.devCode);
        setOtpCode(res.devCode);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = normalizeIranMobile(mobile);
    if (!clean) return;
    setLoading(true);
    try {
      const res = await api.post<AuthSuccessPayload>('auth/otp/verify', {
        mobile: clean,
        code: toLatinDigits(otpCode).trim(),
        purpose: 'login',
      });
      finishLogin(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = normalizeIranMobile(mobile);
    if (!clean) {
      setError(new Error('شماره موبایل معتبر نیست.'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<AuthSuccessPayload>('auth/login', {
        mobile: clean,
        password,
      });
      finishLogin(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoMobile: string) => {
    setError(null);
    setLoading(true);
    setMobile(demoMobile);
    try {
      const otpRes = await api.post<{ devCode?: string }>('auth/otp/request', {
        mobile: demoMobile,
        purpose: 'login',
      });
      if (!otpRes.devCode) {
        setOtpSent(true);
        setLoading(false);
        return;
      }
      const verified = await api.post<AuthSuccessPayload>('auth/otp/verify', {
        mobile: demoMobile,
        code: otpRes.devCode,
        purpose: 'login',
      });
      finishLogin(verified);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-12">
      {/* فرم ورود */}
      <div className="cp-card p-6 lg:col-span-7 space-y-5">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">ورود به سامانه قطعه‌رسان</h1>
          <p className="mt-1 text-xs text-slate-500">
            نشست امن با توکن دسترسی کوتاه‌مدت و رفرش توکن چرخشی در کوکی محافظت‌شده (HttpOnly)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('otp');
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-md py-2 transition ${
              mode === 'otp' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            کد یکبارمصرف پیامکی
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('password');
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-md py-2 transition ${
              mode === 'password' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            رمز عبور ثابت
          </button>
        </div>

        <ErrorAlert error={error} />

        {mode === 'otp' ? (
          !otpSent ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label htmlFor="login-mobile" className="cp-label">
                  شماره موبایل
                </label>
                <input
                  id="login-mobile"
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="09121110001"
                  className="cp-input ltr-num text-left"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="cp-btn-primary w-full">
                {loading ? 'در حال ارسال کد...' : 'دریافت کد یکبارمصرف'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {devCodeHint && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                  <strong>حالت آزمایشی پیامک:</strong> کد یکبارمصرف شبیه‌سازی‌شده شما:{' '}
                  <span className="rounded bg-white px-2 py-0.5 font-mono text-sm font-extrabold ltr-num">
                    {devCodeHint}
                  </span>
                </div>
              )}
              <div>
                <label htmlFor="otp-code" className="cp-label">
                  کد تأیید ارسال‌شده به {mobile}
                </label>
                <input
                  id="otp-code"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="cp-input ltr-num text-center text-lg tracking-widest font-bold"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="cp-btn-primary flex-1">
                  {loading ? 'در حال بررسی...' : 'تأیید و ورود'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setDevCodeHint(null);
                  }}
                  className="cp-btn-secondary"
                >
                  تغییر شماره
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label htmlFor="pw-mobile" className="cp-label">
                شماره موبایل
              </label>
              <input
                id="pw-mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="cp-input ltr-num text-left"
                required
              />
            </div>
            <div>
              <label htmlFor="pw-input" className="cp-label">
                رمز عبور
              </label>
              <input
                id="pw-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور حساب خود را وارد کنید"
                className="cp-input ltr-num text-left"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="cp-btn-primary w-full">
              {loading ? 'در حال ورود...' : 'ورود با رمز عبور'}
            </button>
          </form>
        )}

        <div className="border-t border-slate-100 pt-4 text-center text-xs text-slate-600">
          هنوز حساب ندارید؟{' '}
          <Link to="/register" className="font-bold text-brand-700 hover:underline">
            ثبت‌نام تعمیرگاه، فروشنده یا پیک
          </Link>
        </div>
      </div>

      {/* ورود سریع حساب‌های نمونه توسعه */}
      <div className="cp-card p-5 lg:col-span-5 bg-slate-50/70 space-y-3">
        <div className="flex items-center gap-2 text-brand-800">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-extrabold">ورود سریع با حساب‌های نمونه (محیط توسعه)</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          برای آزمودن واقعی همه نقش‌ها روی داده سیدشده سرور، روی هر نقش کلیک کنید تا با احراز هویت واقعی OTP وارد شوید:
        </p>

        <div className="space-y-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.mobile}
              type="button"
              disabled={loading}
              onClick={() => handleQuickDemoLogin(acc.mobile)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-right transition hover:border-brand-400 hover:shadow-sm disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{acc.label}</span>
                <span className="font-mono text-[11px] text-brand-700 ltr-num">{acc.mobile}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">{acc.sub}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const pushToast = useToastStore((s) => s.push);

  const [role, setRole] = useState<'mechanic' | 'seller' | 'courier'>('mechanic');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('تهران');
  const [workshopName, setWorkshopName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [password, setPassword] = useState('');

  const [verifyStep, setVerifyStep] = useState<{ mobile: string; devCode?: string } | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = normalizeIranMobile(mobile);
    if (!clean) {
      setError(new Error('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ otp?: { devCode?: string } }>('auth/register', {
        mobile: clean,
        fullName,
        role: role as Role,
        city,
        password: password || undefined,
        workshopName: role === 'mechanic' ? workshopName || undefined : undefined,
        storeName: role === 'seller' ? storeName || undefined : undefined,
        acceptTerms: true,
      });
      const devCode = res.otp?.devCode;
      setVerifyStep({ mobile: clean, devCode });
      if (devCode) setCode(devCode);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!verifyStep) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<AuthSuccessPayload>('auth/otp/verify', {
        mobile: verifyStep.mobile,
        code: toLatinDigits(code).trim(),
        purpose: 'mobile_verify',
      });
      setSession(res.user, res.accessToken);
      pushToast({ tone: 'success', title: 'حساب کاربری با موفقیت ساخته و فعال شد' });
      navigate(defaultHomeForRoles(res.user.roles), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cp-card mx-auto max-w-xl p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <UserPlus className="h-5 w-5 text-brand-700" />
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">ثبت‌نام در شبکه قطعه‌رسان</h1>
          <p className="text-xs text-slate-500">نقش تخصصی خود را انتخاب کنید؛ فروشندگان و پیک‌ها پس از تکمیل مدارک تأیید می‌شوند.</p>
        </div>
      </div>

      <ErrorAlert error={error} />

      {!verifyStep ? (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: 'mechanic', label: 'مکانیک / تعمیرگاه' },
                { key: 'seller', label: 'فروشنده قطعه' },
                { key: 'courier', label: 'پیک / راننده' },
              ] as const
            ).map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRole(r.key)}
                className={`rounded-xl border p-3 text-xs font-bold transition ${
                  role === r.key
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="cp-label">نام و نام خانوادگی</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="cp-input"
                placeholder="مثال: علی رضایی"
                required
                minLength={3}
              />
            </div>
            <div>
              <label className="cp-label">شماره موبایل</label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="cp-input ltr-num text-left"
                placeholder="0912xxxxxxx"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="cp-label">شهر فعالیت</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="cp-input"
                required
              />
            </div>
            {role === 'mechanic' && (
              <div>
                <label className="cp-label">نام تعمیرگاه</label>
                <input
                  type="text"
                  value={workshopName}
                  onChange={(e) => setWorkshopName(e.target.value)}
                  className="cp-input"
                  placeholder="مثال: تعمیرگاه تخصصی پارس"
                />
              </div>
            )}
            {role === 'seller' && (
              <div>
                <label className="cp-label">نام فروشگاه</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="cp-input"
                  placeholder="مثال: بازرگانی یدک نوین"
                />
              </div>
            )}
          </div>

          <div>
            <label className="cp-label">رمز عبور دلخواه (اختیاری — حداقل ۸ نویسه شامل حرف و عدد)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="cp-input ltr-num text-left"
              placeholder="مثال: CarPart123"
            />
          </div>

          <button type="submit" disabled={loading} className="cp-btn-primary w-full">
            {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام و دریافت کد فعال‌سازی'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          {verifyStep.devCode && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              کد فعال‌سازی شبیه‌سازی‌شده (حالت توسعه):{' '}
              <strong className="font-mono text-sm ltr-num">{verifyStep.devCode}</strong>
            </div>
          )}
          <div>
            <label className="cp-label">کد تأیید شماره موبایل</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="cp-input ltr-num text-center text-lg font-bold tracking-widest"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="cp-btn-primary w-full">
            {loading ? 'در حال تأیید...' : 'تأیید شماره موبایل و ورود به پنل'}
          </button>
        </form>
      )}
    </div>
  );
}
