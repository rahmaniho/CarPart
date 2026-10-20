import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { VERIFICATION_STATUSES } from '@carpart/contract';
import { AppException, ErrorCodes } from '../errors/app-error';
import type { RequestUser } from '../types/auth';

/**
 * جلوگیری از فعالیت حساب‌های غیرفعال یا تأییدنشده در عملیات تجاری.
 * نقش‌های admin/operator از این بررسی مستثنا هستند.
 */
@Injectable()
export class AccountStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) return true;
    if (user.roles.includes('admin') || user.roles.includes('operator')) return true;
    if (!user.isActive) {
      throw new AppException('حساب کاربری شما غیرفعال است. با پشتیبانی تماس بگیرید.', ErrorCodes.ACCOUNT_SUSPENDED, {
        statusCode: 403,
      });
    }
    if (user.verificationStatus && !['DRAFT', 'APPROVED', 'PENDING_REVIEW'].includes(user.verificationStatus)) {
      // وضعیت‌های REJECTED و SUSPENDED مجاز به فعالیت تجاری نیستند
      if (!VERIFICATION_STATUSES.includes(user.verificationStatus as never)) return true;
      if (user.verificationStatus === 'REJECTED' || user.verificationStatus === 'SUSPENDED') {
        throw new AppException(
          'حساب شما تأیید نشده است. برای انجام این عملیات ابتدا وضعیت تأیید را بررسی کنید.',
          ErrorCodes.ACCOUNT_NOT_VERIFIED,
          { statusCode: 403 },
        );
      }
    }
    return true;
  }
}
