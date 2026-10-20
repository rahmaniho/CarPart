import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@carpart/contract';
import { ROLE_LABELS_FA } from '@carpart/contract';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppException, ErrorCodes } from '../errors/app-error';
import type { RequestUser } from '../types/auth';

/** کنترل دسترسی مبتنی بر نقش — همیشه سمت سرویس اعمال می‌شود. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) {
      throw new AppException('برای دسترسی به این بخش باید وارد شوید.', ErrorCodes.UNAUTHENTICATED, { statusCode: 401 });
    }
    const allowed = user.roles.some((role) => required.includes(role));
    if (!allowed) {
      throw new AppException(
        `این بخش فقط برای ${required.map((r) => ROLE_LABELS_FA[r]).join(' یا ')} در دسترس است.`,
        ErrorCodes.ROLE_REQUIRED,
        { statusCode: 403 },
      );
    }
    return true;
  }
}
