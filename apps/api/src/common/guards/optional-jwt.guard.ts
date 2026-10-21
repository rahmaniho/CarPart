import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * گارد احراز هویت اختیاری.
 * اگر توکن معتبر باشد، کاربر به درخواست افزوده می‌شود؛ در غیر این صورت درخواست
 * به‌صورت مهمان ادامه می‌یابد (برای جست‌وجوی عمومی که با ورود کاربر شخصی‌سازی می‌شود).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) return undefined as TUser;
    return user;
  }
}
