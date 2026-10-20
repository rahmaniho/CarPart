import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { getRequestContext, requestStorage } from '../context/request-context';
import { redact } from '../utils/text';

const SENSITIVE_KEYS = ['password', 'token', 'refreshToken', 'accessToken', 'otp', 'code', 'cardNumber', 'secret'];

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 5).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))
      ? redact(typeof val === 'string' ? val : String(val))
      : sanitize(val, depth + 1);
  }
  return out;
}

/**
 * ثبت لاگ دسترسی و تکمیل زمینه درخواست.
 * شناسه درخواست توسط میان‌افزار `requestContextMiddleware` ساخته می‌شود (پیش از گاردها)؛
 * این رهگیر تنها در نبود آن زمینه، زمینه جدید می‌سازد.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const existing = getRequestContext();
    const requestId = existing?.requestId ?? ((request.headers['x-request-id'] as string) ?? randomUUID());
    const startedAt = existing?.startedAt ?? Date.now();

    response.setHeader('X-Request-Id', requestId);

    if (existing) {
      return new Observable((subscriber) => {
        next
          .handle()
          .pipe(
            tap({
              next: () => this.log(request, response, startedAt, requestId),
              error: (error) => this.logError(request, error, startedAt, requestId),
            }),
          )
          .subscribe(subscriber);
      });
    }

    return new Observable((subscriber) => {
      requestStorage.run({ requestId, method: request.method, path: request.originalUrl, startedAt }, () => {
        next
          .handle()
          .pipe(
            tap({
              next: () => this.log(request, response, startedAt, requestId),
              error: (error) => this.logError(request, error, startedAt, requestId),
            }),
          )
          .subscribe(subscriber);
      });
    });
  }

  private logError(request: Request, error: unknown, startedAt: number, requestId: string): void {
    const status = (error as { getStatus?: () => number }).getStatus?.() ?? 500;
    if (status < 500) {
      this.logger.warn(`${request.method} ${request.originalUrl} → ${status} (${Date.now() - startedAt}ms) [${redact(requestId, 8)}]`);
    }
  }

  private log(request: Request, response: Response, startedAt: number, requestId: string): void {
    const duration = Date.now() - startedAt;
    const line = `${request.method} ${request.originalUrl} → ${response.statusCode} (${duration}ms) [${redact(requestId, 8)}]`;
    if (response.statusCode >= 400) this.logger.warn(line);
    else if (process.env.NODE_ENV !== 'test') this.logger.log(line);
    if (process.env.HTTP_BODY_LOG === 'true' && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      this.logger.debug(`بدنه درخواست: ${JSON.stringify(sanitize(request.body))}`);
    }
  }
}
