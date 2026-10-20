import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

/** خواندن کلید یکتاسازی از هدر درخواست (برای عملیات حساس مانند پرداخت و ثبت سفارش). */
export const IdempotencyKey = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
  const raw = request.headers[IDEMPOTENCY_HEADER] ?? request.headers['x-idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? String(value).trim().slice(0, 128) : undefined;
});
