import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { ReturnStatus, TicketStatus } from '@carpart/contract';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { shortCode } from '../../common/utils/id';
import type { RequestUser } from '../../common/types/auth';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { SellerProductsService } from '../sellers/seller-products.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { User } from '../users/entities/user.entity';
import { ReturnRequest } from './entities/return-request.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import {
  AssignTicketDto,
  CreateReturnDto,
  CreateTicketDto,
  ReplyTicketDto,
  ResolveReturnDto,
  RespondReturnDto,
} from './dto/support.dto';

/** پشتیبانی: تیکت‌ها و درخواست‌های مرجوعی/مغایرت. */
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @InjectRepository(SupportTicket) private readonly tickets: Repository<SupportTicket>,
    @InjectRepository(TicketMessage) private readonly messages: Repository<TicketMessage>,
    @InjectRepository(ReturnRequest) private readonly returns: Repository<ReturnRequest>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly ordersService: OrdersService,
    private readonly sellerProducts: SellerProductsService,
    private readonly notifications: NotificationsService,
    private readonly settings: SystemSettingsService,
  ) {}

  /* -------------------------------- تیکت -------------------------------- */

  async createTicket(user: RequestUser, dto: CreateTicketDto): Promise<SupportTicket> {
    if (dto.orderId) {
      const order = await this.orders.findOne({ where: { id: dto.orderId } });
      if (!order || order.userId !== user.id) throw new NotFoundException('سفارش');
    }
    const ticket = await this.tickets.save(
      this.tickets.create({
        code: shortCode(6, 'TKT'),
        userId: user.id,
        orderId: dto.orderId ?? null,
        deliveryId: dto.deliveryId ?? null,
        subject: dto.subject.trim(),
        category: dto.category,
        status: 'OPEN',
        priority: dto.priority ?? 'normal',
        assignedTo: null,
        lastMessageAt: new Date(),
      }),
    );
    await this.messages.save(
      this.messages.create({
        ticketId: ticket.id,
        authorId: user.id,
        authorType: 'user',
        body: dto.body.trim(),
        attachments: dto.attachments ?? null,
        isInternal: false,
      }),
    );
    await this.notifyStaff(ticket, 'ticket.created');
    return ticket;
  }

  private async notifyStaff(ticket: SupportTicket, eventKey: string): Promise<void> {
    const staff = await this.users
      .createQueryBuilder('user')
      .where('user.isActive = :active', { active: true })
      .andWhere("user.roles LIKE :role", { role: '%operator%' })
      .take(20)
      .getMany();
    for (const member of staff) {
      await this.notifications
        .notify({
          userId: member.id,
          eventKey,
          subjectId: ticket.id,
          vars: { code: ticket.code, subject: ticket.subject, ticketId: ticket.id },
          data: { ticketId: ticket.id },
          dedupeKey: `${eventKey}:${ticket.id}:${member.id}`,
        })
        .catch((error) => this.logger.warn(`اعلان تیکت ناموفق بود: ${(error as Error).message}`));
    }
  }

  async listMyTickets(userId: string, query: { status?: TicketStatus; page?: number; pageSize?: number } = {}): Promise<PageResult<SupportTicket>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = { userId };
    if (query.status) where.status = query.status;
    const [items, total] = await this.tickets.findAndCount({ where, order: { lastMessageAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async listAllTickets(query: { status?: TicketStatus; category?: string; page?: number; pageSize?: number } = {}): Promise<PageResult<SupportTicket>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    const [items, total] = await this.tickets.findAndCount({ where, order: { lastMessageAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  private async requireTicketAccess(ticketId: string, user: RequestUser): Promise<{ ticket: SupportTicket; isStaff: boolean }> {
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('تیکت پشتیبانی');
    const isStaff = user.roles.includes('admin') || user.roles.includes('operator');
    if (!isStaff && ticket.userId !== user.id) {
      throw new AppException('دسترسی به این تیکت ندارید.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    return { ticket, isStaff };
  }

  async ticketDetail(ticketId: string, user: RequestUser): Promise<{ ticket: SupportTicket; messages: TicketMessage[] }> {
    const { ticket, isStaff } = await this.requireTicketAccess(ticketId, user);
    const messages = await this.messages.find({ where: { ticketId }, order: { createdAt: 'ASC' } });
    return { ticket, messages: isStaff ? messages : messages.filter((message) => !message.isInternal) };
  }

  async replyTicket(ticketId: string, user: RequestUser, dto: ReplyTicketDto): Promise<TicketMessage> {
    const { ticket, isStaff } = await this.requireTicketAccess(ticketId, user);
    if (['CLOSED', 'RESOLVED'].includes(ticket.status) && !isStaff) {
      throw new AppException('این تیکت بسته شده است. برای پیگیری، تیکت جدید ثبت کنید.', ErrorCodes.CONFLICT, { statusCode: 409 });
    }
    if (dto.isInternal && !isStaff) {
      throw new AppException('یادداشت داخلی فقط برای کارکنان پشتیبانی است.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }

    const message = await this.messages.save(
      this.messages.create({
        ticketId,
        authorId: user.id,
        authorType: isStaff ? 'staff' : 'user',
        body: dto.body.trim(),
        attachments: dto.attachments ?? null,
        isInternal: Boolean(dto.isInternal),
      }),
    );

    ticket.lastMessageAt = new Date();
    if (!dto.isInternal) {
      ticket.status = isStaff ? 'WAITING_FOR_USER' : 'OPEN';
    }
    if (ticket.status === 'OPEN' && isStaff) ticket.status = 'IN_PROGRESS';
    await this.tickets.save(ticket);

    if (!dto.isInternal) {
      const targetUserId = isStaff ? ticket.userId : null;
      if (targetUserId) {
        await this.notifications
          .notify({
            userId: targetUserId,
            eventKey: 'ticket.replied',
            subjectId: ticket.id,
            vars: { code: ticket.code, subject: ticket.subject, ticketId: ticket.id },
            data: { ticketId: ticket.id },
          })
          .catch(() => undefined);
      } else {
        await this.notifyStaff(ticket, 'ticket.replied');
      }
    }
    return message;
  }

  async assignTicket(ticketId: string, dto: AssignTicketDto, actorId: string): Promise<SupportTicket> {
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('تیکت پشتیبانی');
    if (dto.assignedTo !== undefined) ticket.assignedTo = dto.assignedTo || null;
    if (dto.status) ticket.status = dto.status;
    if (dto.status === 'CLOSED' || dto.status === 'RESOLVED') ticket.closedAt = new Date();
    ticket.lastMessageAt = new Date();
    const saved = await this.tickets.save(ticket);
    await this.messages.save(
      this.messages.create({
        ticketId,
        authorId: actorId,
        authorType: 'staff',
        body: dto.status ? `وضعیت تیکت به «${dto.status}» تغییر کرد.` : 'تیکت به یکی از کارکنان پشتیبانی اختصاص یافت.',
        attachments: null,
        isInternal: true,
      }),
    );
    return saved;
  }

  async rateTicket(ticketId: string, user: RequestUser, rating: number): Promise<SupportTicket> {
    const { ticket } = await this.requireTicketAccess(ticketId, user);
    if (ticket.userId !== user.id) {
      throw new AppException('فقط ثبت‌کننده تیکت می‌تواند امتیاز رضایت بدهد.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      throw new AppException('امتیاز رضایت فقط پس از حل‌شدن تیکت ثبت می‌شود.', ErrorCodes.CONFLICT, { statusCode: 409 });
    }
    ticket.satisfactionRating = rating;
    return this.tickets.save(ticket);
  }

  /* ------------------------------ مرجوعی ------------------------------ */

  async createReturn(user: RequestUser, dto: CreateReturnDto): Promise<ReturnRequest> {
    const order = await this.orders.findOne({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('سفارش');
    if (order.userId !== user.id) {
      throw new AppException('این سفارش متعلق به شما نیست.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    if (!['DELIVERED', 'COMPLETED'].includes(order.status)) {
      throw new AppException('درخواست مرجوعی فقط پس از تحویل سفارش ممکن است.', ErrorCodes.ORDER_TRANSITION_FORBIDDEN, { statusCode: 409 });
    }
    const windowDays = await this.settings.getNumber('order.refund_window_days', 3);
    const base = order.deliveredAt ?? order.completedAt ?? order.updatedAt;
    if (base && Date.now() - new Date(base).getTime() > windowDays * 86_400_000) {
      throw new AppException(`مهلت ${windowDays} روزه ثبت مرجوعی به پایان رسیده است.`, ErrorCodes.REFUND_WINDOW_CLOSED, {
        statusCode: 409,
      });
    }

    const items = await this.orderItems.find({ where: { orderId: order.id } });
    const item = dto.orderItemId ? items.find((row) => row.id === dto.orderItemId) : items[0];
    if (!item) throw new NotFoundException('قلم سفارش');
    const alreadyReturned = await this.returns
      .createQueryBuilder('ret')
      .select('COALESCE(SUM(ret.quantity), 0)', 'total')
      .where('ret.orderId = :orderId', { orderId: order.id })
      .andWhere('ret.status NOT IN (:...statuses)', { statuses: ['REJECTED', 'CLOSED'] })
      .getRawOne<{ total: string }>();
    const returned = Number(alreadyReturned?.total ?? 0);
    if (returned + dto.quantity > item.quantity) {
      throw new AppException(
        `تعداد درخواستی از مقدار قابل مرجوع این قلم بیشتر است (قابل مرجوع: ${item.quantity - returned}).`,
        ErrorCodes.VALIDATION_FAILED,
      );
    }

    const refundAmount = Math.round((item.lineTotal / item.quantity) * dto.quantity);
    const entity = await this.returns.save(
      this.returns.create({
        code: shortCode(6, 'RET'),
        orderId: order.id,
        orderItemId: item.id,
        userId: user.id,
        sellerId: order.sellerId,
        quantity: dto.quantity,
        reason: dto.reason,
        description: dto.description ?? null,
        images: dto.images ?? null,
        status: 'REQUESTED',
        refundAmount,
      }),
    );
    await this.notifications
      .notify({
        userId: order.userId,
        eventKey: 'return.requested',
        subjectId: entity.id,
        vars: { code: order.code, returnCode: entity.code, returnId: entity.id, amount: refundAmount },
        moneyVars: ['amount'],
        data: { returnId: entity.id },
      })
      .catch(() => undefined);
    return entity;
  }

  async listMyReturns(userId: string, query: { page?: number; pageSize?: number; status?: ReturnStatus } = {}): Promise<PageResult<ReturnRequest>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = { userId };
    if (query.status) where.status = query.status;
    const [items, total] = await this.returns.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async listSellerReturns(sellerId: string, query: { page?: number; pageSize?: number; status?: ReturnStatus } = {}): Promise<PageResult<ReturnRequest>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where: Record<string, unknown> = { sellerId };
    if (query.status) where.status = query.status;
    const [items, total] = await this.returns.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async listAllReturns(query: { page?: number; pageSize?: number; status?: ReturnStatus } = {}): Promise<PageResult<ReturnRequest>> {
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await this.returns.findAndCount({ where, order: { createdAt: 'DESC' }, skip, take });
    return buildPage(items, total, query.page ?? 1, query.pageSize ?? 20);
  }

  async returnDetail(returnId: string, user: RequestUser): Promise<ReturnRequest> {
    const entity = await this.returns.findOne({ where: { id: returnId } });
    if (!entity) throw new NotFoundException('درخواست مرجوعی');
    const isStaff = user.roles.includes('admin') || user.roles.includes('operator');
    if (!isStaff && entity.userId !== user.id && !(user.profileKind === 'seller' && user.profileId === entity.sellerId)) {
      throw new AppException('دسترسی به این درخواست مرجوعی ندارید.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    return entity;
  }

  async respondReturn(user: RequestUser, returnId: string, dto: RespondReturnDto): Promise<ReturnRequest> {
    const entity = await this.returnDetail(returnId, user);
    const isStaff = user.roles.includes('admin') || user.roles.includes('operator');
    if (!isStaff && !(user.profileKind === 'seller' && user.profileId === entity.sellerId)) {
      throw new AppException('فقط فروشنده یا مدیر می‌تواند به این درخواست پاسخ دهد.', ErrorCodes.PERMISSION_DENIED, { statusCode: 403 });
    }
    if (entity.status !== 'REQUESTED') {
      throw new AppException('این درخواست پیش‌تر تعیین تکلیف شده است.', ErrorCodes.CONFLICT, { statusCode: 409 });
    }
    entity.status = dto.decision;
    entity.sellerRespondedAt = new Date();
    entity.sellerResponseNote = dto.note ?? null;
    const saved = await this.returns.save(entity);
    await this.notifyReturnOwner(saved, dto.decision === 'APPROVED' ? 'درخواست مرجوعی تأیید شد' : 'درخواست مرجوعی رد شد');
    return saved;
  }

  /** مراحل رسیدگی توسط مدیر: دریافت کالا، بازپرداخت، بستن پرونده. */
  async resolveReturn(user: RequestUser, returnId: string, dto: ResolveReturnDto): Promise<ReturnRequest> {
    const entity = await this.returns.findOne({ where: { id: returnId } });
    if (!entity) throw new NotFoundException('درخواست مرجوعی');
    if (!['APPROVED', 'RECEIVED', 'REFUNDED'].includes(entity.status)) {
      throw new AppException('وضعیت فعلی اجازه این تغییر را نمی‌دهد.', ErrorCodes.CONFLICT, { statusCode: 409 });
    }

    if (dto.status === 'RECEIVED') {
      entity.status = 'RECEIVED';
      entity.resolutionNote = dto.note ?? entity.resolutionNote;
      entity.handledBy = user.id;
      const saved = await this.returns.save(entity);
      if (saved.orderItemId) {
        const item = await this.orderItems.findOne({ where: { id: saved.orderItemId } });
        if (item?.sellerProductId) {
          item.returnedQuantity += saved.quantity;
          await this.orderItems.save(item);
          await this.sellerProducts.restock(item.sellerProductId, saved.quantity, `مرجوعی ${saved.code}`, user.id);
        }
      }
      await this.notifyReturnOwner(saved, 'کالای مرجوعی دریافت شد');
      return saved;
    }

    if (dto.status === 'REFUNDED') {
      entity.status = 'REFUNDED';
      entity.refundAmount = dto.refundAmount ?? entity.refundAmount;
      entity.resolvedAt = new Date();
      entity.resolutionNote = dto.note ?? 'بازپرداخت انجام شد';
      entity.handledBy = user.id;
      const saved = await this.returns.save(entity);
      await this.ordersService.systemTransition(saved.orderId, 'REFUND_REQUESTED', 'ثبت درخواست بازپرداخت پس از مرجوعی').catch(() => undefined);
      await this.notifyReturnOwner(saved, 'بازپرداخت مرجوعی انجام شد');
      return saved;
    }

    entity.status = 'CLOSED';
    entity.resolvedAt = new Date();
    entity.resolutionNote = dto.note ?? 'پرونده بسته شد';
    entity.handledBy = user.id;
    const saved = await this.returns.save(entity);
    await this.notifyReturnOwner(saved, 'پرونده مرجوعی بسته شد');
    return saved;
  }

  private async notifyReturnOwner(entity: ReturnRequest, message: string): Promise<void> {
    await this.notifications
      .notify({
        userId: entity.userId,
        eventKey: 'return.status_changed',
        subjectId: entity.id,
        vars: { returnCode: entity.code, returnId: entity.id, status: message },
        data: { returnId: entity.id },
      })
      .catch(() => undefined);
  }

  async openTicketCount(): Promise<number> {
    return this.tickets.count({ where: { status: In(['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER']) } });
  }

  async openReturnCount(): Promise<number> {
    return this.returns.count({ where: { status: In(['REQUESTED', 'APPROVED', 'RECEIVED']) } });
  }
}
