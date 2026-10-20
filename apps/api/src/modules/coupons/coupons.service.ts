import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { percentOf } from '@carpart/contract';
import type { Role } from '@carpart/contract';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { Coupon } from './entities/coupon.entity';
import { CouponRedemption } from './entities/coupon-redemption.entity';
import { CreateCouponDto } from './dto/coupon.dto';

export interface CouponValidation {
  coupon: Coupon;
  discount: number;
  message: string;
}

/** مدیریت کوپن‌های تخفیف و اعمال آن‌ها روی مبلغ سفارش. */
@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon) private readonly coupons: Repository<Coupon>,
    @InjectRepository(CouponRedemption) private readonly redemptions: Repository<CouponRedemption>,
  ) {}

  /** اعتبارسنجی کوپن و محاسبه تخفیف (بدون ثبت استفاده). */
  async validate(
    code: string,
    userId: string,
    itemsSubtotal: number,
    options: { roles?: Role[]; city?: string | null } = {},
  ): Promise<CouponValidation> {
    const normalized = code.trim().toUpperCase();
    const coupon = await this.coupons.findOne({ where: { code: normalized } });
    if (!coupon || !coupon.isActive) {
      throw new AppException('کد تخفیف معتبر نیست.', ErrorCodes.COUPON_INVALID, { statusCode: 400 });
    }
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new AppException('این کد تخفیف هنوز فعال نشده است.', ErrorCodes.COUPON_EXPIRED, { statusCode: 400 });
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      throw new AppException('مهلت این کد تخفیف به پایان رسیده است.', ErrorCodes.COUPON_EXPIRED, { statusCode: 400 });
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new AppException('ظرفیت این کد تخفیف تکمیل شده است.', ErrorCodes.COUPON_LIMIT_REACHED, { statusCode: 400 });
    }
    if (coupon.minOrderAmount !== null && itemsSubtotal < coupon.minOrderAmount) {
      throw new AppException(
        `حداقل مبلغ سفارش برای این کد ${coupon.minOrderAmount.toLocaleString('fa-IR')} تومان است.`,
        ErrorCodes.COUPON_MIN_NOT_MET,
        { statusCode: 400 },
      );
    }
    if (coupon.audienceRoles?.length && options.roles?.length && !options.roles.some((role) => coupon.audienceRoles!.includes(role))) {
      throw new AppException('این کد تخفیف برای نقش کاربری شما فعال نیست.', ErrorCodes.COUPON_INVALID, { statusCode: 400 });
    }
    if (coupon.city && options.city && coupon.city !== options.city) {
      throw new AppException(`این کد تخفیف فقط برای شهر ${coupon.city} معتبر است.`, ErrorCodes.COUPON_INVALID, { statusCode: 400 });
    }
    if (coupon.perUserLimit !== null) {
      const used = await this.redemptions.count({ where: { couponId: coupon.id, userId, status: 'applied' } });
      if (used >= coupon.perUserLimit) {
        throw new AppException('سهمیه استفاده شما از این کد تکمیل شده است.', ErrorCodes.COUPON_LIMIT_REACHED, { statusCode: 400 });
      }
    }

    const discount =
      coupon.type === 'percent'
        ? Math.min(percentOf(itemsSubtotal, Number(coupon.value)), coupon.maxDiscount ?? Number.MAX_SAFE_INTEGER)
        : Math.min(Number(coupon.value), itemsSubtotal);

    return {
      coupon,
      discount: Math.max(0, Math.trunc(discount)),
      message:
        coupon.type === 'percent'
          ? `${Number(coupon.value).toLocaleString('fa-IR')}٪ تخفیف روی مبلغ اقلام`
          : `${Number(coupon.value).toLocaleString('fa-IR')} تومان تخفیف`,
    };
  }

  /** ثبت استفاده از کوپن برای یک سفارش (پس از ایجاد سفارش). */
  async redeem(couponId: string, userId: string, orderId: string, discountAmount: number): Promise<CouponRedemption> {
    const existing = await this.redemptions.findOne({ where: { couponId, orderId } });
    if (existing) return existing;
    await this.coupons.increment({ id: couponId }, 'usedCount', 1);
    return this.redemptions.save(
      this.redemptions.create({ couponId, userId, orderId, discountAmount, status: 'applied' }),
    );
  }

  /** بازگرداندن کوپن هنگام لغو سفارش. */
  async reverse(orderId: string): Promise<number> {
    const rows = await this.redemptions.find({ where: { orderId, status: 'applied' } });
    for (const row of rows) {
      row.status = 'reversed';
      row.reversedAt = new Date();
      await this.redemptions.save(row);
      await this.coupons.decrement({ id: row.couponId }, 'usedCount', 1);
    }
    return rows.length;
  }

  async list(query: { page?: number; pageSize?: number; isActive?: boolean } = {}): Promise<PageResult<Coupon>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where = query.isActive === undefined ? {} : { isActive: query.isActive };
    const [items, total] = await this.coupons.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async create(dto: CreateCouponDto, actorId: string): Promise<Coupon> {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.coupons.findOne({ where: { code } });
    if (exists) throw new AppException('کوپنی با این کد پیش‌تر ثبت شده است.', ErrorCodes.CONFLICT, { statusCode: 409 });
    return this.coupons.save(
      this.coupons.create({
        code,
        type: dto.type,
        value: dto.value,
        maxDiscount: dto.maxDiscount ?? null,
        minOrderAmount: dto.minOrderAmount ?? null,
        usageLimit: dto.usageLimit ?? null,
        usedCount: 0,
        perUserLimit: dto.perUserLimit ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: dto.isActive ?? true,
        audienceRoles: dto.audienceRoles ?? null,
        city: dto.city ?? null,
        description: dto.description ?? null,
        createdBy: actorId,
      }),
    );
  }

  async update(id: string, dto: Partial<CreateCouponDto>): Promise<Coupon> {
    const coupon = await this.coupons.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('کوپن');
    Object.assign(coupon, {
      type: dto.type ?? coupon.type,
      value: dto.value ?? coupon.value,
      maxDiscount: dto.maxDiscount ?? coupon.maxDiscount,
      minOrderAmount: dto.minOrderAmount ?? coupon.minOrderAmount,
      usageLimit: dto.usageLimit ?? coupon.usageLimit,
      perUserLimit: dto.perUserLimit ?? coupon.perUserLimit,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : coupon.startsAt,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : coupon.endsAt,
      isActive: dto.isActive ?? coupon.isActive,
      audienceRoles: dto.audienceRoles ?? coupon.audienceRoles,
      city: dto.city ?? coupon.city,
      description: dto.description ?? coupon.description,
    });
    return this.coupons.save(coupon);
  }

  async deactivate(id: string): Promise<Coupon> {
    return this.update(id, { isActive: false });
  }
}
