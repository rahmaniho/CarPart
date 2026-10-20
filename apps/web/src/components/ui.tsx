import type { ReactNode } from 'react';
import clsx from 'clsx';
import { DELIVERY_STATUS_META, ORDER_STATUS_META } from '@carpart/contract';

export function Spinner({ label = 'در حال بارگذاری…' }: { label?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-muted" role="status">
      <span className="h-6 w-6 animate-spin rounded-full border-4 border-line border-t-primary" aria-hidden />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="cp-btn-ghost mr-3 !py-1 text-xs" onClick={onRetry}>
          تلاش دوباره
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }): JSX.Element {
  return (
    <div className="cp-card py-8 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const TONES: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  danger: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  progress: 'bg-sky-100 text-sky-800',
  info: 'bg-cyan-100 text-cyan-800',
  neutral: 'bg-slate-100 text-slate-700',
};

export function StatusChip({ status, kind = 'order' }: { status: string; kind?: 'order' | 'delivery' }): JSX.Element {
  const table = (kind === 'delivery' ? DELIVERY_STATUS_META : ORDER_STATUS_META) as unknown as Record<string, { fa: string; tone: string }>;
  const meta = table[status];
  return <span className={clsx('cp-chip', TONES[meta?.tone ?? 'neutral'])}>{meta?.fa ?? status}</span>;
}

export function StatCard({ label, value, hint, tone = 'default' }: { label: string; value: string | number; hint?: string; tone?: 'default' | 'primary' | 'money' }): JSX.Element {
  return (
    <div className={clsx('cp-card', tone === 'primary' && 'border-primary/40 bg-primary-soft/40')}>
      <p className="text-xs text-muted">{label}</p>
      <p className={clsx('mt-1 text-xl font-extrabold tabular-nums', tone === 'money' && 'text-primary')}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }): JSX.Element {
  return (
    <div className="cp-card overflow-x-auto !p-0">
      <table className="cp-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-extrabold">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}
