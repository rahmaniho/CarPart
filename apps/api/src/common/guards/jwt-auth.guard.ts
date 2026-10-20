import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException, ErrorCodes } from '../errors/app-error';

/**
 * گارد احراز هویت.
 * توکن دسترسی فقط از هدر Authorization خوانده می‌شود (نه کوکی) تا ریسک CSRF حذف شود؛
 * رفرش توکن در کوکی httpOnly با SameSite=Strict نگه‌داری می‌شود.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  /**
   * تفکیک دلیل رد احراز هویت برای کلاینت:
   * بدون توکن (UNAUTHENTICATED)، توکن منقضی (TOKEN_EXPIRED) و توکن نامعتبر/دست‌کاری‌شده (TOKEN_INVALID).
   * این تفکیک به وب اجازه می‌دهد در انقضای نشست، کاربر را بی‌سروصدا دوباره وارد کند.
   */
  handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown): TUser {
    if (!err && user) return user;
    const name = String((info as { name?: string })?.name ?? (err as { name?: string })?.name ?? '');
    const message = String((info as Error | undefined)?.message ?? (err as Error | undefined)?.message ?? '');
    if (name === 'TokenExpiredError' || /expired/i.test(message)) {
      throw new AppException('نشست شما منقضی شده است. دوباره وارد شوید.', ErrorCodes.TOKEN_EXPIRED, { statusCode: 401 });
    }
    if (!name && !message && !user) {
      throw new AppException('برای دسترسی به این بخش باید وارد شوید.', ErrorCodes.UNAUTHENTICATED, { statusCode: 401 });
    }
    throw new AppException('توکن ورود معتبر نیست.', ErrorCodes.TOKEN_INVALID, { statusCode: 401 });
  }
}

export function bearerFromRequest(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() === 'bearer' && token) return token.trim();
  return null;
}
