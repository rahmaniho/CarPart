import { ROLE_LABELS_FA, toPersianDigits } from '@carpart/contract';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  CheckCircle2,
  ClipboardList,
  Home,
  LayoutDashboard,
  RefreshCw,
  Search,
  Server,
  ShoppingCart,
  User,
  WifiOff,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Modal } from '../ui/Primitives';
import {
  ANDROID_EMULATOR_ORIGIN,
  DEFAULT_NATIVE_SERVER_ORIGIN,
  getConfiguredApiOrigin,
  isNativeMobile,
  setConfiguredApiOrigin,
} from '../../lib/native-bridge';
import { defaultHomeForRoles, useAuthStore } from '../../store/auth-store';
import { useCartStore } from '../../store/cart-store';
import { useToastStore } from '../../store/toast-store';

/** بنر قطع اتصال اینترنت دستگاه در حالت موبایل/اندروید */
export function OfflineStatusBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div className="bg-rose-700 px-4 py-2 text-center text-xs font-bold text-white flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>اتصال اینترنت دستگاه برقرار نیست؛ پس از وصل شدن شبکه عملیات به‌روزرسانی می‌شود.</span>
    </div>
  );
}

/** نوار ناوبری پایین صفحه ویژه موبایل و اپلیکیشن اندروید */
export function MobileBottomNav() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const cartCount = useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0));

  const panelPath = user ? defaultHomeForRoles(user.roles) : '/login';
  const panelLabel = user ? ROLE_LABELS_FA[user.roles[0]]?.split(' ')[0] ?? 'پنل من' : 'ورود';

  const tabs = [
    { to: '/', label: 'خانه', icon: Home, exact: true },
    { to: '/search', label: 'قطعات', icon: Search },
    { to: '/cart', label: 'سبد', icon: ShoppingCart, badge: cartCount },
    { to: '/mechanic/requests/new', label: 'استعلام', icon: ClipboardList, exact: true },
    { to: panelPath, label: panelLabel, icon: user ? LayoutDashboard : User },
  ];

  return (
    <nav
      aria-label="ناوبری پایین موبایل"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.exact
            ? location.pathname === tab.to
            : location.pathname === tab.to || (tab.to !== '/' && location.pathname.startsWith(`${tab.to}/`));

          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={clsx(
                'relative flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold transition',
                active ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <div className="relative">
                <Icon className={clsx('h-5 w-5', active && 'stroke-[2.5]')} />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -left-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold text-white">
                    {toPersianDigits(tab.badge)}
                  </span>
                ) : null}
              </div>
              <span className="truncate max-w-[68px]">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** پنجره تنظیم و تست زنده آدرس سرور بک‌اند در اپلیکیشن اندروید */
export function ServerConnectionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const [originInput, setOriginInput] = useState(() => getConfiguredApiOrigin());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);

  const probeServer = async (targetOrigin: string) => {
    setTesting(true);
    setTestResult(null);
    const cleaned = targetOrigin.trim().replace(/\/+$/, '');
    const url = cleaned ? `${cleaned}/health/ready` : '/health/ready';
    try {
      const started = Date.now();
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const latency = Date.now() - started;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { status?: string; components?: { database?: { detail?: string } } };
      setTestResult({
        ok: true,
        detail: `اتصال برقرار شد (${toPersianDigits(latency)} میلی‌ثانیه — پایگاه‌داده: ${json.components?.database?.detail ?? 'فعال'})`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        detail: `عدم دسترسی به این آدرس (${err instanceof Error ? err.message : 'خطای شبکه'})`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setConfiguredApiOrigin(originInput || null);
    void queryClient.invalidateQueries();
    pushToast({
      tone: 'success',
      title: 'آدرس سرور اپلیکیشن ذخیره شد',
      detail: originInput.trim() || 'پروکسی پیش‌فرض وب',
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="تنظیم اتصال سرور اپلیکیشن (Android / API)">
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        <p className="text-slate-600 leading-relaxed">
          در نسخه اندروید، اپلیکیشن به‌طور پیش‌فرض به سرور ابری فعال متصل است. همچنین می‌توانید آن را به سرور شبکه محلی
          کارگاه، شبیه‌ساز اندروید یا دامنه اختصاصی خود متصل کنید:
        </p>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setOriginInput(DEFAULT_NATIVE_SERVER_ORIGIN);
              void probeServer(DEFAULT_NATIVE_SERVER_ORIGIN);
            }}
            className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 font-semibold text-brand-800 hover:bg-brand-100"
          >
            سرور ابری زنده (پیش‌فرض)
          </button>
          <button
            type="button"
            onClick={() => {
              setOriginInput(ANDROID_EMULATOR_ORIGIN);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
          >
            شبیه‌ساز اندروید (10.0.2.2:4000)
          </button>
          {!isNativeMobile() && (
            <button
              type="button"
              onClick={() => {
                setOriginInput('');
                void probeServer('');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
            >
              پروکسی نسبی مرورگر (/api/v1)
            </button>
          )}
        </div>

        <div>
          <label className="cp-label">آدرس ریشه سرویس API (بدون /api/v1 انتهایی)</label>
          <input
            type="url"
            value={originInput}
            onChange={(e) => setOriginInput(e.target.value)}
            placeholder="https://api.example.ir یا http://192.168.1.50:4000"
            className="cp-input ltr-num"
          />
        </div>

        {testResult && (
          <div
            className={clsx(
              'flex items-center gap-2 rounded-lg border px-3 py-2.5',
              testResult.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900',
            )}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{testResult.detail}</span>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={testing}
            onClick={() => probeServer(originInput)}
            className="cp-btn-secondary flex-1"
          >
            <RefreshCw className={clsx('h-4 w-4', testing && 'animate-spin')} />
            تست زنده اتصال
          </button>
          <button type="submit" className="cp-btn-primary flex-1">
            <Server className="h-4 w-4" />
            ذخیره و اتصال
          </button>
        </div>
      </form>
    </Modal>
  );
}
