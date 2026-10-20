import { Injectable } from '@nestjs/common';
import type { CompatibilityLevel, RankExplanation, RankFactor } from '@carpart/contract';
import { SystemSettingsService } from '../settings/system-settings.service';

export type RankWeightKey =
  | 'compatibility'
  | 'price'
  | 'deliveryFee'
  | 'preparation'
  | 'eta'
  | 'distance'
  | 'sellerRating'
  | 'reliability';

export const DEFAULT_WEIGHTS: Record<RankWeightKey, number> = {
  compatibility: 25,
  price: 22,
  deliveryFee: 8,
  preparation: 10,
  eta: 10,
  distance: 8,
  sellerRating: 12,
  reliability: 5,
};

export const WEIGHT_LABELS_FA: Record<RankWeightKey, string> = {
  compatibility: 'سازگاری با خودرو',
  price: 'قیمت قطعه',
  deliveryFee: 'هزینه ارسال',
  preparation: 'زمان آماده‌سازی',
  eta: 'زمان تخمینی تحویل',
  distance: 'فاصله فروشگاه',
  sellerRating: 'امتیاز فروشنده',
  reliability: 'سابقه لغو و مغایرت',
};

export interface OfferRankInput {
  sellerProductId: string;
  compatibility: CompatibilityLevel;
  price: number;
  deliveryFee: number;
  preparationMinutes: number;
  etaMinutes: number | null;
  distanceKm: number | null;
  sellerRating: number;
  sellerRatingCount: number;
  cancellationRate: number;
  mismatchRate: number;
  stock: number;
  isFeatured?: boolean;
}

export interface RankedOffer {
  sellerProductId: string;
  total: number;
  explanation: RankExplanation;
  warnings: string[];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** امتیاز اطمینان‌دار برای فروشنده‌هایی با تعداد نظر کم (shrinkage به سمت میانگین سامانه). */
function confidentRating(rating: number, count: number, prior = 3.8, priorWeight = 12): number {
  const total = count + priorWeight;
  return total > 0 ? (rating * count + prior * priorWeight) / total : prior;
}

/**
 * موتور رتبه‌بندی پیشنهادها.
 *
 * اصول:
 * ۱) وزن‌ها از تنظیمات سامانه خوانده می‌شوند (قابل تغییر توسط مدیر) و به ۱۰۰ نرمال می‌گردند.
 * ۲) امتیاز هر عامل همراه با وزن و سهم آن بازگردانده می‌شود تا رتبه‌بندی شفاف و قابل توضیح باشد.
 * ۳) سازگاری نامشخص هرگز به‌عنوان سازگاری قطعی امتیاز کامل نمی‌گیرد و هشدار شفاف تولید می‌کند.
 * ۴) کارمزد فروشنده هیچ اثر پنهانی بر رتبه ندارد؛ تنها «جایگاه ویژه» (در صورت فعال‌سازی)
 *    با امتیاز افزوده و اعلام عمومی (نمایش در explanation) اعمال می‌شود.
 */
@Injectable()
export class RankingService {
  constructor(private readonly settings: SystemSettingsService) {}

  async getWeights(): Promise<Record<RankWeightKey, number>> {
    const stored = await this.settings.getJson<Partial<Record<RankWeightKey, number>>>('ranking.weights', {});
    const merged = { ...DEFAULT_WEIGHTS, ...stored } as Record<RankWeightKey, number>;
    const total = Object.values(merged).reduce((acc, value) => acc + (Number.isFinite(value) ? Math.max(0, value) : 0), 0);
    if (total <= 0) return DEFAULT_WEIGHTS;
    const normalized = {} as Record<RankWeightKey, number>;
    (Object.keys(merged) as RankWeightKey[]).forEach((key) => {
      normalized[key] = Math.round((Math.max(0, merged[key]) / total) * 1000) / 10;
    });
    return normalized;
  }

  async rankOffers(offers: OfferRankInput[], options: { maxDistanceKm?: number; featuredBoost?: number } = {}): Promise<RankedOffer[]> {
    if (!offers.length) return [];
    const weights = await this.getWeights();
    const featuredBoost = options.featuredBoost ?? (await this.settings.getNumber('ranking.featured_boost', 0));
    const maxDistance = options.maxDistanceKm ?? Math.max(10, ...offers.map((o) => o.distanceKm ?? 0));

    const minPrice = Math.min(...offers.map((o) => o.price));
    const maxPrice = Math.max(...offers.map((o) => o.price));
    const minFee = Math.min(...offers.map((o) => o.deliveryFee));
    const maxFee = Math.max(...offers.map((o) => o.deliveryFee));
    const minEta = Math.min(...offers.map((o) => o.etaMinutes ?? Number.MAX_SAFE_INTEGER));
    const maxEta = Math.max(...offers.map((o) => o.etaMinutes ?? 0), 1);

    return offers.map((offer) => {
      const warnings: string[] = [];
      const factors: RankFactor[] = [];

      const compatibilityScore =
        offer.compatibility === 'exact' ? 1 : offer.compatibility === 'likely' ? 0.6 : offer.compatibility === 'unknown' ? 0.35 : 0;
      if (offer.compatibility === 'unknown') warnings.push('سازگاری این قطعه با خودروی شما تأیید نشده است.');
      if (offer.compatibility === 'likely') warnings.push('سازگاری احتمالی است؛ پیش از خرید نهایی با فروشنده هماهنگ کنید.');
      if (offer.compatibility === 'incompatible') warnings.push('این قطعه با خودروی انتخابی ناسازگار گزارش شده است.');
      factors.push(this.factor('compatibility', weights, compatibilityScore));

      const priceScore = offer.stock > 0 ? (maxPrice === minPrice ? 1 : 1 - (offer.price - minPrice) / (maxPrice - minPrice)) : 0;
      factors.push(this.factor('price', weights, priceScore, `کمترین قیمت در نتایج: ${minPrice.toLocaleString('fa-IR')} تومان`));

      const feeScore = maxFee === minFee ? 1 : 1 - (offer.deliveryFee - minFee) / (maxFee - minFee);
      factors.push(this.factor('deliveryFee', weights, feeScore));

      const prepScore = clamp01(1 - offer.preparationMinutes / 180);
      factors.push(this.factor('preparation', weights, prepScore, `آماده‌سازی: ${offer.preparationMinutes} دقیقه`));

      const eta = offer.etaMinutes ?? null;
      const etaScore = eta === null ? 0.3 : maxEta === minEta ? 1 : clamp01(1 - (eta - minEta) / Math.max(1, maxEta - minEta));
      factors.push(this.factor('eta', weights, etaScore, eta === null ? 'زمان تحویل تخمین زده نشد' : `تخمین تحویل: ${eta} دقیقه`));

      const distanceScore = offer.distanceKm === null ? 0.4 : clamp01(1 - offer.distanceKm / maxDistance);
      factors.push(this.factor('distance', weights, distanceScore, offer.distanceKm === null ? 'فاصله نامشخص' : `${offer.distanceKm} کیلومتر`));

      const ratingScore = clamp01(confidentRating(offer.sellerRating, offer.sellerRatingCount) / 5);
      factors.push(
        this.factor(
          'sellerRating',
          weights,
          ratingScore,
          offer.sellerRatingCount
            ? `${offer.sellerRating.toFixed(1)} از ${offer.sellerRatingCount} نظر`
            : 'فروشنده هنوز نظری دریافت نکرده است',
        ),
      );

      const reliabilityScore = clamp01(1 - (offer.cancellationRate * 1.5 + offer.mismatchRate * 2));
      factors.push(
        this.factor('reliability', weights, reliabilityScore, offer.cancellationRate > 0.1 ? 'سابقه لغو بالاتر از میانگین' : undefined),
      );

      let total = factors.reduce((acc, factor) => acc + factor.contribution, 0);

      if (offer.stock <= 0) {
        total = 0;
        warnings.push('این پیشنهاد در حال حاضر موجودی ندارد.');
      }
      if (offer.isFeatured && featuredBoost > 0) {
        total += featuredBoost;
        factors.push({
          key: 'featured',
          fa: 'جایگاه ویژه (تبلیغ پرداخت‌شده)',
          weight: featuredBoost,
          score: 1,
          contribution: featuredBoost,
          note: 'این امتیاز به دلیل خرید جایگاه ویژه اضافه شده و به‌صورت شفاف اعلام می‌شود.',
        });
      }

      return {
        sellerProductId: offer.sellerProductId,
        total: Math.round(total * 10) / 10,
        warnings,
        explanation: {
          total: Math.round(total * 10) / 10,
          factors,
          compatibility: offer.compatibility,
          transparent: true as const,
        },
      };
    });
  }

  private factor(key: RankWeightKey, weights: Record<RankWeightKey, number>, score: number, note?: string): RankFactor {
    const weight = weights[key] ?? 0;
    const clamped = clamp01(score);
    return {
      key,
      fa: WEIGHT_LABELS_FA[key],
      weight,
      score: Math.round(clamped * 100) / 100,
      contribution: Math.round(clamped * weight * 10) / 10,
      note,
    };
  }
}
