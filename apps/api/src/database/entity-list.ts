/**
 * فهرست صریح موجودیت‌ها.
 * فهرست صریح (به‌جای glob) تا هم در محیط توسعه با tsx و هم در خروجی build شده به‌طور یکسان کار کند.
 */
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { PartBrand } from '../modules/catalog/entities/part-brand.entity';
import { PartCategory } from '../modules/catalog/entities/part-category.entity';
import { PartCompatibility } from '../modules/catalog/entities/part-compatibility.entity';
import { Part } from '../modules/catalog/entities/part.entity';
import { VehicleMake, VehicleModel, VehicleVariant } from '../modules/catalog/entities/vehicle-catalog.entity';
import { CouponRedemption } from '../modules/coupons/entities/coupon-redemption.entity';
import { Coupon } from '../modules/coupons/entities/coupon.entity';
import { CourierLocation } from '../modules/couriers/entities/courier-location.entity';
import { CourierProfile } from '../modules/couriers/entities/courier-profile.entity';
import { DeliveryEvent } from '../modules/delivery/entities/delivery-event.entity';
import { Delivery } from '../modules/delivery/entities/delivery.entity';
import { FileAsset } from '../modules/files/entities/file-asset.entity';
import { Commission } from '../modules/finance/entities/commission.entity';
import { PayoutLine } from '../modules/finance/entities/payout-line.entity';
import { Payout } from '../modules/finance/entities/payout.entity';
import { IdempotencyRecord } from '../modules/idempotency/entities/idempotency-record.entity';
import { Job } from '../modules/jobs/entities/job.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { DeviceToken } from '../modules/notifications/entities/device-token.entity';
import { OrderEvent } from '../modules/orders/entities/order-event.entity';
import { OrderItem } from '../modules/orders/entities/order-item.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { PaymentEvent } from '../modules/payments/entities/payment-event.entity';
import { Payment } from '../modules/payments/entities/payment.entity';
import { Refund } from '../modules/payments/entities/refund.entity';
import { QuoteItem } from '../modules/requests/entities/quote-item.entity';
import { Quote } from '../modules/requests/entities/quote.entity';
import { PartRequest } from '../modules/requests/entities/part-request.entity';
import { Review } from '../modules/reviews/entities/review.entity';
import { InventoryMovement } from '../modules/sellers/entities/inventory-movement.entity';
import { SellerBranch } from '../modules/sellers/entities/seller-branch.entity';
import { SellerProduct } from '../modules/sellers/entities/seller-product.entity';
import { Seller } from '../modules/sellers/entities/seller.entity';
import { Announcement } from '../modules/settings/entities/announcement.entity';
import { SystemSetting } from '../modules/settings/entities/system-setting.entity';
import { ReturnRequest } from '../modules/support/entities/return-request.entity';
import { SupportTicket } from '../modules/support/entities/support-ticket.entity';
import { TicketMessage } from '../modules/support/entities/ticket-message.entity';
import { OtpCode } from '../modules/users/entities/otp-code.entity';
import { UserSession } from '../modules/users/entities/user-session.entity';
import { User } from '../modules/users/entities/user.entity';
import { Favorite } from '../modules/workshops/entities/favorite.entity';
import { Vehicle } from '../modules/workshops/entities/vehicle.entity';
import { WorkshopAddress } from '../modules/workshops/entities/workshop-address.entity';
import { Workshop } from '../modules/workshops/entities/workshop.entity';

export const ENTITIES: Function[] = [
  User,
  UserSession,
  OtpCode,
  AuditLog,
  SystemSetting,
  Announcement,
  Notification,
  DeviceToken,
  Job,
  FileAsset,
  Workshop,
  WorkshopAddress,
  Vehicle,
  Favorite,
  PartCategory,
  PartBrand,
  VehicleMake,
  VehicleModel,
  VehicleVariant,
  Part,
  PartCompatibility,
  Seller,
  SellerBranch,
  SellerProduct,
  InventoryMovement,
  CourierProfile,
  CourierLocation,
  PartRequest,
  Quote,
  QuoteItem,
  Order,
  OrderItem,
  OrderEvent,
  Payment,
  PaymentEvent,
  Refund,
  Commission,
  Payout,
  PayoutLine,
  Delivery,
  DeliveryEvent,
  Review,
  SupportTicket,
  TicketMessage,
  ReturnRequest,
  Coupon,
  CouponRedemption,
  IdempotencyRecord,
];
