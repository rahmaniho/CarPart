import {
  ORDER_PROGRESS_STEPS,
  toPersianDigits,
  type LabeledStatus,
  type OrderStatus,
  type RankExplanation,
  type Tone,
} from '@carpart/contract';
import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, Loader2, ShieldCheck, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiClientError } from '../../lib/api-client';
import { useToastStore } from '../../store/toast-store';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  progress: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function StatusBadge({
  tone = 'neutral',
  label,
  title,
  size = 'sm',
}: {
  tone?: Tone;
  label: string;
  title?: string;
  size?: 'xs' | 'sm';
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center rounded-md font-semibold ring-1 ring-inset whitespace-nowrap',
        size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        TONE_CLASSES[tone] ?? TONE_CLASSES.neutral,
      )}
    >
      {label}
    </span>
  );
}

export function StatusFromMap<T extends string>({
  value,
  map,
  size = 'sm',
}: {
  value: string | null | undefined;
  map: LabeledStatus<T>;
  size?: 'xs' | 'sm';
}) {
  if (!value) return <StatusBadge tone="neutral" label="نامشخص" size={size} />;
  const entry = (map as Record<string, { fa: string; tone: Tone; hint?: string }>)[value];
  if (!entry) return <StatusBadge tone="neutral" label={value} size={size} />;
  return <StatusBadge tone={entry.tone} label={entry.fa} title={entry.hint} size={size} />;
}

export function ErrorAlert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  const apiErr = error instanceof ApiClientError ? error : null;
  const message = apiErr?.faMessage ?? (error instanceof Error ? error.message : 'خطای نامشخص در عملیات');

  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{message}</p>
            {apiErr?.errors && apiErr.errors.length > 0 && (
              <ul className="list-inside list-disc space-y-0.5 text-xs text-rose-800">
                {apiErr.errors.map((err, idx) => (
                  <li key={`${err.field}-${idx}`}>
                    {err.field ? <span className="font-mono">{err.field}: </span> : null}
                    {err.message}
                  </li>
                ))}
              </ul>
            )}
            {apiErr?.requestId && (
              <p className="text-[11px] text-rose-600">
                شناسه پیگیری خطا: <span className="font-mono ltr-num">{apiErr.requestId}</span>
              </p>
            )}
          </div>
        </div>
        {onRetry && (
          <button type="button" onClick={onRetry} className="cp-btn-secondary text-xs shrink-0">
            تلاش مجدد
          </button>
        )}
      </div>
    </div>
  );
}

export function LoadingState({ label = 'در حال دریافت اطلاعات واقعی از سرور...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-12 text-slate-500">
      <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-base font-bold text-slate-800">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  tone?: 'default' | 'brand' | 'amber' | 'emerald';
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border p-4 shadow-sm',
        tone === 'brand'
          ? 'border-brand-200 bg-brand-50/50'
          : tone === 'amber'
            ? 'border-amber-200 bg-amber-50/50'
            : tone === 'emerald'
              ? 'border-emerald-200 bg-emerald-50/50'
              : 'border-slate-200 bg-white',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
        {typeof value === 'number' ? toPersianDigits(value) : value}
      </div>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
      <div className={clsx('w-full rounded-2xl border border-slate-200 bg-white shadow-xl', maxWidth)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function RankBreakdownModal({
  open,
  onClose,
  sellerName,
  rank,
  warnings,
}: {
  open: boolean;
  onClose: () => void;
  sellerName: string;
  rank: RankExplanation | null;
  warnings?: string[];
}) {
  return (
    <Modal open={open} onClose={onClose} title={`جزئیات رتبه‌بندی شفاف — ${sellerName}`} maxWidth="max-w-xl">
      {!rank ? (
        <p className="text-sm text-slate-500">اطلاعات رتبه‌بندی برای این ردیف ثبت نشده است.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
            <div className="flex items-center gap-2 text-emerald-900">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              <div className="text-xs">
                <p className="font-bold">رتبه‌بندی ۱۰۰٪ بی‌طرف و قابل حسابرسی</p>
                <p className="text-emerald-800">نرخ کارمزد پلتفرم هیچ تأثیری در جایگاه فروشندگان ندارد.</p>
              </div>
            </div>
            <div className="text-left">
              <span className="text-xs text-emerald-700">امتیاز کل</span>
              <p className="text-xl font-extrabold text-emerald-900">{toPersianDigits(Math.round(rank.total))} از ۱۰۰</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {rank.factors.map((factor) => (
              <div key={factor.key} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {factor.fa}{' '}
                    <span className="font-normal text-slate-500">(وزن: {toPersianDigits(Math.round(factor.weight))}٪)</span>
                  </span>
                  <span className="font-bold text-brand-700">
                    سهم امتیاز: {toPersianDigits(factor.contribution.toFixed(1))}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, Math.round(factor.score * 100)))}%` }}
                  />
                </div>
                {factor.note && <p className="mt-1 text-[11px] text-slate-500">{factor.note}</p>}
              </div>
            ))}
          </div>

          {warnings && warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-bold mb-1">نکات قابل توجه پیش از خرید:</p>
              <ul className="list-inside list-disc space-y-0.5">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function OrderProgressBar({ status }: { status: OrderStatus }) {
  const activeStepIndex = ORDER_PROGRESS_STEPS.findIndex((step) =>
    (step.statuses as readonly OrderStatus[]).includes(status),
  );

  if (['CANCELLED', 'REFUNDED', 'REFUND_REQUESTED', 'DISPUTED', 'PAYMENT_FAILED'].includes(status)) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-5 gap-2">
        {ORDER_PROGRESS_STEPS.map((step, idx) => {
          const done = activeStepIndex >= idx;
          const current = activeStepIndex === idx;
          return (
            <div key={step.key} className="flex flex-col items-center text-center">
              <div
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition',
                  current
                    ? 'bg-brand-700 text-white ring-4 ring-brand-100'
                    : done
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-400',
                )}
              >
                {done && !current ? '✓' : toPersianDigits(idx + 1)}
              </div>
              <span className={clsx('mt-1.5 text-[11px] font-semibold', done ? 'text-slate-900' : 'text-slate-400')}>
                {step.fa}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'flex items-start justify-between gap-3 rounded-xl border p-3.5 shadow-lg',
            toast.tone === 'success'
              ? 'border-emerald-200 bg-emerald-950 text-emerald-50'
              : toast.tone === 'error'
                ? 'border-rose-300 bg-rose-950 text-rose-50'
                : toast.tone === 'warning'
                  ? 'border-amber-300 bg-amber-950 text-amber-50'
                  : 'border-slate-700 bg-slate-900 text-white',
          )}
        >
          <div className="flex items-start gap-2.5 text-xs">
            {toast.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : toast.tone === 'error' ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
            )}
            <div>
              <p className="font-bold">{toast.title}</p>
              {toast.detail && <p className="mt-0.5 opacity-90">{toast.detail}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="rounded p-0.5 opacity-70 hover:opacity-100"
            aria-label="بستن اعلان"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
