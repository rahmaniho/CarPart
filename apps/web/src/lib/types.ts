import type {
  CompatibilityLevel,
  DeliveryStatus,
  OfferDto,
  OrderStatus,
  PaymentStatus,
  PayoutStatus,
  QualityGrade,
  QuoteStatus,
  RankExplanation,
  RefundStatus,
  RequestStatus,
  ReturnStatus,
  Role,
  TicketStatus,
  UrgencyLevel,
} from '@carpart/contract';
import { create } from 'zustand';

/* ----------------------------- سیستم اعلان آنی ---------------------------- */
export interface ToastItem {
  id: string;
  tone: 'success' | 'error' | 'warning' | 'info';
  title: string;
  detail?: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (item: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (item) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...item, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/* -------------------------- مدل‌های پاسخ سرویس بک‌اند -------------------------- */
export interface HealthReadyResponse {
  status: 'ok' | 'down';
  timestamp: string;
  components: Record<string, { status: 'ok' | 'degraded' | 'down'; detail?: string }>;
  notice?: string;
}

export interface CategoryNode {
  id: string;
  nameFa: string;
  slug: string;
  parentId?: string | null;
  children?: CategoryNode[];
}

export interface BrandDto {
  id: string;
  nameFa: string;
  nameEn?: string | null;
  country?: string | null;
  isOem: boolean;
}

export interface VehicleMakeDto {
  id: string;
  nameFa: string;
  nameEn?: string | null;
  country?: string | null;
}

export interface VehicleModelDto {
  id: string;
  makeId: string;
  nameFa: string;
  vehicleType: string;
}

export interface VehicleVariantDto {
  id: string;
  modelId: string;
  nameFa: string;
  engine?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
}

export interface OfferSearchItem extends OfferDto {
  part: {
    id: string;
    nameFa: string;
    nameEn: string | null;
    technicalCode: string | null;
    oemCode: string | null;
    category: { id: string; nameFa: string } | null;
    brand: { id: string; nameFa: string; isOem: boolean } | null;
    image: string | null;
    unit: string;
  };
  branch: { id: string; name: string; city: string | null; lat: number | null; lng: number | null };
  sellerDetail: { id: string; verificationStatus: string; ratingCount: number; ratingAvg: number };
  listPrice: number | null;
  isGenuineClaimed: boolean;
  warrantyNote: string | null;
  returnPolicy: string | null;
  returnWindowDays: number;
  conditionNote: string | null;
  priceUpdatedAt: string | null;
  stockUpdatedAt: string | null;
  compatibility: { level: CompatibilityLevel; note: string | null };
  deliveryFeeBreakdown: Array<{ fa: string; amount: number }>;
  routeSource: string;
  sku: string | null;
  isFeatured: boolean;
  warnings: string[];
}

export interface PartDetailResponse {
  part: {
    id: string;
    nameFa: string;
    nameEn: string | null;
    technicalCode: string | null;
    oemCode: string | null;
    description: string | null;
    specs: Record<string, unknown>;
    images: string[];
    unit: string;
    defaultQuality: QualityGrade;
    category: { id: string; nameFa: string } | null;
    brand: { id: string; nameFa: string; isOem: boolean } | null;
    referencePrice: number | null;
  };
  offers: OfferSearchItem[];
  compatibilities: Array<{
    id: string;
    level: CompatibilityLevel;
    yearFrom: number | null;
    yearTo: number | null;
    engine: string | null;
    note: string | null;
    source: string | null;
  }>;
  related: Array<{ id: string; nameFa: string; technicalCode: string | null }>;
}

export interface WorkshopAddressDto {
  id: string;
  title: string;
  receiverName: string;
  phone: string;
  city: string | null;
  addressText: string;
  postalCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  isDefault: boolean;
}

export interface SavedVehicleDto {
  id: string;
  nickname?: string | null;
  modelId?: string | null;
  variantId?: string | null;
  freeMakeName?: string | null;
  freeModelName?: string | null;
  vehicleType: string;
  yearFrom?: number | null;
  engine?: string | null;
  gearbox?: string | null;
  plate?: string | null;
  vin?: string | null;
  isPrimary: boolean;
}

export interface OrderItemDto {
  id: string;
  sellerProductId: string | null;
  partId: string | null;
  nameFa: string;
  sku: string | null;
  technicalCode: string | null;
  brandName: string | null;
  quality: QualityGrade;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  returnedQuantity: number;
}

export interface OrderDetailDto {
  id: string;
  code: string;
  userId: string;
  sellerId: string;
  branchId: string;
  status: OrderStatus;
  source: 'direct' | 'quote';
  city: string | null;
  itemsSubtotal: number;
  deliveryFee: number;
  discountTotal: number;
  platformFee: number;
  payableTotal: number;
  couponCode: string | null;
  paymentStatus: PaymentStatus | null;
  paidAt: string | null;
  urgency: UrgencyLevel;
  notes: string | null;
  addressSnapshot: {
    receiverName?: string;
    phone?: string;
    city?: string | null;
    addressText?: string;
  } | null;
  vehicleSnapshot: {
    makeName?: string | null;
    modelName?: string | null;
    variantName?: string | null;
    year?: number | null;
    engine?: string | null;
    plate?: string | null;
  } | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  items: OrderItemDto[];
  allowedActions: Array<{ to: OrderStatus; fa: string; requiresReason?: boolean }>;
  breakdown: Array<{ fa: string; amount: number }>;
}

export interface OrderEventDto {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  faDescription: string;
  actorRole: string | null;
  reason: string | null;
  createdAt: string;
}

export interface TrackingDto {
  deliveryId: string;
  code: string;
  status: DeliveryStatus;
  statusFa: string;
  pickupPoint: { title: string; city: string | null; addressText: string; lat: number | null; lng: number | null };
  dropoffPoint: { title: string; receiverName: string; phoneMasked: string; addressText: string; lat: number | null; lng: number | null };
  courier: { name: string; phoneMasked: string; ratingAvg: number; vehicleType: string | null } | null;
  distanceKm: number | null;
  estimatedMinutes: number | null;
  routeSource: string;
  estimatedArrival: string | null;
  deliveryOtp: string | null;
  pickupCode: string | null;
  events: Array<{ at: string; fa: string; status: string }>;
  location: { lat: number; lng: number; recordedAt: string } | null;
  notice: string;
}

export interface PartRequestDto {
  id: string;
  code: string;
  status: RequestStatus;
  titleFa: string;
  partNameFa: string;
  technicalCode: string | null;
  oemCode: string | null;
  quantity: number;
  qualityPreference: QualityGrade | null;
  onlyGenuine: boolean;
  urgency: UrgencyLevel;
  description: string | null;
  city: string | null;
  quoteCount: number;
  deadlineAt: string | null;
  convertedOrderId: string | null;
  vehicleSnapshot?: {
    makeName?: string | null;
    modelName?: string | null;
    variantName?: string | null;
    year?: number | null;
    engine?: string | null;
    plate?: string | null;
  } | null;
  createdAt: string;
}

export interface QuoteComparisonRowDto {
  quoteId: string;
  sellerId: string;
  storeName: string;
  sellerRating: number;
  sellerRatingCount: number;
  city: string | null;
  branchName: string | null;
  distanceKm: number | null;
  routeSource: string;
  itemsTotal: number;
  deliveryFee: number;
  total: number;
  preparationMinutes: number;
  estimatedDeliveryMinutes: number | null;
  expectedReadyAt: string | null;
  expectedDeliveryAt: string | null;
  compatibility: CompatibilityLevel;
  compatibilityNote: string | null;
  hasSubstitute: boolean;
  validUntil: string | null;
  note: string | null;
  rank: number;
  explanation: RankExplanation | null;
  warnings: string[];
  items: Array<{
    id: string;
    nameFa: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    quality: QualityGrade;
    isSubstitute: boolean;
  }>;
  status: QuoteStatus;
  submittedAt: string | null;
}

export interface DeliveryMissionDto {
  id: string;
  code: string;
  orderId: string;
  status: DeliveryStatus;
  pickupPoint: { title?: string; city?: string; addressText: string; lat?: number | null; lng?: number | null };
  dropoffPoint: { title?: string; receiverName?: string; phone?: string; city?: string; addressText: string };
  city: string | null;
  distanceKm: number | null;
  estimatedMinutes: number | null;
  deliveryFee: number;
  courierShare: number;
  offerExpiresAt: string | null;
  isUrgent: boolean;
  lastFailureReason: string | null;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  channel: string;
  eventKey: string;
  titleFa: string;
  bodyFa: string;
  status: string;
  isSimulated: boolean;
  readAt: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface TicketDto {
  id: string;
  code: string;
  userId: string;
  subject: string;
  category: string;
  priority: string;
  status: TicketStatus;
  orderId: string | null;
  satisfactionRating: number | null;
  createdAt: string;
  messages?: Array<{
    id: string;
    senderId: string;
    senderRole: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
  }>;
}

export interface ReturnRequestDto {
  id: string;
  code?: string;
  orderId: string;
  quantity: number;
  reason: string;
  description: string | null;
  status: ReturnStatus;
  sellerNote?: string | null;
  resolutionNote?: string | null;
  refundAmount?: number | null;
  createdAt: string;
}

export interface AdminDashboardDto {
  generatedAt: string;
  users: { total: number; byRole: Record<string, number>; newToday: number; active: number; inactive: number };
  verifications: { seller: number; courier: number; workshop: number };
  catalog: { parts: number; activeOffers: number; outOfStockOffers: number; sellers: number; couriers: number; workshops: number };
  requests: { open: number; quoted: number; converted: number; expiredToday: number };
  orders: { total: number; byStatus: Record<string, number>; today: number; awaitingPayment: number; inProgress: number };
  money: {
    gmv: number;
    platformRevenue: number;
    sellerNet: number;
    courierShare: number;
    paidOut: number;
    pendingPayout: number;
    note: string;
  };
  payments: { count: number; success: number; failed: number; amountSuccess: number; sandboxActive: boolean };
  delivery: { total: number; delivered: number; failed: number; avgMinutes: number | null; waitingForCourier: number };
  support: { openTickets: number; openReturns: number };
  topSellers: Array<{ id: string; storeName: string; orders: number; revenue: number; platformRevenue: number }>;
  recentAudit: Array<{ at: string; action: string; fa: string; actor: string | null }>;
}

export interface RefundItemDto {
  id: string;
  orderId: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  note?: string | null;
  createdAt: string;
}

export interface PayoutItemDto {
  id: string;
  code?: string;
  recipientType: 'seller' | 'courier';
  recipientId: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  status: PayoutStatus;
  reference?: string | null;
  createdAt: string;
}

export interface UserSummaryDto {
  id: string;
  mobile: string;
  fullName: string;
  roles: Role[];
  city: string | null;
  isActive: boolean;
  isMobileVerified: boolean;
  createdAt: string;
}
