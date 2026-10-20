import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@carpart/api-client';
import { api } from '../../lib/api';
import { SellerLayout } from '../../components/SellerLayout';
import { ErrorBox, PageHeader, Section, Spinner } from '../../components/ui';

/** پروفایل فروشگاه و شعبه‌ها + ارسال برای تأیید */
export default function SellerProfile(): JSX.Element {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState<{ storeName: string; nationalId: string; city: string; phone: string; description: string } | null>(null);
  const [branch, setBranch] = useState({ name: '', city: '', addressText: '', lat: '', lng: '' });

  const profile = useQuery({
    queryKey: ['seller-me'],
    queryFn: async () => {
      const me = await api.sellers.me();
      setForm({
        storeName: me.storeName ?? '',
        nationalId: me.nationalId ?? '',
        city: me.city ?? '',
        phone: me.phone ?? '',
        description: me.description ?? '',
      });
      return me;
    },
  });
  const branches = useQuery({ queryKey: ['seller-branches'], queryFn: () => api.sellers.branches() });

  const save = useMutation({
    mutationFn: () => api.sellers.update(form!),
    onSuccess: () => {
      setOk('اطلاعات فروشگاه ذخیره شد');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['seller-me'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ذخیره ناموفق بود'),
  });

  const addBranch = useMutation({
    mutationFn: () =>
      api.sellers.addBranch({
        name: branch.name,
        city: branch.city,
        addressText: branch.addressText,
        lat: branch.lat ? Number(branch.lat) : undefined,
        lng: branch.lng ? Number(branch.lng) : undefined,
      }),
    onSuccess: () => {
      setBranch({ name: '', city: '', addressText: '', lat: '', lng: '' });
      void queryClient.invalidateQueries({ queryKey: ['seller-branches'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت شعبه ناموفق بود'),
  });

  const submitReview = useMutation({
    mutationFn: () => api.sellers.submitReview(),
    onSuccess: () => {
      setOk('حساب برای بررسی مدیر ارسال شد');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['seller-me'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ارسال ناموفق بود (اطلاعات یا شعبه‌ها ناقص است)'),
  });

  return (
    <SellerLayout>
      <PageHeader title="فروشگاه و شعبه‌ها" />
      {error ? <ErrorBox message={error} /> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</div> : null}
      {profile.isLoading || !form ? <Spinner /> : null}

      {form ? (
        <div className="cp-card grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">نام فروشگاه</span>
            <input className="cp-field" value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">شناسه ملی</span>
            <input className="cp-field" dir="ltr" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">شهر</span>
            <input className="cp-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">تلفن</span>
            <input className="cp-field" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs text-muted">توضیحات</span>
            <textarea className="cp-field min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="col-span-2 flex flex-wrap gap-2">
            <button type="button" className="cp-btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
              ذخیره اطلاعات
            </button>
            <button type="button" className="cp-btn-ghost" disabled={submitReview.isPending} onClick={() => submitReview.mutate()}>
              ارسال برای تأیید مدیر
            </button>
            <span className="self-center text-xs text-muted">
              وضعیت فعلی: <b>{String(profile.data?.verificationStatus === 'APPROVED' ? 'تأییدشده' : profile.data?.verificationStatus === 'DRAFT' ? 'پیش‌نویس' : 'در انتظار بررسی')}</b>
            </span>
          </div>
        </div>
      ) : null}

      <Section title="شعبه‌ها">
        <div className="space-y-2">
          {(branches.data ?? []).map((item) => (
            <div key={item.id} className="cp-card">
              <b className="text-sm">{item.name}</b>
              <p className="mt-1 text-xs text-muted">{item.city ?? ''} — {item.addressText ?? ''}</p>
            </div>
          ))}
          <div className="cp-card grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">نام شعبه</span>
              <input className="cp-field" value={branch.name} onChange={(e) => setBranch({ ...branch, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">شهر</span>
              <input className="cp-field" value={branch.city} onChange={(e) => setBranch({ ...branch, city: e.target.value })} />
            </label>
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs text-muted">نشانی</span>
              <input className="cp-field" value={branch.addressText} onChange={(e) => setBranch({ ...branch, addressText: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">عرض جغرافیایی</span>
              <input className="cp-field" dir="ltr" value={branch.lat} onChange={(e) => setBranch({ ...branch, lat: e.target.value })} placeholder="35.7" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">طول جغرافیایی</span>
              <input className="cp-field" dir="ltr" value={branch.lng} onChange={(e) => setBranch({ ...branch, lng: e.target.value })} placeholder="51.4" />
            </label>
            <div className="col-span-2">
              <button type="button" className="cp-btn-primary" disabled={addBranch.isPending || !branch.name || !branch.city} onClick={() => addBranch.mutate()}>
                افزودن شعبه
              </button>
            </div>
          </div>
        </div>
      </Section>
    </SellerLayout>
  );
}
