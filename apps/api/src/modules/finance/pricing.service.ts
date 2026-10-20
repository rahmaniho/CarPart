import { Injectable } from '@nestjs/common';
import type { MoneyBreakdown } from '@carpart/contract';
import { percentOf, roundToman, sum } from '@carpart/contract';
import { SystemSettingsService } from '../settings/system-settings.service';

export interface DeliveryFeeInput {
  distanceKm: number | null;
  urgency?: 'normal' | 'urgent' | 'critical';
  itemsTotal?: number;
}

export interface DeliveryFeeResult {
  total: number;
  baseFee: number;
  distanceFee: number;
  urgencyMultiplier: number;
  freeDeliveryApplied: boolean;
  distanceKm: number | null;
  /** شرح شفاف محاسبه برای نمایش به کاربر پیش از پرداخت */
  breakdown: Array<{ fa: string; amount: number }>;
}

export interface CommissionInput {
  itemsTotal: number;
  discountTotal: number;
  deliveryFee: number;
  ratePercent: number;
  courierSharePercent: number;
}

export interface CommissionResult {
  commissionBase: number;
  ratePercent: number;
  platformAmount: number;
  sellerNetAmount: number;
  courierAmount: number;
  deliveryPlatformAmount: number;
  calculation: Record<string, unknown>;
}

/**
 * سرویس قیمت‌گذاری — همه قواعد مالی از تنظیمات سامانه خوانده می‌شوند.
 *
 * نکته مهم: کارمزد پلتفرم از سهم فروشنده کسر می‌شود و به مبلغ پرداختی مشتری اضافه نمی‌گردد؛
 * بنابراین payable = اقلام + ارسال - تخفیف است.
 */
@Injectable()
export class PricingService {
  constructor(private readonly settings: SystemSettingsService) {}

  async commissionRatePercent(sellerOverride?: number | null): Promise<number> {
    if (typeof sellerOverride === 'number' && sellerOverride >= 0) return sellerOverride;
    return this.settings.getNumber('finance.commission.percent', 7);
  }

  async estimateDeliveryFee(input: DeliveryFeeInput): Promise<DeliveryFeeResult> {
    const baseFee = roundToman(await this.settings.getNumber('finance.delivery.base_fee', 25_000));
    const perKm = roundToman(await this.settings.getNumber('finance.delivery.per_km_fee', 6_000));
    const multipliers = await this.settings.getJson<Record<string, number>>('finance.delivery.urgency_multiplier', {
      normal: 1,
      urgent: 1.25,
      critical: 1.5,
    });
    const freeOver = roundToman(await this.settings.getNumber('finance.delivery.free_over_amount', 0));

    const urgency = input.urgency ?? 'normal';
    const multiplier = Number(multipliers[urgency] ?? 1) || 1;
    const distanceKm = input.distanceKm === null || input.distanceKm === undefined ? null : Math.max(0, Math.round(input.distanceKm * 100) / 100);
    const distanceFee = distanceKm === null ? 0 : roundToman(distanceKm * perKm);
    const rawTotal = roundToman((baseFee + distanceFee) * multiplier);
    const freeDeliveryApplied = freeOver > 0 && (input.itemsTotal ?? 0) >= freeOver;
    const total = freeDeliveryApplied ? 0 : rawTotal;

    const breakdown: Array<{ fa: string; amount: number }> = [
      { fa: 'هزینه پایه ارسال', amount: roundToman(baseFee * multiplier) },
    ];
    if (distanceKm !== null && distanceFee > 0) {
      breakdown.push({ fa: `هزینه مسافت (${distanceKm.toLocaleString('fa-IR')} کیلومتر)`, amount: roundToman(distanceFee * multiplier) });
    }
    if (multiplier !== 1) {
      breakdown.push({ fa: `ضریب فوریت (${multiplier.toLocaleString('fa-IR')})`, amount: rawTotal - roundToman((baseFee + distanceFee)) });
    }
    if (freeDeliveryApplied) {
      breakdown.push({ fa: 'ارسال رایگان (سفارش بالای حد تعیین‌شده)', amount: -rawTotal });
    }

    return { total, baseFee, distanceFee, urgencyMultiplier: multiplier, freeDeliveryApplied, distanceKm, breakdown };
  }

  /** محاسبه کارمزد و تسهیم مالی یک سفارش — همه مقادیر عدد صحیح تومان. */
  async calculateCommission(input: CommissionInput): Promise<CommissionResult> {
    const commissionBase = Math.max(0, roundToman(input.itemsTotal - input.discountTotal));
    const minCommission = roundToman(await this.settings.getNumber('finance.commission.min_amount', 0));
    const platformAmount = Math.max(minCommission, percentOf(commissionBase, input.ratePercent));
    const sellerNetAmount = Math.max(0, commissionBase - platformAmount);
    const courierAmount = percentOf(Math.max(0, input.deliveryFee), input.courierSharePercent);
    const deliveryPlatformAmount = Math.max(0, roundToman(input.deliveryFee) - courierAmount);

    return {
      commissionBase,
      ratePercent: input.ratePercent,
      platformAmount,
      sellerNetAmount,
      courierAmount,
      deliveryPlatformAmount,
      calculation: {
        formula: 'commissionBase = itemsTotal - discountTotal; platformAmount = max(minCommission, commissionBase * ratePercent / 100)',
        itemsTotal: input.itemsTotal,
        discountTotal: input.discountTotal,
        commissionBase,
        ratePercent: input.ratePercent,
        minCommission,
        platformAmount,
        sellerNetAmount,
        deliveryFee: input.deliveryFee,
        courierSharePercent: input.courierSharePercent,
        courierAmount,
        deliveryPlatformAmount,
        computedAt: new Date().toISOString(),
      },
    };
  }

  /** تجزیه مبلغ قابل پرداخت مشتری. */
  payableBreakdown(input: { itemsSubtotal: number; deliveryFee: number; discountTotal: number; platformFee?: number }): MoneyBreakdown {
    const itemsSubtotal = roundToman(input.itemsSubtotal);
    const deliveryFee = roundToman(input.deliveryFee);
    const discountTotal = Math.min(roundToman(input.discountTotal), itemsSubtotal + deliveryFee);
    const payable = Math.max(0, sum(itemsSubtotal, deliveryFee, -discountTotal));
    return {
      itemsTotal: itemsSubtotal,
      deliveryFee,
      discountTotal,
      platformFee: roundToman(input.platformFee ?? 0),
      payable,
      currency: 'IRT',
      unit: 'toman',
    };
  }

  async courierSharePercent(): Promise<number> {
    return this.settings.getNumber('finance.courier.share_percent', 85);
  }
}
