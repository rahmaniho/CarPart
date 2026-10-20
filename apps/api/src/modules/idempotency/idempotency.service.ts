import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { AppException, ErrorCodes } from '../../common/errors/app-error';
import { IdempotencyRecord } from './entities/idempotency-record.entity';

export interface IdempotencyRunResult<T> {
  replayed: boolean;
  result: T;
}

/**
 * سرویس یکتاسازی درخواست‌های حساس.
 *
 * کلید یکتاسازی از سرآیند `Idempotency-Key` گرفته می‌شود. اگر همان کلید پیش‌تر
 * با موفقیت پردازش شده باشد، همان پاسخ ذخیره‌شده بازگردانده می‌شود (بدون اجرای دوباره عملیات)
 * و اگر پردازش در جریان باشد، درخواست تکراری با خطای ۴۰۹ رد می‌شود.
 */
@Injectable()
export class IdempotencyService {
  constructor(@InjectRepository(IdempotencyRecord) private readonly records: Repository<IdempotencyRecord>) {}

  static hash(body: unknown): string {
    return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
  }

  async run<T>(
    scope: string,
    key: string | undefined | null,
    context: { userId?: string | null; method?: string; path?: string; requestHash?: string },
    operation: () => Promise<T>,
  ): Promise<IdempotencyRunResult<T>> {
    if (!key) return { replayed: false, result: await operation() };

    const existing = await this.records.findOne({ where: { scope, key } });
    if (existing) {
      if (existing.status === 'completed' && existing.responseBody) {
        if (context.requestHash && existing.requestHash && existing.requestHash !== context.requestHash) {
          throw new AppException(
            'کلید یکتاسازی تکراری با بدنه درخواست متفاوت استفاده شده است.',
            ErrorCodes.IDEMPOTENCY_CONFLICT,
            { statusCode: 409 },
          );
        }
        return { replayed: true, result: existing.responseBody as T };
      }
      const stale = existing.expiresAt ? existing.expiresAt < new Date() : false;
      if (existing.status === 'processing' && !stale) {
        throw new AppException('درخواست قبلی با همین کلید در حال پردازش است.', ErrorCodes.IDEMPOTENCY_CONFLICT, {
          statusCode: 409,
          retryable: true,
        });
      }
      await this.records.delete({ id: existing.id });
    }

    const record = await this.records.save(
      this.records.create({
        scope,
        key,
        userId: context.userId ?? null,
        method: context.method ?? null,
        path: context.path ?? null,
        requestHash: context.requestHash ?? null,
        status: 'processing',
        expiresAt: new Date(Date.now() + 24 * 3_600_000),
      }),
    );

    try {
      const result = await operation();
      record.status = 'completed';
      record.responseStatus = 200;
      record.responseBody = (result ?? null) as unknown as Record<string, unknown>;
      await this.records.save(record);
      return { replayed: false, result };
    } catch (error) {
      record.status = 'failed';
      record.responseBody = { message: (error as Error).message };
      await this.records.save(record);
      throw error;
    }
  }

  async cleanup(now = new Date()): Promise<number> {
    const result = await this.records.createQueryBuilder().delete().where('expiresAt < :now', { now }).execute();
    return result.affected ?? 0;
  }
}
