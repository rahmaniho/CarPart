import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'carpart:audit';

export interface AuditMeta {
  /** عملیات انجام‌شده، مانند seller.approve */
  action: string;
  /** نوع منبع، مانند seller */
  resource: string;
  /** توضیح فارسی برای نمایش در تاریخچه عملیات مدیران */
  fa: string;
  /** آیا بدنه درخواست هم ثبت شود؟ (پیش‌فرض: فقط کلیدها و شناسه‌ها) */
  recordBody?: boolean;
}

/** ثبت خودکار در AuditLog برای عملیات حساس مدیریتی. */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
