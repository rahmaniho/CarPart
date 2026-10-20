import type { ApiErrorBody } from '@carpart/contract';

/**
 * خطای ساخت‌یافته API — همه خطاها به همین شکل درمی‌آیند تا UI بتواند
 * پیام فارسی (`faMessage`) و کد ماشین‌خوان (`code`) را نشان دهد.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly faMessage: string;
  readonly fieldErrors: Array<{ field: string; message: string }>;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message ?? body.faMessage ?? `خطای HTTP ${status}`);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body.code ?? 'INTERNAL_ERROR';
    this.faMessage = body.faMessage ?? body.message ?? 'خطای ناشناخته';
    this.fieldErrors = body.errors ?? [];
    this.details = body.details;
    this.requestId = body.requestId;
    this.retryable = body.retryable ?? status >= 500;
  }

  /** پیام مناسب نمایش به کاربر فارسی (اول پیام فیلدها، وگرنه پیام کلی) */
  get userMessage(): string {
    return this.fieldErrors[0]?.message ?? this.faMessage;
  }

  static is(error: unknown): error is ApiClientError {
    return error instanceof ApiClientError;
  }

  static network(cause?: unknown): ApiClientError {
    return new ApiClientError(0, {
      code: 'NETWORK_ERROR',
      message: 'اتصال به سرور برقرار نشد.',
      faMessage: 'اتصال به سرور برقرار نشد. اینترنت خود را بررسی کنید و دوباره تلاش کنید.',
      retryable: true,
      ...(cause ? { details: { cause: String(cause) } } : {}),
    });
  }
}
