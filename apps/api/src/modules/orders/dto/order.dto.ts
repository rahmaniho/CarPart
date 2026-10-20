import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ORDER_STATUSES, URGENCY_LEVELS, type OrderStatus, type UrgencyLevel } from '@carpart/contract';

export class OrderItemInputDto {
  @IsUUID('4', { message: 'شناسه محصول معتبر نیست.' })
  sellerProductId!: string;

  @Type(() => Number)
  @IsInt({ message: 'تعداد باید عدد صحیح باشد.' })
  @Min(1, { message: 'تعداد حداقل ۱ است.' })
  @Max(500)
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @IsOptional()
  @IsUUID('4')
  deliveryAddressId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  couponCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsIn(URGENCY_LEVELS as unknown as string[])
  urgency?: UrgencyLevel;

  @IsOptional()
  @IsUUID('4')
  vehicleId?: string;

  /** اگر true باشد، سفارش به‌صورت پیش‌نویس (سبد) ذخیره می‌شود */
  @IsOptional()
  saveAsDraft?: boolean;
}

export class TransitionOrderDto {
  @IsIn(ORDER_STATUSES as unknown as string[], { message: 'وضعیت نامعتبر است.' })
  to!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CancelOrderDto {
  @IsString({ message: 'دلیل لغو الزامی است.' })
  @MaxLength(500)
  reason!: string;
}

export class ListOrdersQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsIn([...ORDER_STATUSES, 'all', 'active'] as string[])
  status?: OrderStatus | 'all' | 'active';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class CompleteOrderReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  sellerRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  courierRating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
