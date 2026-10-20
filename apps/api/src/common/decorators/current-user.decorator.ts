import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../types/auth';

/** دسترسی به کاربر احراز هویت‌شده (یا یک فیلد از آن). */
export const CurrentUser = createParamDecorator(
  (field: keyof RequestUser | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
