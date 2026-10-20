import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import type { ApiErrorBody } from '@carpart/contract';
import { AppException, ErrorCodes } from '../errors/app-error';
import { getRequestId } from '../context/request-context';
import { redact } from '../utils/text';

interface FieldError {
  property: string;
  constraints?: Record<string, string>;
  children?: FieldError[];
}

function flattenValidationErrors(errors: FieldError[], prefix = ''): Array<{ field: string; message: string }> {
  const out: Array<{ field: string; message: string }> = [];
  for (const error of errors ?? []) {
    const field = prefix ? `${prefix}.${error.property}` : error.property;
    const constraints = error.constraints ? Object.values(error.constraints) : [];
    if (constraints.length) out.push({ field, message: constraints[0] });
    if (error.children?.length) out.push(...flattenValidationErrors(error.children, field));
  }
  return out;
}

/**
 * فیلتر سراسری خطا — همه خطاها به یک ساختار واحد (ApiErrorBody) با پیام فارسی تبدیل می‌شوند.
 * جزئیات داخلی پایگاه‌داده هرگز به کلاینت برنمی‌گردد.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    if (!response || response.headersSent) return;

    const requestId = (request?.headers?.['x-request-id'] as string) ?? getRequestId();
    const path = request?.originalUrl ?? request?.url;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody;

    if (exception instanceof AppException) {
      status = exception.getStatus() as number;
      body = exception.toBody(path, requestId);
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse() as
        | string
        | { message?: string | string[]; error?: string; statusCode?: number };
      const message = typeof payload === 'string' ? payload : (payload?.message ?? exception.message);
      const messages = Array.isArray(message) ? message : [message];
      const validationErrors =
        typeof payload === 'object' && Array.isArray((payload as { message?: unknown }).message)
          ? flattenValidationErrors((payload as unknown as { message: FieldError[] }).message as never)
          : undefined;
      body = {
        statusCode: status,
        code:
          status === HttpStatus.UNAUTHORIZED
            ? ErrorCodes.UNAUTHENTICATED
            : status === HttpStatus.FORBIDDEN
              ? ErrorCodes.FORBIDDEN
              : status === HttpStatus.NOT_FOUND
                ? ErrorCodes.NOT_FOUND
                : status === HttpStatus.TOO_MANY_REQUESTS
                  ? ErrorCodes.RATE_LIMITED
                  : ErrorCodes.VALIDATION_FAILED,
        message: messages.join(' | '),
        faMessage: status === HttpStatus.TOO_MANY_REQUESTS ? 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.' : messages[0],
        errors: validationErrors?.length ? validationErrors : undefined,
        path,
        requestId,
        timestamp: new Date().toISOString(),
      };
    } else {
      const err = exception as { message?: string; code?: string; name?: string; detail?: string; stack?: string };
      const isDbError = ['QueryFailedError', 'EntityNotFoundError', 'CannotExecuteNotConnectedError'].includes(err?.name ?? '');
      body = {
        statusCode: status,
        code: isDbError ? ErrorCodes.INTERNAL_ERROR : ErrorCodes.INTERNAL_ERROR,
        message: 'خطای داخلی سامانه',
        faMessage: 'خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید؛ در صورت تکرار با پشتیبانی تماس بگیرید.',
        path,
        requestId,
        timestamp: new Date().toISOString(),
        details: { errorRef: requestId ? redact(requestId, 8) : undefined },
      };
      this.logger.error(
        `خطای مدیریت‌نشده در ${request?.method ?? '?'} ${path ?? '?'}: ${err?.message ?? exception}`,
        err?.stack,
      );
    }

    if (status >= 500 && !(exception instanceof AppException)) {
      this.logger.error(`پاسخ ۵۰۰ برای ${path}: ${(exception as Error)?.message}`, (exception as Error)?.stack);
    } else if (status >= 400) {
      this.logger.warn(`${status} ${request?.method ?? ''} ${path ?? ''} → ${body.code}${requestId ? ` [${requestId}]` : ''}`);
    }

    response.status(status).json(body);
  }
}
