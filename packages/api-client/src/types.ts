import type {
  DeliveryStatus,
  OrderStatus,
  Permission,
  Role,
  UrgencyLevel,
} from '@carpart/contract';

/** صفحه‌بندی استاندارد API */
export interface PageResult<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean };
}

export interface SessionUser {
  id: string;
  mobile: string;
  fullName: string;
  roles: Role[];
  permissions: Permission[];
  email: string | null;
  isActive: boolean;
  city: string | null;
  profileId?: string | null;
  profileKind?: 'workshop' | 'seller' | 'courier' | null;
  verificationStatus?: string | null;
}

export interface AuthSession {
  user: SessionUser;
  accessToken: string;
  accessExpiresIn: number;
  /** فقط در کلاینت native (با هدر X-Client-Platform)؛ وب از کوکی httpOnly استفاده می‌کند */
  refreshToken?: string;
  requiresMobileVerification: boolean;
}

export interface OtpRequestResult {
  sent: boolean;
  expiresIn: number;
  /** فقط در استقرارهای توسعه با AUTH_EXPOSE_DEV_OTP */
  devCode?: string;
  simulated: boolean;
  notice?: string;
}

export interface RegisterResult {
  userId: string;
  mobile: string;
  fullName: string;
  otp: OtpRequestResult;
}

/* ------------------------------- کاتالوگ ------------------------------- */

export interface RankFactor {
  key: string;
  fa: string;
  weight: number;
  score: number;
  contribution: number;
  note?: string;
}

export interface CompatibilityInfo {
  level: 'exact' | 'likely' | 'unknown' | 'incompatible';
  note: string;
}

export interface SearchOffer {
  id: string;
  sellerProductId: string;
  part: { id: string; nameFa: string; brandNameFa?: string | null; categoryFa?: string | null; imageUrl?: string | null; [k: string]: unknown };
  seller: { id: string; name: string; branchName: string; rating: number; city: string };
  price: number;
  listPrice?: number | null;
  stock: number;
  quality: string;
  preparationMinutes: number | null;
  deliveryFee: number;
  estimatedDeliveryMinutes: number | null;
  distanceKm: number | null;
  compatibility: CompatibilityInfo;
  rank: { total: number; factors: RankFactor[]; compatibility?: string; transparent: boolean };
  warnings: string[];
  sku?: string | null;
  isFeatured?: boolean;
  returnPolicy?: string | null;
  warrantyNote?: string | null;
  routeSource?: string;
  updatedAt: string;
}

export interface VehicleRow {
  id: string;
  nickname?: string | null;
  modelId?: string | null;
  variantId?: string | null;
  yearFrom?: number | null;
  plateDigits?: string | null;
  model?: { id: string; nameFa: string; make?: { id: string; nameFa: string } | null } | null;
  variant?: { id: string; nameFa: string } | null;
  [k: string]: unknown;
}

export interface AddressRow {
  id: string;
  title?: string | null;
  receiverName?: string | null;
  phone?: string | null;
  city: string;
  addressText: string;
  lat: number | null;
  lng: number | null;
  [k: string]: unknown;
}

/* ------------------------------- سفارش‌ها ------------------------------- */

export interface OrderItemRow {
  id: string;
  sellerProductId: string;
  partNameFa: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  [k: string]: unknown;
}

export interface OrderRow {
  id: string;
  code: string;
  status: OrderStatus;
  orderKind: 'single' | 'parent' | 'child';
  parentOrderId: string | null;
  sellerId: string | null;
  branchId: string | null;
  source: string;
  city: string | null;
  itemsSubtotal: number;
  deliveryFee: number;
  discountTotal: number;
  platformFee: number;
  payableTotal: number;
  currency: string;
  paymentStatus: string | null;
  paidAt: string | null;
  createdAt: string;
  expectedReadyAt?: string | null;
  expectedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  cancelReason?: string | null;
  addressSnapshot?: { receiverName?: string; city?: string; addressText?: string; [k: string]: unknown } | null;
  items?: OrderItemRow[];
  [k: string]: unknown;
}

export interface OrderAction {
  action: string;
  to?: OrderStatus;
  fa: string;
  requiresReason?: boolean;
  [k: string]: unknown;
}

export interface OrderDetail extends OrderRow {
  items: OrderItemRow[];
  /** Independent seller packages when this row is a payment aggregate. */
  packages?: OrderDetail[];
  delivery: DeliveryMission | null;
  allowedActions: OrderAction[];
  breakdown: Array<{ fa: string; amount: number }>;
}

export interface OrderEventRow {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  fa?: string;
  actorType?: string;
  actorId?: string | null;
  reason?: string | null;
  createdAt: string;
  [k: string]: unknown;
}

/* -------------------------------- RFQ -------------------------------- */

export interface QuoteItemRow {
  id: string;
  partId?: string | null;
  partNameFa?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  [k: string]: unknown;
}

export interface QuoteRow {
  id: string;
  requestId: string;
  sellerId: string;
  branchId?: string | null;
  status: string;
  itemsTotal: number;
  deliveryFee: number;
  total: number;
  preparationMinutes: number;
  validUntil?: string | null;
  note?: string | null;
  createdAt: string;
  items?: QuoteItemRow[];
  [k: string]: unknown;
}

export interface QuoteComparisonRow {
  quoteId: string;
  quote: QuoteRow;
  sellerName?: string;
  branchName?: string;
  rank: number;
  total: number;
  explanation: { factors: RankFactor[]; total?: number; [k: string]: unknown };
  warnings?: string[];
  [k: string]: unknown;
}

export interface RequestRow {
  id: string;
  code: string;
  titleFa: string;
  partNameFa: string;
  quantity: number;
  urgency: UrgencyLevel | string;
  status: string;
  quoteCount: number;
  deadlineAt: string;
  createdAt: string;
  city?: string | null;
  [k: string]: unknown;
}

/* ------------------------------ پرداخت ------------------------------ */

export interface PaymentReadiness {
  provider: string;
  sandbox: boolean;
  configured: boolean;
  ready: boolean;
  notice?: string;
  [k: string]: unknown;
}

export interface PaymentRow {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  provider: string;
  referenceId?: string | null;
  createdAt: string;
  [k: string]: unknown;
}

/* ------------------------------ ارسال ------------------------------ */

export interface DeliveryPoint {
  title?: string | null;
  addressText?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  [k: string]: unknown;
}

export interface DeliveryMission {
  id: string;
  code: string;
  createdAt: string;
  orderId: string;
  status: DeliveryStatus;
  pickupPoint: DeliveryPoint;
  dropoffPoint: DeliveryPoint;
  city: string | null;
  distanceKm: number | null;
  estimatedMinutes: number | null;
  deliveryFee: number;
  courierShare: number;
  offerExpiresAt: string | null;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  isUrgent?: boolean;
  notes?: string | null;
  [k: string]: unknown;
}

export interface LiveDeliveryLocation {
  lat: number;
  lng: number;
  accuracyM: number | null;
  speedKmh: number | null;
  heading: number | null;
  recordedAt: string;
  ageSeconds: number;
  isFresh: boolean;
  distanceToPickupM: number | null;
  distanceToDropoffM: number | null;
}

export interface DeliveryTracking {
  deliveryId: string;
  code: string;
  status: DeliveryStatus;
  statusFa: string;
  pickupPoint: DeliveryPoint;
  dropoffPoint: DeliveryPoint;
  courier: { name: string; phoneMasked: string; ratingAvg: number; vehicleType: string | null } | null;
  distanceKm: number | null;
  estimatedMinutes: number | null;
  estimatedArrival: string | null;
  events: Array<{ at: string; fa: string; status: DeliveryStatus | null }>;
  location: LiveDeliveryLocation | null;
  sellerArrival: { detected: boolean; at: string | null };
  refreshAfterSeconds: number;
  notice: string;
  deliveryOtp?: string | null;
  pickupCode?: string | null;
}

export interface CourierLocationInput {
  lat: number;
  lng: number;
  accuracyM?: number;
  speedKmh?: number;
  heading?: number;
  deliveryId: string;
  capturedAt?: string;
}

export interface CourierLocationUpdate {
  ok: true;
  recordedAt: string;
  deliveryId: string;
  distanceToPickupM: number | null;
  distanceToDropoffM: number | null;
  sellerArrivalDetected: boolean;
}

export interface CourierProfile {
  id: string;
  userId: string;
  displayName?: string | null;
  vehicleType?: string | null;
  verificationStatus: string;
  availability?: 'online' | 'offline';
  isOnline?: boolean;
  ratingAvg?: number;
  ratingCount?: number;
  [k: string]: unknown;
}

/* ------------------------------ اعلان‌ها ------------------------------ */

export interface NotificationRow {
  id: string;
  channel: 'inapp' | 'sms' | 'email';
  eventKey: string;
  titleFa: string;
  bodyFa: string;
  link: string | null;
  tone: string | null;
  isRead: boolean;
  isSimulated?: boolean;
  status?: string;
  createdAt: string;
  [k: string]: unknown;
}

/* ------------------------------ مدیریت ------------------------------ */

export interface AdminDashboard {
  generatedAt: string;
  users: { total: number; byRole: Record<string, number>; newToday: number; active: number; inactive: number };
  verifications: { seller: number; courier: number; workshop: number };
  catalog: { parts: number; activeOffers: number; outOfStockOffers: number; sellers: number; couriers: number; workshops: number };
  requests: { open: number; quoted: number; converted: number; expiredToday: number };
  orders: { total: number; byStatus: Record<string, number>; today: number; awaitingPayment: number; inProgress: number };
  money: { gmv: number; platformRevenue: number; sellerNet: number; courierShare: number; paidOut: number; pendingPayout: number; note: string };
  payments: { count: number; success: number; failed: number; amountSuccess: number; sandboxActive: boolean };
  delivery: { total: number; delivered: number; failed: number; avgMinutes: number | null; waitingForCourier: number };
  support: { openTickets: number; openReturns: number };
  topSellers: Array<{ id: string; storeName: string; orders: number; revenue: number; platformRevenue: number }>;
  recentAudit: Array<{ at: string; action: string; fa: string; actor: string | null }>;
}

export interface DailySeriesPoint {
  date: string;
  jalali: string;
  orders: number;
  gmv: number;
  platformRevenue: number;
  requests: number;
}

export interface VerificationRow {
  kind: 'seller' | 'courier' | 'workshop';
  id: string;
  userId: string;
  displayName: string;
  city: string | null;
  status: string;
  submittedAt: string;
  documents: Array<{ kind: string; fileUrl: string }> | null;
  [k: string]: unknown;
}

export interface AdminUserRow {
  id: string;
  mobile: string;
  fullName: string;
  roles: Role[];
  isActive: boolean;
  createdAt: string;
  [k: string]: unknown;
}

export interface SettingRow {
  key: string;
  value: string | number | boolean;
  faLabel: string;
  group?: string;
  [k: string]: unknown;
}

export interface AuditRow {
  id: string;
  action: string;
  fa?: string;
  actor?: string | null;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  createdAt: string;
  [k: string]: unknown;
}

export interface TicketRow {
  id: string;
  code: string;
  subject: string;
  status: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
  [k: string]: unknown;
}
