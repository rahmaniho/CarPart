import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@carpart/contract';
import { PERMISSIONS_KEY, PERMISSION_MODE_KEY } from '../decorators/permissions.decorator';
import { AppException, ErrorCodes } from '../errors/app-error';
import type { RequestUser } from '../types/auth';

/** کنترل دسترسی مبتنی بر مجوز (دقیق‌تر از نقش؛ برای تفکیک اپراتور از مدیر). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const mode = this.reflector.getAllAndOverride<'all' | 'any' | undefined>(PERMISSION_MODE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? 'all';

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) {
      throw new AppException('برای دسترسی به این بخش باید وارد شوید.', ErrorCodes.UNAUTHENTICATED, { statusCode: 401 });
    }
    const granted = user.permissions ?? [];
    const ok = mode === 'any' ? required.some((p) => granted.includes(p)) : required.every((p) => granted.includes(p));
    if (!ok) {
      throw new AppException('مجوز لازم برای انجام این عملیات را ندارید.', ErrorCodes.PERMISSION_DENIED, {
        statusCode: 403,
        details: { required },
      });
    }
    return true;
  }
}
