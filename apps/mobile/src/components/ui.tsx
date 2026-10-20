import type { ReactNode } from 'react';
import clsx from 'clsx';
import type { DeliveryStatus, OrderStatus } from '@carpart/contract';
import { DELIVERY_STATUS_META, ORDER_STATUS_META, formatToman } from '@carpart/contract';

export function Spinner({ label = 'در حال بارگذاری…' }: { label?: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-primary" aria-hidden />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }): JSX.Element {
  return (
    <div className="cp-card flex flex-col items-center gap-2 text-center">
      <div className="mb-1 text-3xl" aria-hidden>
        📭
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {hint ? <p className="text-xs leading-6 text-muted">{hint}</p> : null}
      {action}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div className="cp-card border-red-200 bg-red-50" role="alert">
      <p className="text-sm font-semibold text-red-800">{message}</p>
      {onRetry ? (
        <button type="button" className="cp-btn-ghost mt-3" onClick={onRetry}>
          تلاش دوباره
        </button>
      ) : null}
    </div>
  );
}

const ORDER_CHIP: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  danger: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  progress: 'bg-sky-100 text-sky-800',
  info: 'bg-cyan-100 text-cyan-800',
  neutral: 'bg-slate-100 text-slate-700',
};

export function StatusChip({ status, kind = 'order' }: { status: OrderStatus | DeliveryStatus | string; kind?: 'order' | 'delivery' }): JSX.Element {
  const metaTable = (kind === 'delivery' ? DELIVERY_STATUS_META : ORDER_STATUS_META) as unknown as Record<string, { fa: string; tone: string }>;
  const meta = metaTable[status];
  const tone = meta?.tone ?? 'neutral';
  return <span className={clsx('cp-chip', ORDER_CHIP[tone] ?? ORDER_CHIP.neutral)}>{meta?.fa ?? status}</span>;
}

export function Money({ amount, className }: { amount: number; className?: string }): JSX.Element {
  return <span className={clsx('tabular-nums', className)}>{formatToman(amount)}</span>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}): JSX.Element {
  return (
    <label className="block">
      <span className="cp-label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function OtpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }): JSX.Element {
  return (
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      dir="ltr"
      className="cp-field text-center text-2xl tracking-[0.5em]"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      aria-label="کد تأیید"
    />
  );
}

export function StatCard({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'primary' | 'money' }): JSX.Element {
  return (
    <div className={clsx('cp-card text-center', tone === 'primary' && 'border-primary/40 bg-primary-soft/30')}>
      <p className="text-[11px] text-muted">{label}</p>
      <p className={clsx('mt-1 text-lg font-extrabold tabular-nums', tone === 'money' && 'text-primary')}>{value}</p>
    </div>
  );
}

export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }): JSX.Element {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
      {onBack ? (
        <button type="button" onClick={onBack} className="cp-btn-ghost !px-2.5 !py-1.5" aria-label="بازگشت">
          ←
        </button>
      ) : null}
      <h1 className="flex-1 truncate text-base font-bold">{title}</h1>
      {right}
    </header>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }): JSX.Element {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
