import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AUDIT_KEY, type AuditMeta } from '../decorators/audit.decorator';
import { AUDIT_WRITER, type AuditEntryInput, type AuditWriter } from './audit-writer.token';
import { getRequestId } from '../context/request-context';
import type { RequestUser } from '../types/auth';

/** ثبت خودکار عملیات حساس در AuditLog (حسابرسی مدیران). */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject(AUDIT_WRITER) private readonly auditWriter?: AuditWriter,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const actor = request.user
      ? {
          id: request.user.id,
          mobile: request.user.mobile,
          fullName: request.user.fullName,
          roles: request.user.roles,
        }
      : null;
    const resourceId =
      (request.params?.id as string | undefined) ??
      ((request.body as Record<string, unknown> | undefined)?.id as string | undefined) ??
      null;

    return next.handle().pipe(
      tap({
        next: (result) => {
          void this.write(meta, request, actor, resourceId, result, 'success');
        },
        error: (error) => {
          void this.write(meta, request, actor, resourceId, undefined, 'failure', error);
        },
      }),
    );
  }

  private async write(
    meta: AuditMeta,
    request: Request,
    actor: AuditEntryInput['actor'],
    resourceId: string | null,
    result: unknown,
    status: 'success' | 'failure',
    error?: unknown,
  ): Promise<void> {
    if (!this.auditWriter) {
      this.logger.warn(`ثبت حسابرسی برای ${meta.action} انجام نشد: نویسنده حسابرسی در دسترس نیست.`);
      return;
    }
    try {
      const body = meta.recordBody ? (request.body as Record<string, unknown>) : undefined;
      const after =
        status === 'success' && result && typeof result === 'object'
          ? (result as Record<string, unknown>)
          : undefined;
      await this.auditWriter.record({
        action: meta.action,
        resource: meta.resource,
        resourceId: resourceId ?? null,
        faDescription: meta.fa,
        actor,
        after: after ?? body ?? null,
        metadata: { method: request.method, path: request.originalUrl },
        ip: (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? request.ip ?? null,
        userAgent: (request.headers['user-agent'] as string) ?? null,
        requestId: getRequestId() ?? null,
        status,
        errorMessage: error ? String((error as Error).message ?? error).slice(0, 500) : null,
      });
    } catch (writeError) {
      // شکست ثبت حسابرسی نباید پاسخ کاربر را خراب کند، اما باید لاگ شود.
      this.logger.error(`ثبت AuditLog برای ${meta.action} ناموفق بود: ${(writeError as Error).message}`);
    }
  }
}
