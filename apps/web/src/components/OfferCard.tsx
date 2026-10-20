import { useState } from 'react';
import type { SearchOffer } from '@carpart/api-client';
import { formatToman, toFaDigits } from '../lib/format';
import { StatusChip } from './ui';

const QUALITY_FA: Record<string, string> = {
  genuine: 'اصلی',
  aftermarket_high: 'aftermarket درجه یک',
  aftermarket_standard: 'aftermarket استاندارد',
  used: 'دست‌دوم',
};

const COMPAT_FA: Record<string, string> = {
  exact: 'سازگاری دقیق',
  likely: 'احتمال سازگاری',
  unknown: 'سازگاری نامشخص',
  incompatible: 'ناسازگار',
};

/** کارت پیشنهاد فروشنده با رتبه‌بندی شفاف — در جست‌وجوی عمومی و جزئیات قطعه مشترک است */
export function OfferCard({ offer, onBuy, onRequestQuote }: { offer: SearchOffer; onBuy?: (offer: SearchOffer) => void; onRequestQuote?: (offer: SearchOffer) => void }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="cp-card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold leading-6">{String(offer.part?.nameFa ?? 'قطعه')}</h3>
          <p className="text-xs text-muted">
            {offer.seller.name} · {offer.seller.branchName} · {offer.seller.city} · امتیاز {toFaDigits(offer.seller.rating ?? 0)}
          </p>
        </div>
        <div className="text-left">
          <b className="text-lg text-primary">{formatToman(offer.price)}</b>
          <p className="mt-0.5 text-[11px] text-muted">موجودی: {toFaDigits(offer.stock)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="cp-chip bg-slate-100 text-slate-700">{QUALITY_FA[offer.quality] ?? offer.quality}</span>
        <span
          className={`cp-chip ${
            offer.compatibility.level === 'exact'
              ? 'bg-emerald-100 text-emerald-800'
              : offer.compatibility.level === 'incompatible'
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-800'
          }`}
        >
          {COMPAT_FA[offer.compatibility.level] ?? offer.compatibility.level}
        </span>
        <span className="cp-chip bg-slate-100 text-slate-700">ارسال: {offer.deliveryFee > 0 ? `${formatToman(offer.deliveryFee)}` : 'رایگان'}</span>
        <span className="cp-chip bg-indigo-100 text-indigo-800">رتبه: {toFaDigits(Math.round(offer.rank.total))}</span>
        {offer.isFeatured ? <span className="cp-chip bg-amber-100 text-amber-800">ویژه</span> : null}
      </div>

      {offer.warnings.length ? (
        <ul className="space-y-1 rounded-xl bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
          {offer.warnings.map((warning) => (
            <li key={warning}>⚠️ {warning}</li>
          ))}
        </ul>
      ) : null}

      <button type="button" className="text-xs font-semibold text-primary" onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'بستن جزئیات رتبه‌بندی' : 'چرا این رتبه؟ (رتبه‌بندی شفاف)'}
      </button>
      {expanded ? (
        <ul className="space-y-1 rounded-xl bg-slate-50 p-2 text-[11px] leading-5">
          {offer.rank.factors.map((factor) => (
            <li key={factor.key} className="flex items-center justify-between gap-2">
              <span>
                {factor.fa} <span className="text-muted">(وزن {factor.weight})</span>
              </span>
              <b className="tabular-nums">{factor.contribution}</b>
            </li>
          ))}
          <li className="border-t border-line pt-1 text-[10px] text-muted">کمیسیون فروشنده هرگز در رتبه‌بندی اثر ندارد.</li>
        </ul>
      ) : null}

      {onBuy || onRequestQuote ? (
        <div className="grid grid-cols-2 gap-2">
          {onBuy ? (
            <button type="button" className="cp-btn-primary" disabled={offer.stock <= 0} onClick={() => onBuy(offer)}>
              {offer.stock > 0 ? 'خرید مستقیم' : 'ناموجود'}
            </button>
          ) : null}
          {onRequestQuote ? (
            <button type="button" className="cp-btn-ghost" onClick={() => onRequestQuote(offer)}>
              استعلام قیمت
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export { QUALITY_FA, COMPAT_FA, StatusChip };
