import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { newId } from '../../common/utils/id';
import { Job } from './entities/job.entity';

export interface EnqueueOptions {
  /** کلید یکتاسازی — از ایجاد کار تکراری برای یک رویداد جلوگیری می‌کند */
  dedupeKey?: string | null;
  /** زمان اجرای برنامه‌ریزی‌شده (پیش‌فرض: اکنون) */
  runAt?: Date | null;
  maxAttempts?: number;
  priority?: number;
}

export interface EnqueueResult {
  job: Job | null;
  duplicated: boolean;
}

/**
 * صف کارهای پس‌زمینه مبتنی بر پایگاه‌داده (الگوی Outbox).
 * مزیت: کارها با راه‌اندازی مجدد سرویس از بین نمی‌روند و با dedupeKey تکراری نمی‌شوند.
 */
@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(@InjectRepository(Job) private readonly repo: Repository<Job>) {}

  async enqueue(type: string, payload: Record<string, unknown> | null, options: EnqueueOptions = {}): Promise<EnqueueResult> {
    if (options.dedupeKey) {
      const existing = await this.repo.findOne({ where: { type, dedupeKey: options.dedupeKey } });
      if (existing && existing.status !== 'failed') {
        return { job: existing, duplicated: true };
      }
      if (existing && existing.status === 'failed') {
        // کار شکست‌خورده با همان کلید دوباره صف می‌شود (بازیابی پس از رفع خطا)
        existing.status = 'queued';
        existing.attempts = 0;
        existing.payload = payload;
        existing.nextRunAt = options.runAt ?? new Date();
        existing.lastError = null;
        existing.completedAt = null;
        return { job: await this.repo.save(existing), duplicated: false };
      }
    }
    const job = this.repo.create({
      id: newId(),
      type,
      payload,
      dedupeKey: options.dedupeKey ?? null,
      status: 'queued',
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 4,
      nextRunAt: options.runAt ?? new Date(),
      priority: options.priority ?? 0,
    });
    return { job: await this.repo.save(job), duplicated: false };
  }

  /** برداشتن کارهای آماده اجرا (حداکثر count مورد). */
  async claim(count = 5, lockedBy = 'runner'): Promise<Job[]> {
    const now = new Date();
    const candidates = await this.repo.find({
      where: { status: 'queued', nextRunAt: LessThanOrEqual(now) },
      order: { priority: 'DESC', nextRunAt: 'ASC' },
      take: count,
    });
    const claimed: Job[] = [];
    for (const job of candidates) {
      const result = await this.repo.update(
        { id: job.id, status: 'queued' },
        { status: 'running', lockedAt: now, lockedBy },
      );
      if (result.affected === 1) {
        job.status = 'running';
        job.lockedAt = now;
        job.lockedBy = lockedBy;
        claimed.push(job);
      }
    }
    return claimed;
  }

  async complete(jobId: string): Promise<void> {
    await this.repo.update({ id: jobId }, { status: 'done', completedAt: new Date(), lastError: null, lockedAt: null, lockedBy: null });
  }

  async fail(job: Job, error: unknown): Promise<void> {
    const attempts = (job.attempts ?? 0) + 1;
    const message = String((error as Error)?.message ?? error).slice(0, 1000);
    if (attempts >= (job.maxAttempts ?? 4)) {
      await this.repo.update({ id: job.id }, { status: 'failed', attempts, lastError: message, lockedAt: null, lockedBy: null });
      this.logger.error(`کار ${job.type} پس از ${attempts} تلاش ناموفق ماند: ${message}`);
      return;
    }
    const delayMs = Math.min(15 * 60_000, 2_000 * 2 ** attempts);
    await this.repo.update(
      { id: job.id },
      { status: 'queued', attempts, lastError: message, nextRunAt: new Date(Date.now() + delayMs), lockedAt: null, lockedBy: null },
    );
    this.logger.warn(`کار ${job.type} ناموفق بود (تلاش ${attempts}) و برای ${delayMs}ms بعد دوباره صف شد: ${message}`);
  }

  /** بازیابی کارهایی که در حالت running قفل مانده‌اند (مثلاً پس از خاموش‌شدن سرویس). */
  async recoverStale(staleMs = 5 * 60_000): Promise<number> {
    const cutoff = new Date(Date.now() - staleMs);
    const result = await this.repo
      .createQueryBuilder()
      .update(Job)
      .set({ status: 'queued', lockedAt: null, lockedBy: null })
      .where('status = :status AND lockedAt < :cutoff', { status: 'running', cutoff })
      .execute();
    return result.affected ?? 0;
  }

  async stats(): Promise<{ queued: number; running: number; done: number; failed: number; byType: Array<{ type: string; queued: number; failed: number }> }> {
    const rows = await this.repo
      .createQueryBuilder('job')
      .select('job.type', 'type')
      .addSelect('job.status', 'status')
      .addSelect('COUNT(1)', 'count')
      .groupBy('job.type')
      .addGroupBy('job.status')
      .getRawMany<{ type: string; status: string; count: string }>();
    const summary = { queued: 0, running: 0, done: 0, failed: 0, cancelled: 0 };
    const byType = new Map<string, { type: string; queued: number; failed: number }>();
    for (const row of rows) {
      const count = Number(row.count);
      if (row.status in summary) summary[row.status as keyof typeof summary] += count;
      const entry = byType.get(row.type) ?? { type: row.type, queued: 0, failed: 0 };
      if (row.status === 'queued') entry.queued += count;
      if (row.status === 'failed') entry.failed += count;
      byType.set(row.type, entry);
    }
    return { queued: summary.queued, running: summary.running, done: summary.done, failed: summary.failed, byType: [...byType.values()] };
  }

  async listRecent(take = 50): Promise<Job[]> {
    return this.repo.find({ order: { createdAt: 'DESC' }, take });
  }
}
