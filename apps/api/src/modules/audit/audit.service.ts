import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Role } from '@carpart/contract';
import { AUDIT_WRITER, type AuditEntryInput, type AuditWriter } from '../../common/interceptors/audit-writer.token';
import { buildPage, toSkipTake, type PageResult } from '../../common/dto/pagination.dto';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditQuery {
  page?: number;
  pageSize?: number;
  action?: string;
  resource?: string;
  actorId?: string;
  from?: string;
  to?: string;
  status?: 'success' | 'failure';
}

/**
 * سرویس حسابرسی — ثبت و جست‌وجوی عملیات حساس.
 * این سرویس به‌عنوان AuditWriter برای AuditInterceptor نیز فراهم می‌شود.
 */
@Injectable()
export class AuditService implements AuditWriter {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async record(entry: AuditEntryInput): Promise<AuditLog> {
    const log = this.repo.create({
      actorId: entry.actor?.id ?? null,
      actorMobile: entry.actor?.mobile ?? null,
      actorName: entry.actor?.fullName ?? null,
      actorRoles: (entry.actor?.roles ?? null) as Role[] | null,
      actorType: entry.actor ? 'user' : 'system',
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ?? null,
      faDescription: entry.faDescription,
      before: entry.before ?? null,
      after: entry.after ?? null,
      metadata: entry.metadata ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      requestId: entry.requestId ?? null,
      status: entry.status ?? 'success',
      errorMessage: entry.errorMessage ?? null,
    });
    return this.repo.save(log);
  }

  /** ثبت رویداد حساس از طرف خود سامانه (فرایندهای زمان‌بندی‌شده). */
  async recordSystem(action: string, resource: string, resourceId: string | null, faDescription: string, metadata?: Record<string, unknown>): Promise<void> {
    try {
      await this.record({ action, resource, resourceId, faDescription, actor: null, metadata: metadata ?? null });
    } catch (error) {
      this.logger.error(`ثبت حسابرسی سامانه ناموفق بود: ${(error as Error).message}`);
    }
  }

  async query(params: AuditQuery): Promise<PageResult<AuditLog>> {
    const { skip, take } = toSkipTake(params.page, params.pageSize);
    const qb = this.repo.createQueryBuilder('audit');
    if (params.action) qb.andWhere('audit.action LIKE :action', { action: `%${params.action}%` });
    if (params.resource) qb.andWhere('audit.resource = :resource', { resource: params.resource });
    if (params.actorId) qb.andWhere('audit.actorId = :actorId', { actorId: params.actorId });
    if (params.status) qb.andWhere('audit.status = :status', { status: params.status });
    if (params.from && params.to) {
      qb.andWhere('audit.createdAt BETWEEN :from AND :to', { from: new Date(params.from), to: new Date(params.to) });
    } else if (params.from) {
      qb.andWhere('audit.createdAt >= :from', { from: new Date(params.from) });
    } else if (params.to) {
      qb.andWhere('audit.createdAt <= :to', { to: new Date(params.to) });
    }
    qb.orderBy('audit.createdAt', 'DESC').skip(skip).take(take);
    const [items, total] = await qb.getManyAndCount();
    return buildPage(items, total, params.page ?? 1, params.pageSize ?? 20);
  }

  /** آمار عملیات حساس برای داشبورد مدیر. */
  async summarize(days = 7): Promise<Array<{ action: string; count: number }>> {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.repo
      .createQueryBuilder('audit')
      .select('audit.action', 'action')
      .addSelect('COUNT(1)', 'count')
      .where('audit.createdAt >= :since', { since })
      .groupBy('audit.action')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany<{ action: string; count: string }>();
    return rows.map((r) => ({ action: r.action, count: Number(r.count) }));
  }
}

export const AUDIT_WRITER_PROVIDER = { provide: AUDIT_WRITER, useExisting: AuditService };
