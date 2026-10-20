import type { Permission, Role } from './roles';
import type { PaymentMode, QualityGrade, CompatibilityLevel } from './statuses';

export const API_PREFIX = '/api/v1';

/** شکل خطای استاندارد سرویس — همه پاسخ‌های خطا از این ساختار پیروی می‌کنند. */
export interface ApiErrorBody {
  statusCode: number;
  /** کد ماشین‌خوان خطا مانند ORDER_TRANSITION_FORBIDDEN */
  code: string;
  message: string;
  /** پیام فارسی مناسب نمایش به کاربر */
  faMessage?: string;
  errors?: Array<{ field: string; message: string }>;
  details?: Record<string, unknown>;
  path?: string;
  requestId?: string;
  timestamp: string;
  /** آیا این خطا به‌طور موقت قابل تلاش مجدد است؟ */
  retryable?: boolean;
}

export interface Page<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export function emptyPage<T>(page = 1, pageSize = 20): Page<T> {
  return { items: [], meta: { page, pageSize, total: 0, totalPages: 0, hasNext: false, hasPrevious: false } };
}

export interface CurrentUserDto {
  id: string;
  mobile: string;
  fullName: string;
  roles: Role[];
  permissions: Permission[];
  email?: string | null;
  isActive: boolean;
  profileId?: string | null;
  profileKind?: 'workshop' | 'seller' | 'courier' | null;
  verificationStatus?: string | null;
  city?: string | null;
}

/** تجزیه مبالغ یک سفارش — همه مقادیر عدد صحیح تومان هستند. */
export interface MoneyBreakdown {
  itemsTotal: number;
  deliveryFee: number;
  discountTotal: number;
  platformFee: number;
  payable: number;
  currency: 'IRT';
  unit: 'toman';
}

export interface RankFactor {
  key: string;
  fa: string;
  weight: number;
  score: number;
  contribution: number;
  note?: string;
}

export interface RankExplanation {
  total: number;
  factors: RankFactor[];
  compatibility: CompatibilityLevel;
  transparent: true;
}

export interface OfferDto {
  id: string;
  sellerProductId: string;
  seller: { id: string; name: string; branchName?: string; rating?: number | null; city?: string | null };
  price: number;
  stock: number;
  quality: QualityGrade;
  preparationMinutes: number;
  deliveryFee: number;
  /** زمان تخمینی تحویل = آماده‌سازی + مسیر (دقیقه). null یعنی تخمین زده نشد. */
  estimatedDeliveryMinutes: number | null;
  distanceKm: number | null;
  updatedAt: string;
  rank: RankExplanation;
  /** هشدارهای شفاف (سازگاری نامشخص، ناموجودی و ...) */
  warnings?: string[];
}

export interface SandboxFlags {
  paymentMode: PaymentMode;
  mapProvider: string;
  smsProvider: string;
  emailProvider: string;
  storageProvider: string;
  jobRunner: string;
  isProduction: boolean;
}
