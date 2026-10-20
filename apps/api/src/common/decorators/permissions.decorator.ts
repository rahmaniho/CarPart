import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@carpart/contract';

export const PERMISSIONS_KEY = 'carpart:permissions';
export const PERMISSION_MODE_KEY = 'carpart:permissionMode';

/**
 * الزام داشتن مجوزها. پیش‌فرض: داشتن همه مجوزهای ذکرشده.
 * مثال: @RequirePermissions('order:read:all')
 */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/** حالت بررسی: any = داشتن یکی از مجوزها کافی است. */
export const PermissionMode = (mode: 'all' | 'any') => SetMetadata(PERMISSION_MODE_KEY, mode);
