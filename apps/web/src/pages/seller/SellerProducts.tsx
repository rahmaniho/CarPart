import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type CreateProductInput, type SellerProductRow } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa, formatToman, toFaDigits } from '../../lib/format';
import { SellerLayout } from '../../components/SellerLayout';
import { DataTable, ErrorBox, PageHeader, Spinner, StatCard } from '../../components/ui';

/** مدیریت محصولات و موجودی فروشنده */
export default function SellerProducts(): JSX.Element {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SellerProductRow | null>(null);
  const [draft, setDraft] = useState<{ partId: string; price: string; stock: string; sku: string; quality: string; preparationMinutes: string }>({
    partId: '',
    price: '',
    stock: '',
    sku: '',
    quality: 'aftermarket_high',
    preparationMinutes: '30',
  });

  const products = useQuery({ queryKey: ['seller-products'], queryFn: () => api.sellers.products({ pageSize: 50 }) });
  const parts = useQuery({ queryKey: ['catalog-parts'], queryFn: () => api.catalog.parts({ pageSize: 200 }) });

  const create = useMutation({
    mutationFn: () => {
      const input: CreateProductInput = {
        partId: draft.partId,
        price: Number(draft.price),
        stock: Number(draft.stock),
        sku: draft.sku || undefined,
        quality: draft.quality,
        preparationMinutes: Number(draft.preparationMinutes) || 30,
      };
      return api.sellers.createProduct(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['seller-products'] });
      setShowCreate(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت محصول ناموفق بود (حساب باید تأیید شده باشد)'),
  });

  const saveEdits = useMutation({
    mutationFn: async (product: SellerProductRow) => {
      const price = Number(draft.price);
      const stock = Number(draft.stock);
      if (Number.isFinite(price) && price > 0) await api.sellers.setPrice(product.id, price);
      if (Number.isFinite(stock) && stock >= 0) await api.sellers.setStock(product.id, { absoluteStock: stock, reason: 'adjustment' });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['seller-products'] });
      setEditing(null);
      setError(null);
    },
    onError: () => setError('ذخیره تغییرات ناموفق بود'),
  });

  const toggleActive = useMutation({
    mutationFn: (product: SellerProductRow) => api.sellers.setActive(product.id, !product.isActive),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['seller-products'] }),
    onError: () => setError('تغییر وضعیت نمایش ناموفق بود'),
  });

  return (
    <SellerLayout>
      <PageHeader
        title="محصولات و موجودی"
        actions={
          <button type="button" className="cp-btn-primary" onClick={() => setShowCreate((value) => !value)}>
            + افزودن محصول
          </button>
        }
      />
      {error ? <ErrorBox message={error} /> : null}

      {showCreate ? (
        <div className="cp-card grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs text-muted">قطعه از کاتالوگ</span>
            <select className="cp-field" value={draft.partId} onChange={(e) => setDraft({ ...draft, partId: e.target.value })}>
              <option value="">— انتخاب قطعه —</option>
              {(parts.data?.items ?? []).map((part) => <option key={String(part.id)} value={String(part.id)}>{String(part.nameFa ?? 'قطعه')}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">قیمت (تومان)</span>
            <input className="cp-field" inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">موجودی اولیه</span>
            <input className="cp-field" inputMode="numeric" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">کد SKU (اختیاری)</span>
            <input className="cp-field" dir="ltr" value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">کیفیت</span>
            <select className="cp-field" value={draft.quality} onChange={(e) => setDraft({ ...draft, quality: e.target.value })}>
              <option value="genuine">اصلی</option>
              <option value="aftermarket_high">aftermarket درجه یک</option>
              <option value="aftermarket_standard">aftermarket استاندارد</option>
              <option value="used">دست‌دوم</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">زمان آماده‌سازی (دقیقه)</span>
            <input className="cp-field" inputMode="numeric" value={draft.preparationMinutes} onChange={(e) => setDraft({ ...draft, preparationMinutes: e.target.value.replace(/\D/g, '') })} />
          </label>
          <div className="col-span-2 flex gap-2">
            <button type="button" className="cp-btn-primary" disabled={create.isPending || !draft.partId || !draft.price || !draft.stock} onClick={() => create.mutate()}>
              ثبت محصول
            </button>
            <button type="button" className="cp-btn-ghost" onClick={() => setShowCreate(false)}>
              انصراف
            </button>
          </div>
        </div>
      ) : null}

      {products.isLoading ? <Spinner /> : null}
      <DataTable headers={['قطعه', 'SKU', 'قیمت', 'موجودی (آزاد/رزرو)', 'وضعیت', 'آخرین تغییر', 'عملیات']}>
        {(products.data?.items ?? []).map((product) => (
          <tr key={product.id}>
            <td className="font-semibold">{String(product.part?.nameFa ?? 'قطعه')}</td>
            <td dir="ltr" className="text-xs">{String(product.sku ?? '—')}</td>
            <td className="tabular-nums">{formatToman(product.price)}</td>
            <td className="tabular-nums">
              {toFaDigits(product.stock)} / {toFaDigits(Number(product.reservedStock ?? 0))}
            </td>
            <td>
              <span className={`cp-chip ${product.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                {product.isActive ? 'نمایش‌داده می‌شود' : 'مخفی'}
              </span>
            </td>
            <td className="text-xs text-muted">{dateFa(String(product.updatedAt ?? ''), false)}</td>
            <td>
              {editing?.id === product.id ? (
                <div className="flex flex-wrap gap-1.5">
                  <input className="cp-field !w-24 !py-1 text-xs" inputMode="numeric" placeholder="قیمت" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/\D/g, '') })} />
                  <input className="cp-field !w-20 !py-1 text-xs" inputMode="numeric" placeholder="موجودی" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value.replace(/\D/g, '') })} />
                  <button type="button" className="cp-btn-primary !py-1 text-xs" disabled={saveEdits.isPending} onClick={() => saveEdits.mutate(product)}>
                    ذخیره
                  </button>
                  <button type="button" className="cp-btn-ghost !py-1 text-xs" onClick={() => setEditing(null)}>
                    انصراف
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className="cp-btn-ghost !py-1 text-xs" onClick={() => { setEditing(product); setDraft({ ...draft, price: String(product.price), stock: String(product.stock) }); }}>
                    ویرایش قیمت/موجودی
                  </button>
                  <button type="button" className="cp-btn-ghost !py-1 text-xs" disabled={toggleActive.isPending} onClick={() => toggleActive.mutate(product)}>
                    {product.isActive ? 'مخفی کردن' : 'نمایش'}
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
        {products.data?.items.length === 0 ? (
          <tr>
            <td colSpan={7} className="text-center text-xs text-muted">
              محصولی ثبت نشده است
            </td>
          </tr>
        ) : null}
      </DataTable>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="تعداد محصولات" value={toFaDigits(products.data?.meta.total ?? 0)} />
        <StatCard label="فعال" value={toFaDigits((products.data?.items ?? []).filter((p) => p.isActive).length)} />
      </section>
    </SellerLayout>
  );
}
