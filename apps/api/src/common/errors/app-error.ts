import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorBody } from '@carpart/contract';

/** کدهای خطای ماشین‌خوان سامانه — کلاینت می‌تواند بر اساس این کدها رفتار خاص نشان دهد. */
export const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ROLE_REQUIRED: 'ROLE_REQUIRED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  MOBILE_ALREADY_REGISTERED: 'MOBILE_ALREADY_REGISTERED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
  ORDER_TRANSITION_FORBIDDEN: 'ORDER_TRANSITION_FORBIDDEN',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_NOT_EDITABLE: 'ORDER_NOT_EDITABLE',
  PRODUCT_INACTIVE: 'PRODUCT_INACTIVE',
  OFFER_UNAVAILABLE: 'OFFER_UNAVAILABLE',
  ORDER_MULTI_SELLER_NOT_SUPPORTED: 'ORDER_MULTI_SELLER_NOT_SUPPORTED',
  QUOTE_NOT_SELECTABLE: 'QUOTE_NOT_SELECTABLE',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  REQUEST_CLOSED: 'REQUEST_CLOSED',
  REQUEST_NOT_OPEN: 'REQUEST_NOT_OPEN',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  STOCK_CONFLICT: 'STOCK_CONFLICT',
  PAYMENT_ALREADY_PROCESSED: 'PAYMENT_ALREADY_PROCESSED',
  PAYMENT_AMOUNT_MISMATCH: 'PAYMENT_AMOUNT_MISMATCH',
  PAYMENT_SIGNATURE_INVALID: 'PAYMENT_SIGNATURE_INVALID',
  PAYMENT_PROVIDER_UNAVAILABLE: 'PAYMENT_PROVIDER_UNAVAILABLE',
  PAYMENT_NOT_LIVE_CONFIGURED: 'PAYMENT_NOT_LIVE_CONFIGURED',
  REFUND_EXCEEDS_PAYMENT: 'REFUND_EXCEEDS_PAYMENT',
  REFUND_WINDOW_CLOSED: 'REFUND_WINDOW_CLOSED',
  DELIVERY_NOT_ASSIGNED: 'DELIVERY_NOT_ASSIGNED',
  DELIVERY_OTP_INVALID: 'DELIVERY_OTP_INVALID',
  PICKUP_CODE_INVALID: 'PICKUP_CODE_INVALID',
  COURIER_NOT_AVAILABLE: 'COURIER_NOT_AVAILABLE',
  COURIER_NOT_ELIGIBLE: 'COURIER_NOT_ELIGIBLE',
  NO_ELIGIBLE_COURIER: 'NO_ELIGIBLE_COURIER',
  COUPON_INVALID: 'COUPON_INVALID',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_LIMIT_REACHED: 'COUPON_LIMIT_REACHED',
  COUPON_MIN_NOT_MET: 'COUPON_MIN_NOT_MET',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED: 'FILE_TYPE_NOT_ALLOWED',
  RATE_LIMITED: 'RATE_LIMITED',
  EXTERNAL_SERVICE_FAILED: 'EXTERNAL_SERVICE_FAILED',
  SETTING_INVALID: 'SETTING_INVALID',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface AppExceptionOptions {
  statusCode?: number;
  faMessage?: string;
  details?: Record<string, unknown>;
  errors?: Array<{ field: string; message: string }>;
  retryable?: boolean;
  logLevel?: 'warn' | 'error';
}

/**
 * خطای پایه برنامه — همیشه شامل کد ماشین‌خوان و پیام فارسی است.
 * فیلتر سراسری آن را به ApiErrorBody تبدیل می‌کند.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode | string;
  readonly faMessage?: string;
  readonly details?: Record<string, unknown>;
  readonly fieldErrors?: Array<{ field: string; message: string }>;
  readonly retryable?: boolean;
  readonly logLevel: 'warn' | 'error';

  constructor(message: string, code: ErrorCode | string = ErrorCodes.INTERNAL_ERROR, options: AppExceptionOptions = {}) {
    super(message, options.statusCode ?? HttpStatus.BAD_REQUEST);
    this.code = code;
    this.faMessage = options.faMessage;
    this.details = options.details;
    this.fieldErrors = options.errors;
    this.retryable = options.retryable;
    this.logLevel = options.logLevel ?? ((options.statusCode ?? 400) >= 500 ? 'error' : 'warn');
  }

  toBody(path?: string, requestId?: string): ApiErrorBody {
    const status = this.getStatus();
    return {
      statusCode: typeof status === 'number' ? status : 500,
      code: this.code,
      message: this.message,
      faMessage: this.faMessage ?? this.message,
      errors: this.fieldErrors,
      details: this.details,
      path,
      requestId,
      timestamp: new Date().toISOString(),
      retryable: this.retryable,
    };
  }
}

export class NotFoundException extends AppException {
  constructor(resource = 'منبع', faMessage?: string) {
    super(`${resource} یافت نشد.`, ErrorCodes.NOT_FOUND, {
      statusCode: HttpStatus.NOT_FOUND,
      faMessage: faMessage ?? `${resource} یافت نشد.`,
    });
  }
}

export class ForbiddenException extends AppException {
  constructor(faMessage = 'شما اجازه انجام این عملیات را ندارید.', code: ErrorCode = ErrorCodes.FORBIDDEN) {
    super(faMessage, code, { statusCode: HttpStatus.FORBIDDEN, faMessage });
  }
}

export class UnauthorizedException extends AppException {
  constructor(faMessage = 'برای دسترسی به این بخش باید وارد شوید.', code: ErrorCode = ErrorCodes.UNAUTHENTICATED) {
    super(faMessage, code, { statusCode: HttpStatus.UNAUTHORIZED, faMessage });
  }
}

export class ConflictException extends AppException {
  constructor(faMessage: string, code: ErrorCode = ErrorCodes.CONFLICT, details?: Record<string, unknown>) {
    super(faMessage, code, { statusCode: HttpStatus.CONFLICT, faMessage, details });
  }
}

export class BadRequestException extends AppException {
  constructor(faMessage: string, code: ErrorCode = ErrorCodes.VALIDATION_FAILED, details?: Record<string, unknown>) {
    super(faMessage, code, { statusCode: HttpStatus.BAD_REQUEST, faMessage, details });
  }
}

export class ExternalServiceException extends AppException {
  constructor(service: string, faMessage?: string) {
    super(`سرویس ${service} در دسترس نیست.`, ErrorCodes.EXTERNAL_SERVICE_FAILED, {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      faMessage: faMessage ?? `سرویس ${service} موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید.`,
      retryable: true,
    });
  }
}
