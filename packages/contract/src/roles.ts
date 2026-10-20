/**
 * نقش‌ها و مجوزهای سامانه.
 * این فایل تنها منبع حقیقت برای کنترل دسترسی است؛ سمت سرویس با Guard اعمال می‌شود
 * و سمت رابط کاربری فقط برای چیدمان منوها از آن استفاده می‌کند (امنیت هرگز به UI سپرده نمی‌شود).
 */
export const ROLES = ['mechanic', 'seller', 'courier', 'operator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS_FA: Record<Role, string> = {
  mechanic: 'مکانیک / تعمیرگاه',
  seller: 'فروشنده لوازم یدکی',
  courier: 'پیک / راننده',
  operator: 'اپراتور پشتیبانی',
  admin: 'مدیر پلتفرم',
};

export const PERMISSIONS = [
  // کاربران و احراز هویت
  'user:read',
  'user:manage',
  'user:impersonate',
  'seller:verify',
  'courier:verify',
  'workshop:read',
  'workshop:manage',
  // کاتالوگ
  'catalog:read',
  'catalog:manage',
  'category:manage',
  'brand:manage',
  'vehicle:manage',
  'compatibility:manage',
  // محصولات و موجودی فروشنده
  'product:manage:own',
  'product:manage:all',
  'inventory:manage:own',
  'inventory:manage:all',
  // درخواست تأمین و پیشنهاد
  'request:create',
  'request:read:own',
  'request:read:all',
  'request:manage:all',
  'quote:create',
  'quote:read:own',
  'quote:read:all',
  'quote:manage:all',
  // سفارش
  'order:create',
  'order:read:own',
  'order:read:all',
  'order:update:own',
  'order:manage:all',
  'order:cancel',
  // مالی
  'payment:create',
  'payment:read:own',
  'payment:read:all',
  'payment:manage:all',
  'refund:read:own',
  'refund:manage:all',
  'payout:read:own',
  'payout:manage:all',
  'commission:manage',
  'finance:read',
  'coupon:manage',
  // لجستیک
  'delivery:read:own',
  'delivery:manage:own',
  'delivery:read:all',
  'delivery:assign',
  'courier:location:read',
  // پشتیبانی و اعتماد
  'review:create',
  'review:manage:all',
  'ticket:create',
  'ticket:read:own',
  'ticket:manage:all',
  'return:create',
  'return:read:own',
  'return:manage:all',
  // مدیریت
  'setting:manage',
  'announcement:manage',
  'report:read',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** نگاشت نقش به مجوزها. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  mechanic: [
    'catalog:read',
    'workshop:read',
    'workshop:manage',
    'request:create',
    'request:read:own',
    'quote:read:own',
    'order:create',
    'order:read:own',
    'order:update:own',
    'order:cancel',
    'payment:create',
    'payment:read:own',
    'refund:read:own',
    'delivery:read:own',
    'courier:location:read',
    'review:create',
    'ticket:create',
    'ticket:read:own',
    'return:create',
    'return:read:own',
  ],
  seller: [
    'catalog:read',
    'product:manage:own',
    'inventory:manage:own',
    'request:read:all',
    'quote:create',
    'quote:read:own',
    'order:read:own',
    'order:update:own',
    'payment:read:own',
    'refund:read:own',
    'payout:read:own',
    'return:read:own',
    'ticket:create',
    'ticket:read:own',
  ],
  courier: [
    'delivery:read:own',
    'delivery:manage:own',
    'payout:read:own',
    'ticket:create',
    'ticket:read:own',
  ],
  // اپراتور پشتیبانی: دسترسی عملیاتی بدون دسترسی به تنظیمات مالی و اطلاعات حساس
  operator: [
    'user:read',
    'workshop:read',
    'catalog:read',
    'request:read:all',
    'quote:read:all',
    'order:read:all',
    'order:cancel',
    'delivery:read:all',
    'payment:read:all',
    'refund:read:own',
    'ticket:manage:all',
    'return:read:own',
    'report:read',
    'announcement:manage',
  ],
  admin: PERMISSIONS,
};

/** نقش‌هایی که می‌توانند وارد یک بخش شوند (برای مسیریابی و Guard). */
export const PANEL_ROLES = {
  mechanic: ['mechanic', 'admin', 'operator'] as Role[],
  seller: ['seller', 'admin'] as Role[],
  courier: ['courier', 'admin'] as Role[],
  admin: ['admin', 'operator'] as Role[],
};

export function permissionsOf(roles: readonly Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) set.add(permission);
  }
  return [...set];
}

export function can(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((role) => (ROLE_PERMISSIONS[role] ?? []).includes(permission));
}
