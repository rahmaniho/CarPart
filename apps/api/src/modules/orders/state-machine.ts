import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ORDER_TRANSITIONS,
  findTransition,
  type Actor,
  type Transition,
} from '@carpart/contract';
import type { OrderStatus } from '@carpart/contract';
import { AppException, ErrorCodes } from '../../common/errors/app-error';
import { SystemSettingsService } from '../settings/system-settings.service';
import { Order } from './entities/order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Refund } from '../payments/entities/refund.entity';
import { Delivery } from '../delivery/entities/delivery.entity';
import type { RequestUser } from '../../common/types/auth';

export interface GuardContext {
  order: Order;
  actor: Actor;
  user?: RequestUser | null;
  reason?: string | null;
  meta?: Record<string, unknown>;
}

export type Guard = (context: GuardContext) => Promise<void>;

/**
 * ماشین وضعیت سفارش.
 *
 * همه تغییر وضعیت‌ها از اینجا عبور می‌کنند:
 * ۱) بررسی مجازبودن انتقال بر اساس جدول وضعیت‌ها و نقش انجام‌دهنده
 * ۲) اجرای گاردهای کسب‌وکاری (مانند تأیید پرداخت یا مالکیت فروشنده)
 * ۳) در صورت نامعتبر بودن، خطای ۴۰۹ با کد ماشین‌خوان و پیام فارسی
 */
@Injectable()
export class OrderStateMachine {
  private readonly guards: Record<string, Guard>;

  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Refund) private readonly refunds: Repository<Refund>,
    @InjectRepository(Delivery) private readonly deliveries: Repository<Delivery>,
    private readonly settings: SystemSettingsService,
    @Optional() @InjectRepository(Order) private readonly orders?: Repository<Order>,
  ) {
    this.guards = {
      orderPriced: async ({ order }) => {
        if (!order.payableTotal || order.payableTotal <= 0) {
          throw new AppException('مبلغ سفارش محاسبه نشده است؛ ابتدا اقلام و هزینه ارسال را نهایی کنید.', ErrorCodes.ORDER_NOT_EDITABLE, {
            statusCode: 409,
          });
        }
      },
      paymentVerified: async ({ order }) => {
        const paymentOrder = order.orderKind === 'child' && order.parentOrderId
          ? await this.orders?.findOne({ where: { id: order.parentOrderId } })
          : order;
        if (!paymentOrder) {
          throw new AppException('سفارش تجمیعی پرداخت یافت نشد.', ErrorCodes.ORDER_TRANSITION_FORBIDDEN, { statusCode: 409 });
        }
        const payment = await this.payments.findOne({
          where: { orderId: paymentOrder.id, status: 'SUCCESS' },
          order: { paidAt: 'DESC' },
        });
        if (!payment) {
          throw new AppException('پرداخت موفق تأییدشده‌ای برای این سفارش وجود ندارد.', ErrorCodes.ORDER_TRANSITION_FORBIDDEN, {
            statusCode: 409,
          });
        }
        if (Number(payment.amount) !== Number(paymentOrder.payableTotal)) {
          throw new AppException('مبلغ پرداخت‌شده با مبلغ سفارش مطابقت ندارد.', ErrorCodes.PAYMENT_AMOUNT_MISMATCH, {
            statusCode: 409,
          });
        }
      },
      sellerOwnsOrder: async ({ order, user }) => {
        if (!user || user.profileKind !== 'seller' || user.profileId !== order.sellerId) {
          throw new AppException('فقط فروشنده همین سفارش می‌تواند این تغییر وضعیت را انجام دهد.', ErrorCodes.PERMISSION_DENIED, {
            statusCode: 403,
          });
        }
      },
      courierOwnsDelivery: async ({ order, user }) => {
        if (!user) throw new AppException('کاربر شناسایی نشد.', ErrorCodes.UNAUTHENTICATED, { statusCode: 401 });
        const delivery = await this.deliveries.findOne({ where: { orderId: order.id } });
        if (!delivery || delivery.courierId !== user.profileId) {
          throw new AppException('فقط پیک تخصیص‌یافته به این مأموریت می‌تواند وضعیت را تغییر دهد.', ErrorCodes.PERMISSION_DENIED, {
            statusCode: 403,
          });
        }
      },
      startRefund: async ({ order }) => {
        if (!order.paidAt) return;
        const exists = await this.refunds.findOne({ where: { orderId: order.id, status: 'REQUESTED' } });
        if (exists) return;
        await this.refunds.save(
          this.refunds.create({
            paymentId: order.paymentId ?? '',
            orderId: order.id,
            userId: order.userId,
            amount: order.payableTotal,
            status: 'REQUESTED',
            reason: 'لغو سفارش پس از پرداخت',
            requestedAt: new Date(),
            requestedBy: order.userId,
          }),
        );
      },
      withinRefundWindow: async ({ order }) => {
        const days = await this.settings.getNumber('order.refund_window_days', 3);
        const base = order.deliveredAt ?? order.completedAt ?? order.updatedAt;
        if (!base) return;
        const deadline = new Date(new Date(base).getTime() + days * 86_400_000);
        if (Date.now() > deadline.getTime()) {
          throw new AppException(`مهلت درخواست بازپرداخت (${days} روز پس از تحویل) به پایان رسیده است.`, ErrorCodes.REFUND_WINDOW_CLOSED, {
            statusCode: 409,
          });
        }
      },
      withinDisputeWindow: async ({ order }) => {
        const days = await this.settings.getNumber('order.dispute_window_days', 7);
        const base = order.deliveredAt ?? order.completedAt ?? order.updatedAt;
        if (!base) return;
        const deadline = new Date(new Date(base).getTime() + days * 86_400_000);
        if (Date.now() > deadline.getTime()) {
          throw new AppException(`مهلت ثبت مغایرت (${days} روز) به پایان رسیده است.`, ErrorCodes.REFUND_WINDOW_CLOSED, {
            statusCode: 409,
          });
        }
      },
      refundApproved: async ({ order }) => {
        const refund = await this.refunds.findOne({
          where: { orderId: order.id },
          order: { createdAt: 'DESC' },
        });
        if (!refund) {
          throw new AppException('هیچ درخواست بازپرداختی برای این سفارش ثبت نشده است.', ErrorCodes.ORDER_TRANSITION_FORBIDDEN, {
            statusCode: 409,
          });
        }
        if (refund.status !== 'DONE') {
          throw new AppException('تا موفقیت قطعی درگاه، سفارش نباید بازپرداخت‌شده علامت بخورد.', ErrorCodes.ORDER_TRANSITION_FORBIDDEN, {
            statusCode: 409,
          });
        }
      },
      deliveryOtp: async ({ order }) => {
        const delivery = await this.deliveries.findOne({ where: { orderId: order.id } });
        if (!delivery || delivery.status !== 'DELIVERED') {
          throw new AppException('تحویل مأموریت با کد تأیید ثبت نشده است.', ErrorCodes.DELIVERY_OTP_INVALID, { statusCode: 409 });
        }
      },
    };
  }

  /** بررسی اینکه آیا این انتقال برای این انجام‌دهنده مجاز است یا خیر. */
  findTransition(from: OrderStatus, to: OrderStatus): Transition<OrderStatus> | undefined {
    return findTransition(ORDER_TRANSITIONS, from, to);
  }

  assertAllowed(from: OrderStatus, to: OrderStatus, actor: Actor): Transition<OrderStatus> {
    const transition = findTransition(ORDER_TRANSITIONS, from, to);
    if (!transition) {
      throw new AppException(
        `تغییر وضعیت از «${from}» به «${to}» در چرخه سفارش مجاز نیست.`,
        ErrorCodes.ORDER_TRANSITION_FORBIDDEN,
        { statusCode: 409, details: { from, to } },
      );
    }
    if (!transition.actors.includes(actor)) {
      throw new AppException(
        `شما اجازه تغییر وضعیت سفارش به «${to}» را ندارید.`,
        ErrorCodes.ORDER_TRANSITION_FORBIDDEN,
        { statusCode: 403, details: { from, to, allowedActors: transition.actors } },
      );
    }
    return transition;
  }

  /** اجرای گاردهای کسب‌وکاری یک انتقال. */
  async runGuards(transition: Transition<OrderStatus>, context: GuardContext): Promise<void> {
    if (!transition.guard) return;
    // گاردهای مالکیت فقط برای کنش‌های انسانی معنا دارند؛ فرایندهای داخلی سامانه
    // پیش از این مرحله مالکیت را بررسی کرده‌اند.
    const OWNERSHIP_GUARDS = ['sellerOwnsOrder', 'courierOwnsDelivery'];
    if (context.actor === 'system' && OWNERSHIP_GUARDS.includes(transition.guard)) return;
    const guard = this.guards[transition.guard];
    if (!guard) {
      throw new AppException(`گارد «${transition.guard}» پیاده‌سازی نشده است.`, ErrorCodes.INTERNAL_ERROR, { statusCode: 500 });
    }
    await guard(context);
  }

  /** انتقال‌های مجاز برای یک انجام‌دهنده (برای نمایش دکمه‌ها در رابط کاربری). */
  allowedActions(from: OrderStatus, actor: Actor): Array<{ to: OrderStatus; fa: string; requiresReason: boolean }> {
    return (ORDER_TRANSITIONS[from] ?? [])
      .filter((transition) => transition.actors.includes(actor))
      .map((transition) => ({ to: transition.to, fa: transition.fa, requiresReason: Boolean(transition.requiresReason) }));
  }
}
