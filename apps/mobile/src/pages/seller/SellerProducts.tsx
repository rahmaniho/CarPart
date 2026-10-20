import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type SellerProductRow } from '@carpart/api-client';
import { api } from '../../lib/api';
import { formatToman, toFaDigits } from '../../lib/format';
import { ErrorBox, Field, Spinner } from '../../components/ui';
import { SellerShell } from './SellerShell';

/** محصولات و موجودی فروشنده — افزودن، قیمت/موجودی، مخفی/نمایش */
export default function SellerProducts(): JSX.Element {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SellerProductRow | null>(null);
  const [draft, setDraft] = useState({ partId: '', price: '', stock: '', sku: '', quality: 'aftermarket_high' });
  const [editDraft, setEditDraft] = useState({ price: '', stock: '' });

  const products = useQuery({ queryKey: ['seller-products'], queryFn: () => api.sellers.products({ pageSize: 50 }) });
  const parts = useQuery({ queryKey: ['catalog-parts'], queryFn: () => api.catalog.parts({ pageSize: 200 }) });

  const create = useMutation({
    mutationFn: () => {
      return api.sellers.createProduct({
        partId: draft.partId,
        price: Number(draft.price),
        stock: Number(draft.stock),
        sku: draft.sku || undefined,
        quality: draft.quality,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seller-products'] });
      setShowCreate(false);
      setDraft({ partId: '', price: '', stock: '', sku: '', quality: 'aftermarket_high' });
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت محصول ناموفق بود (حساب باید تأیید شده باشد)'),
  });

  const saveEdits = useMutation({
    mutationFn: async (product: SellerProductRow) => {
      const price = Number(editDraft.price);
      const stock = Number(editDraft.stock);
      if (Number.isFinite(price) && price > 0) await api.sellers.setPrice(product.id, price);
      if (Number.isFinite(stock) && stock >= 0) await api.sellers.setStock(product.id, { absoluteStock: stock, reason: 'adjustment' });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seller-products'] });
      setEditing(null);
      setError(null);
    },
    onError: () => setError('ذخیره تغییرات ناموفق بود'),
  });

  const toggleActive = useMutation({
    mutationFn: (product: SellerProductRow) => api.sellers.setActive(product.id, !product.isActive),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['seller-products'] }),
    onError: () => setError('تغییر وضعیت نمایش ناموفق بود'),
  });

  return (
    <SellerShell
      title="محصولات و موجودی"
      headerExtra={
        <button type="button" className="cp-btn-ghost !bg-white/15 !text-white" onClick={() => setShowCreate((value) => !value)}>
          + جدید
        </button>
      }
    >
      {error ? <ErrorBox message={error} /> : null}

      {showCreate ? (
        <div className="cp-card space-y-2">
          <Field label="قطعه از کاتالوگ">
            <select className="cp-field" value={draft.partId} onChange={(e) => setDraft({ ...draft, partId: e.target.value })}>
              <option value="">— انتخاب قطعه —</option>
              {(parts.data?.items ?? []).map((part) => <option key={String(part.id)} value={String(part.id)}>{String(part.nameFa ?? 'قطعه')}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="قیمت (تومان)">
              <input className="cp-field" inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="موجودی">
              <input className="cp-field" inputMode="numeric" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value.replace(/\D/g, '') })} />
            </Field>
          </div>
          <button
            type="button"
            className="cp-btn-primary w-full"
            disabled={create.isPending || !draft.partId || !draft.price || !draft.stock}
            onClick={() => create.mutate()}
          >
            ثبت محصول
          </button>
        </div>
      ) : null}

      {products.isLoading ? <Spinner /> : null}
      <div className="space-y-2">
        {(products.data?.items ?? []).map((product) => (
          <article key={product.id} className="cp-card space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <b className="text-sm">{String(product.part?.nameFa ?? 'قطعه')}</b>
                <p className="text-xs text-muted">{String(product.sku ?? '')}</p>
              </div>
              <span className={`cp-chip ${product.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                {product.isActive ? 'نمایش‌داده می‌شود' : 'مخفی'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <b className="text-primary">{formatToman(product.price)}</b>
              <span className="text-muted">
                موجودی: {toFaDigits(product.stock)} (رزرو: {toFaDigits(Number(product.reservedStock ?? 0))})
              </span>
            </div>
            {editing?.id === product.id ? (
              <div className="space-y-2 rounded-xl bg-slate-50 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <input className="cp-field !py-1.5 text-xs" inputMode="numeric" placeholder="قیمت جدید" value={editDraft.price} onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value.replace(/\D/g, '') })} />
                  <input className="cp-field !py-1.5 text-xs" inputMode="numeric" placeholder="موجودی جدید" value={editDraft.stock} onChange={(e) => setEditDraft({ ...editDraft, stock: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="cp-btn-primary !py-1.5 text-xs" disabled={saveEdits.isPending} onClick={() => saveEdits.mutate(product)}>
                    ذخیره
                  </button>
                  <button type="button" className="cp-btn-ghost !py-1.5 text-xs" onClick={() => setEditing(null)}>
                    انصراف
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="cp-btn-ghost !py-1.5 text-xs"
                  onClick={() => {
                    setEditing(product);
                    setEditDraft({ price: String(product.price), stock: String(product.stock) });
                  }}
                >
                  ویرایش قیمت/موجودی
                </button>
                <button type="button" className="cp-btn-ghost !py-1.5 text-xs" disabled={toggleActive.isPending} onClick={() => toggleActive.mutate(product)}>
                  {product.isActive ? 'مخفی کردن' : 'نمایش'}
                </button>
              </div>
            )}
          </article>
        ))}
        {products.data?.items.length === 0 ? <p className="cp-card text-center text-xs text-muted">محصولی ثبت نشده است.</p> : null}
      </div>
    </SellerShell>
  );
}
