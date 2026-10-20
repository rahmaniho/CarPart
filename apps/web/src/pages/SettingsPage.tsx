import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { isAdmin, useSessionStore } from '../lib/session';
import { DataTable, ErrorBox, PageHeader, Spinner, StatCard } from '../components/ui';
import { compactMoney, toFaDigits } from '../lib/format';

/** تنظیمات سامانه — مقادیر در پایگاه‌داده و قابل تغییر (کمیسیون، هزینه ارسال و…) */
export default function SettingsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const me = useSessionStore((s) => s.user);
  const admin = isAdmin(me);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: () => api.settings.adminList() });
  const summary = useQuery({ queryKey: ['finance-summary'], queryFn: () => api.finance.adminSummary() });

  const update = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string | number | boolean }) => api.settings.adminUpdate(key, value),
    onSuccess: (_data, variables) => {
      setOk(`تنظیم «${variables.key}» ذخیره شد`);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: () => {
      setError('ذخیره تنظیم ناموفق بود (مقدار نامعتبر یا دسترسی ناکافی)');
      setOk(null);
    },
  });

  function save(key: string, raw: string): void {
    const asNumber = Number(raw);
    const value = raw === 'true' ? true : raw === 'false' ? false : Number.isFinite(asNumber) && raw.trim() !== '' ? asNumber : raw;
    update.mutate({ key, value });
  }

  return (
    <>
      <PageHeader title="تنظیمات سامانه" subtitle="پارامترهای درآمدی و عملیاتی — همه تغییرات در گزارش ممیزی ثبت می‌شود" />
      {!admin ? <ErrorBox message="فقط مدیر سامانه می‌تواند تنظیمات را تغییر دهد (مشاهده برای اپراتور مجاز است)." /> : null}
      {error ? <ErrorBox message={error} /> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</div> : null}

      {summary.data ? (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="GMV" value={`${compactMoney(Number(summary.data.gmv ?? 0))} تومان`} tone="money" />
          <StatCard label="درآمد پلتفرم (کمیسیون)" value={`${compactMoney(Number(summary.data.platformCommission ?? summary.data.platformRevenue ?? 0))} تومان`} tone="money" />
          <StatCard label="سهم فروشندگان" value={`${compactMoney(Number(summary.data.sellerNet ?? 0))} تومان`} />
          <StatCard label="سهم پیک‌ها" value={`${compactMoney(Number(summary.data.courierShare ?? 0))} تومان`} />
        </section>
      ) : null}

      {settings.isLoading ? <Spinner /> : null}
      <DataTable headers={['کلید', 'برچسب', 'مقدار فعلی', 'مقدار جدید']}>
        {(settings.data ?? []).map((setting) => (
          <SettingRow key={setting.key} setting={setting} disabled={!admin} onSave={save} />
        ))}
      </DataTable>
    </>
  );
}

function SettingRow({
  setting,
  disabled,
  onSave,
}: {
  setting: { key: string; value: string | number | boolean; faLabel: string };
  disabled: boolean;
  onSave: (key: string, raw: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(String(setting.value));
  return (
    <tr>
      <td dir="ltr" className="text-xs">
        {setting.key}
      </td>
      <td>{setting.faLabel}</td>
      <td className="tabular-nums">{toFaDigits(String(setting.value))}</td>
      <td>
        <div className="flex gap-1.5">
          <input className="cp-field !w-40 !py-1 text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={disabled} />
          <button type="button" className="cp-btn-primary !py-1 text-xs" disabled={disabled || draft === String(setting.value)} onClick={() => onSave(setting.key, draft)}>
            ذخیره
          </button>
        </div>
      </td>
    </tr>
  );
}
