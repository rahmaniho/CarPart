import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import type { RequestUser } from '../../common/types/auth';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { Delivery } from '../delivery/entities/delivery.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/entities/order.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { Review } from './entities/review.entity';
import { CreateReviewDto, ModerateReviewDto } from './dto/review.dto';

export interface ReviewStats {
  targetType: 'seller' | 'courier';
  targetId: string;
  count: number;
  average: number;
  issueRate: number;
  distribution: Record<string, number>;
}

/** بازخورد کاربران درباره فروشنده و پیک — مبنای واقعی شاخص اعتبار در رتبه‌بندی. */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Delivery) private readonly deliveries: Repository<Delivery>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: RequestUser, dto: CreateReviewDto): Promise<Review> {
    const order = await this.orders.findOne({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('سفارش');
    if (order.userId !== user.id) {
      throw new AppException('فقط خریدار سفارش می‌تواند بازخورد ثبت کند.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    if (!['DELIVERED', 'COMPLETED'].includes(order.status)) {
      throw new AppException('بازخورد فقط پس از تحویل سفارش قابل ثبت است.', ErrorCodes.ORDER_TRANSITION_FORBIDDEN, { statusCode: 409 });
    }

    let targetId: string;
    if (dto.targetType === 'seller') {
      targetId = order.sellerId;
    } else {
      const delivery = await this.deliveries.findOne({ where: { orderId: order.id } });
      if (!delivery?.courierId) {
        throw new AppException('پیکی برای این سفارش ثبت نشده است.', ErrorCodes.NOT_FOUND, { statusCode: 404 });
      }
      targetId = delivery.courierId;
    }

    const existing = await this.reviews.findOne({ where: { orderId: order.id, authorId: user.id, targetType: dto.targetType } });
    if (existing) {
      throw new AppException('برای این سفارش پیش‌تر بازخورد ثبت کرده‌اید.', ErrorCodes.CONFLICT, { statusCode: 409 });
    }

    const review = await this.reviews.save(
      this.reviews.create({
        orderId: order.id,
        authorId: user.id,
        targetType: dto.targetType,
        targetId,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
        hadIssue: dto.hadIssue ?? dto.rating <= 2,
        isPublished: true,
        moderationNote: null,
      }),
    );
    await this.recalculate(dto.targetType, targetId);

    if (dto.targetType === 'seller') {
      const seller = await this.sellers.findOne({ where: { id: targetId } });
      if (seller) {
        await this.notifications
          .notify({
            userId: seller.userId,
            eventKey: 'order.completed',
            subjectId: review.id,
            vars: { code: order.code, orderId: order.id },
            dedupeKey: `review.received:${review.id}`,
          })
          .catch(() => undefined);
      }
    }
    return review;
  }

  /** محاسبه دوباره میانگین امتیاز از همه بازخوردهای منتشرشده. */
  async recalculate(targetType: 'seller' | 'courier', targetId: string): Promise<void> {
    const rows = await this.reviews.find({ where: { targetType, targetId, isPublished: true } });
    const count = rows.length;
    const average = count ? Math.round((rows.reduce((acc, row) => acc + row.rating, 0) / count) * 100) / 100 : 0;
    if (targetType === 'seller') {
      const seller = await this.sellers.findOne({ where: { id: targetId } });
      if (seller) {
        seller.ratingAvg = average;
        seller.ratingCount = count;
        await this.sellers.save(seller);
      }
      return;
    }
    const courier = await this.couriers.findOne({ where: { id: targetId } });
    if (courier) {
      courier.ratingAvg = average;
      courier.ratingCount = count;
      await this.couriers.save(courier);
    }
  }

  async stats(targetType: 'seller' | 'courier', targetId: string): Promise<ReviewStats> {
    const rows = await this.reviews.find({ where: { targetType, targetId, isPublished: true } });
    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const row of rows) distribution[String(row.rating)] = (distribution[String(row.rating)] ?? 0) + 1;
    const issues = rows.filter((row) => row.hadIssue).length;
    return {
      targetType,
      targetId,
      count: rows.length,
      average: rows.length ? Math.round((rows.reduce((acc, row) => acc + row.rating, 0) / rows.length) * 100) / 100 : 0,
      issueRate: rows.length ? issues / rows.length : 0,
      distribution,
    };
  }

  async listForTarget(
    targetType: 'seller' | 'courier',
    targetId: string,
    query: { page?: number; pageSize?: number } = {},
  ): Promise<PageResult<Review>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const [items, total] = await this.reviews.findAndCount({
      where: { targetType, targetId, isPublished: true },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async listMine(userId: string, query: { page?: number; pageSize?: number } = {}): Promise<PageResult<Review>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const [items, total] = await this.reviews.findAndCount({ where: { authorId: userId }, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async listAll(query: { page?: number; pageSize?: number; published?: boolean } = {}): Promise<PageResult<Review>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where = query.published === undefined ? {} : { isPublished: query.published };
    const [items, total] = await this.reviews.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async moderate(reviewId: string, dto: ModerateReviewDto): Promise<Review> {
    const review = await this.reviews.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('بازخورد');
    if (dto.isPublished !== undefined) review.isPublished = dto.isPublished;
    if (dto.moderationNote !== undefined) review.moderationNote = dto.moderationNote;
    const saved = await this.reviews.save(review);
    await this.recalculate(saved.targetType, saved.targetId);
    return saved;
  }
}
