import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const TICKET_CATEGORIES = [
  'general',
  'order',
  'payment',
  'delivery',
  'part_mismatch',
  'seller',
  'courier',
  'technical',
] as const;

export class CreateTicketDto {
  @IsString()
  @Length(5, 160, { message: 'موضوع باید بین ۵ تا ۱۶۰ نویسه باشد.' })
  subject!: string;

  @IsIn(TICKET_CATEGORIES as unknown as string[])
  category!: (typeof TICKET_CATEGORIES)[number];

  @IsString()
  @Length(10, 4000, { message: 'شرح درخواست باید حداقل ۱۰ نویسه باشد.' })
  body!: string;

  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @IsUUID('4')
  deliveryId?: string;

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'critical'])
  priority?: 'low' | 'normal' | 'high' | 'critical';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  attachments?: string[];
}

export class ReplyTicketDto {
  @IsString()
  @Length(2, 4000)
  body!: string;

  /** یادداشت داخلی فقط برای کارکنان پشتیبانی */
  @IsOptional()
  isInternal?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  attachments?: string[];
}

export class AssignTicketDto {
  @IsOptional()
  @IsUUID('4')
  assignedTo?: string;

  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED';
}

export class RateTicketDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  satisfactionRating!: number;
}

export const RETURN_REASONS = [
  'mismatch',
  'defective',
  'wrong_part',
  'damaged',
  'not_needed',
  'late_delivery',
  'other',
] as const;

export class CreateReturnDto {
  @IsUUID('4')
  orderId!: string;

  @IsOptional()
  @IsUUID('4')
  orderItemId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  quantity!: number;

  @IsIn(RETURN_REASONS as unknown as string[])
  reason!: (typeof RETURN_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  images?: string[];
}

export class RespondReturnDto {
  @IsIn(['APPROVED', 'REJECTED'], { message: 'پاسخ فروشنده باید APPROVED یا REJECTED باشد.' })
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ResolveReturnDto {
  @IsIn(['RECEIVED', 'REFUNDED', 'CLOSED'], { message: 'وضعیت نامعتبر است.' })
  status!: 'RECEIVED' | 'REFUNDED' | 'CLOSED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  refundAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
