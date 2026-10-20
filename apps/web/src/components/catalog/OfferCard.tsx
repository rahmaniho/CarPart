import {
  COMPATIBILITY_META,
  QUALITY_META,
  formatToman,
  toPersianDigits,
} from '@carpart/contract';
import { BarChart3, Clock, MapPin, ShieldAlert, ShoppingCart, Star, Store } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { OfferSearchItem } from '../../lib/types';
import { useCartStore } from '../../store/cart-store';
import { useToastStore } from '../../store/toast-store';
import { RankBreakdownModal, StatusFromMap } from '../ui/Primitives';

export function OfferCard({ offer }: { offer: OfferSearchItem }) {
  const addItem = useCartStore((s) => s.addItem);
  const pushToast = useToastStore((s) => s.push);
  const [rankOpen, setRankOpen] = useState(false);
  const [conflictSeller, setConflictSeller] = useState<string | null>(null);

  const handleAdd = (replace = false) => {
    const res = addItem(
      {
        sellerProductId: offer.sellerProductId,
        partId: offer.part.id,
        partNameFa: offer.part.nameFa,
        sku: offer.sku,
        sellerId: offer.seller.id,
        sellerName: offer.seller.name,
        branchName: offer.branch.name,
        unitPrice: offer.price,
        quantity: 1,
        maxStock: offer.stock,
        quality: offer.quality,
        estimatedDeliveryFee: offer.deliveryFee,
      },
      replace,
    );

    if (!res.ok) {
      setConflictSeller(res.conflictSellerName);
      return;
    }

    setConflictSeller(null);
    pushToast({
      tone: 'success',
      title: 'به سبد خرید اضافه شد',
      detail: `${offer.part.nameFa} — فروشگاه ${offer.seller.name}`,
    });
  };

  return (
    <div className="cp-card flex flex-col justify-between p-4 transition hover:border-brand-300">
      <div className="space-y-3">
        {/* ردیف وضعیت سازگاری و امتیاز رتبه */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusFromMap value={offer.compatibility.level} map={COMPATIBILITY_META} size="xs" />
            <StatusFromMap value={offer.quality} map={QUALITY_META} size="xs" />
          </div>

          <button
            type="button"
            onClick={() => setRankOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
          >
            <BarChart3 className="h-3.5 w-3.5 text-brand-600" />
            <span>رتبه شفاف: {toPersianDigits(Math.round(offer.rank.total))}</span>
          </button>
        </div>

        {/* عنوان قطعه و کد فنی */}
        <div>
          <Link to={`/parts/${offer.part.id}`} className="text-base font-bold text-slate-900 hover:text-brand-700">
            {offer.part.nameFa}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {offer.part.brand && <span>برند: {offer.part.brand.nameFa}</span>}
            {offer.part.technicalCode && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] ltr-num">
                {offer.part.technicalCode}
              </span>
            )}
            {offer.stock > 0 ? (
              <span className="text-emerald-700 font-semibold">موجودی: {toPersianDigits(offer.stock)} عدد</span>
            ) : (
              <span className="text-rose-600 font-semibold">ناموجود</span>
            )}
          </div>
        </div>

        {/* اطلاعات فروشنده و شعبه */}
        <div className="rounded-lg bg-slate-50 p-2.5 text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Link
              to={`/sellers/${offer.seller.id}`}
              className="inline-flex items-center gap-1.5 font-bold text-slate-800 hover:text-brand-700"
            >
              <Store className="h-3.5 w-3.5 text-brand-600" />
              <span>{offer.seller.name}</span>
              {offer.branch?.name && <span className="font-normal text-slate-500">({offer.branch.name})</span>}
            </Link>
            {offer.seller.rating ? (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                {toPersianDigits(offer.seller.rating.toFixed(1))}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              آماده‌سازی: {toPersianDigits(offer.preparationMinutes)} دقیقه
            </span>
            {offer.estimatedDeliveryMinutes !== null && (
              <span>
                ارسال تقریبی: ~{toPersianDigits(offer.estimatedDeliveryMinutes)} دقیقه
                {offer.routeSource === 'estimation' ? ' (تخمینی)' : ''}
              </span>
            )}
            {offer.distanceKm !== null && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {toPersianDigits(offer.distanceKm.toFixed(1))} کیلومتر
              </span>
            )}
          </div>
        </div>

        {/* هشدارهای شفاف */}
        {offer.warnings && offer.warnings.length > 0 && (
          <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-[11px] text-amber-900">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>{offer.warnings[0]}</span>
          </div>
        )}
      </div>

      {/* قیمت و دکمه خرید */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            {offer.listPrice && offer.listPrice > offer.price && (
              <span className="block text-xs text-slate-400 line-through">{formatToman(offer.listPrice)}</span>
            )}
            <span className="text-lg font-extrabold text-slate-900">{formatToman(offer.price)}</span>
            <span className="block text-[11px] text-slate-500">
              ارسال تخمینی: {formatToman(offer.deliveryFee)}
            </span>
          </div>

          <button
            type="button"
            disabled={offer.stock <= 0}
            onClick={() => handleAdd(false)}
            className="cp-btn-primary text-xs py-2 px-3"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>{offer.stock > 0 ? 'افزودن به سبد' : 'ناموجود'}</span>
          </button>
        </div>

        {conflictSeller && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950 space-y-2">
            <p>
              سبد فعلی شما شامل کالای فروشگاه «<strong>{conflictSeller}</strong>» است. در این نسخه هر سفارش از یک فروشگاه
              تأمین می‌شود. آیا سبد قبلی جایگزین شود؟
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleAdd(true)} className="cp-btn-accent text-xs py-1 px-2.5">
                بله، جایگزین شود
              </button>
              <button
                type="button"
                onClick={() => setConflictSeller(null)}
                className="cp-btn-secondary text-xs py-1 px-2.5"
              >
                انصراف
              </button>
            </div>
          </div>
        )}
      </div>

      <RankBreakdownModal
        open={rankOpen}
        onClose={() => setRankOpen(false)}
        sellerName={offer.seller.name}
        rank={offer.rank}
        warnings={offer.warnings}
      />
    </div>
  );
}
