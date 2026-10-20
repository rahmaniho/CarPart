import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { JobQueueService } from './job-queue.service';
import { JobRegistry, type JobContext } from './job-registry';
import { Job } from './entities/job.entity';

/**
 * اجراکننده صف کارها (درون‌فرایندی).
 * اگر JOB_RUNNER=redis تنظیم شود، می‌توان این اجراکننده را با BullMQ جایگزین کرد
 * بدون اینکه کد کسب‌وکاری تغییر کند (همه کارها از طریق JobQueueService صف می‌شوند).
 */
@Injectable()
export class JobRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobRunnerService.name);
  private running = false;
  private stopped = false;

  constructor(
    private readonly queue: JobQueueService,
    private readonly registry: JobRegistry,
  ) {}

  onModuleInit(): void {
    this.logger.log(`اجراکننده صف کارها فعال شد (پردازش‌گرهای ثبت‌شده: ${this.registry.types().join(', ') || 'هیچ'})`);
  }

  onModuleDestroy(): void {
    this.stopped = true;
  }

  @Interval('job-runner', Number(process.env.JOB_POLL_INTERVAL_MS ?? 5000))
  async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const recovered = await this.queue.recoverStale();
      if (recovered) this.logger.warn(`${recovered} کار قفل‌مانده بازیابی شد.`);
      const jobs = await this.queue.claim(5, `runner-${process.pid}`);
      for (const job of jobs) {
        if (this.stopped) break;
        await this.process(job);
      }
    } catch (error) {
      this.logger.error(`خطا در چرخه صف کارها: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** اجرای فوری یک کار (برای تست‌ها یا عملیات حساس که نباید منتظر بماند). */
  async process(job: Job): Promise<void> {
    const handler = this.registry.get(job.type);
    const context: JobContext = {
      jobId: job.id,
      attempt: (job.attempts ?? 0) + 1,
      enqueuedAt: job.createdAt?.toISOString?.() ?? new Date().toISOString(),
    };
    if (!handler) {
      await this.queue.fail(job, new Error(`پردازش‌گری برای نوع کار «${job.type}» ثبت نشده است.`));
      return;
    }
    try {
      await handler.handle(job.payload ?? {}, context);
      await this.queue.complete(job.id);
    } catch (error) {
      await this.queue.fail(job, error);
    }
  }
}
