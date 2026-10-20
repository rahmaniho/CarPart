import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa, toFaDigits } from '../../lib/format';
import { DataTable, ErrorBox, Field, PageHeader, Spinner } from '../../components/ui';

/** مدیریت کوپن‌های تخفیف */
export function CouponsPage(): JSX.Element {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ code: '', percent: '10', maxDiscount: '200000', minOrder: '0', expiresAt: '', usageLimit: '100' });

  const coupons = useQuery({ queryKey: ['admin-coupons'], queryFn: () => api.admin.coupons({ pageSize: 30 }) });

  const create = useMutation({
    mutationFn: () =>
      api.admin.createCoupon({
        code: draft.code.toUpperCase(),
        percent: Number(draft.percent),
        maxDiscount: Number(draft.maxDiscount),
        minOrderAmount: Number(draft.minOrder),
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : undefined,
        usageLimit: Number(draft.usageLimit),
      }),
    onSuccess: () => {
      setOk('کوپن ساخته شد');
      setError(null);
      setShowCreate(false);
      void qc.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ساخت کوپن ناموفق بود'),
  });

  const toggle = useMutation({
    mutationFn: (row: Record<string, unknown>) => api.admin.updateCoupon(String(row.id), { isActive: !row.isActive }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-coupons'] }),
    onError: () => setError('تغییر وضعیت کوپن ناموفق بود'),
  });

  return (
    <>
      <PageHeader
        title="کوپن‌های تخفیف"
        actions={
          <button type="button" className="cp-btn-primary" onClick={() => setShowCreate((value) => !value)}>
            + کوپن جدید
          </button>
        }
      />
      {error ? <ErrorBox message={error} /> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</div> : null}

      {showCreate ? (
        <div className="cp-card grid grid-cols-2 gap-3">
          <Field label="کد کوپن">
            <input className="cp-field" dir="ltr" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="درصد تخفیف">
            <input className="cp-field" inputMode="numeric" value={draft.percent} onChange={(e) => setDraft({ ...draft, percent: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="سقف تخفیف (تومان)">
            <input className="cp-field" inputMode="numeric" value={draft.maxDiscount} onChange={(e) => setDraft({ ...draft, maxDiscount: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="حداقل مبلغ سفارش">
            <input className="cp-field" inputMode="numeric" value={draft.minOrder} onChange={(e) => setDraft({ ...draft, minOrder: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="تاریخ انقضا">
            <input className="cp-field" type="date" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} />
          </Field>
          <Field label="سقف استفاده">
            <input className="cp-field" inputMode="numeric" value={draft.usageLimit} onChange={(e) => setDraft({ ...draft, usageLimit: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <div className="col-span-2">
            <button type="button" className="cp-btn-primary" disabled={create.isPending || !draft.code || !draft.percent} onClick={() => create.mutate()}>
              ساخت کوپن
            </button>
          </div>
        </div>
      ) : null}

      {coupons.isLoading ? <Spinner /> : null}
      <DataTable headers={['کد', 'درصد', 'سقف تخفیف', 'حداقل سفارش', 'مصرف', 'وضعیت', 'انقضا', 'عملیات']}>
        {(coupons.data?.items ?? []).map((row) => (
          <tr key={String(row.id)}>
            <td dir="ltr" className="font-semibold">{String(row.code)}</td>
            <td className="tabular-nums">{toFaDigits(String(row.percent ?? row.discountPercent ?? ''))}٪</td>
            <td className="tabular-nums">{toFaDigits(String(row.maxDiscount ?? 0))}</td>
            <td className="tabular-nums">{toFaDigits(String(row.minOrderAmount ?? row.minOrder ?? 0))}</td>
            <td className="tabular-nums">{toFaDigits(String(row.usedCount ?? 0))} / {toFaDigits(String(row.usageLimit ?? '∞'))}</td>
            <td>
              <span className={`cp-chip ${row.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{row.isActive ? 'فعال' : 'غیرفعال'}</span>
            </td>
            <td className="text-xs text-muted">{row.expiresAt ? dateFa(String(row.expiresAt), false) : '—'}</td>
            <td>
              <button type="button" className="cp-btn-ghost !py-1 text-xs" disabled={toggle.isPending} onClick={() => toggle.mutate(row)}>
                {row.isActive ? 'غیرفعال' : 'فعال'}
              </button>
            </td>
          </tr>
        ))}
        {coupons.data?.items.length === 0 ? (
          <tr><td colSpan={8} className="text-center text-xs text-muted">کوپنی ثبت نشده است</td></tr>
        ) : null}
      </DataTable>
    </>
  );
}

/** اطلاعیه‌های عمومی */
export function AnnouncementsPage(): JSX.Element {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ titleFa: '', bodyFa: '', level: 'info' });

  const announcements = useQuery({ queryKey: ['admin-announcements'], queryFn: () => api.settings.adminList().then(() => api.settings.announcements()) });

  const create = useMutation({
    mutationFn: () => api.admin.createAnnouncement({ titleFa: draft.titleFa, bodyFa: draft.bodyFa, level: draft.level, isActive: true }),
    onSuccess: () => {
      setDraft({ titleFa: '', bodyFa: '', level: 'info' });
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin-announcements'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت اطلاعیه ناموفق بود'),
  });

  return (
    <>
      <PageHeader title="اطلاعیه‌ها" subtitle="اطلاعیه‌های نمایش‌داده‌شده در صفحه خانگی و اپ‌ها" />
      {error ? <ErrorBox message={error} /> : null}
      <div className="cp-card space-y-2">
        <Field label="عنوان">
          <input className="cp-field" value={draft.titleFa} onChange={(e) => setDraft({ ...draft, titleFa: e.target.value })} />
        </Field>
        <Field label="متن">
          <textarea className="cp-field min-h-20" value={draft.bodyFa} onChange={(e) => setDraft({ ...draft, bodyFa: e.target.value })} />
        </Field>
        <button type="button" className="cp-btn-primary" disabled={create.isPending || !draft.titleFa || !draft.bodyFa} onClick={() => create.mutate()}>
          انتشار اطلاعیه
        </button>
      </div>

      {announcements.isLoading ? <Spinner /> : null}
      <div className="space-y-2">
        {(announcements.data ?? []).map((item, index) => (
          <div key={index} className="cp-card">
            <b className="text-sm">{String((item as { titleFa?: string }).titleFa ?? 'اطلاعیه')}</b>
            <p className="mt-1 text-xs leading-6 text-muted">{String((item as { bodyFa?: string }).bodyFa ?? '')}</p>
          </div>
        ))}
      </div>
    </>
  );
}
