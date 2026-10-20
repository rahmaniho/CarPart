import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Role } from '@carpart/contract';
import { ROLES } from '@carpart/contract';

export class CreateCouponDto {
  @IsString()
  @MaxLength(48)
  code!: string;

  @IsIn(['percent', 'fixed'], { message: 'نوع کوپن باید percent یا fixed باشد.' })
  type!: 'percent' | 'fixed';

  @Type(() => Number)
  @IsInt({ message: 'مقدار کوپن باید عدد صحیح باشد (درصد یا تومان).' })
  @Min(1)
  value!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsArray()
  @IsIn(ROLES as unknown as string[], { each: true })
  audienceRoles?: Role[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ValidateCouponDto {
  @IsString()
  @MaxLength(48)
  code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  itemsSubtotal!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;
}
