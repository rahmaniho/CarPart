import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QUALITY_GRADES, URGENCY_LEVELS, type QualityGrade, type UrgencyLevel } from '@carpart/contract';

export class RequestVehicleInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  freeMakeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  freeModelName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  variantName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  engine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  plate?: string;
}

export class CreatePartRequestDto {
  @IsString()
  @Length(3, 200, { message: 'نام قطعه باید بین ۳ تا ۲۰۰ نویسه باشد.' })
  partNameFa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleFa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  technicalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  oemCode?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @Type(() => Number)
  @IsInt({ message: 'تعداد باید عدد صحیح باشد.' })
  @Min(1, { message: 'تعداد حداقل ۱ است.' })
  @Max(1000)
  quantity!: number;

  @IsOptional()
  @IsIn(QUALITY_GRADES as unknown as string[])
  qualityPreference?: QualityGrade;

  @IsOptional()
  @IsBoolean()
  onlyGenuine?: boolean;

  @IsOptional()
  @IsIn(URGENCY_LEVELS as unknown as string[])
  urgency?: UrgencyLevel;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsUUID('4')
  vehicleId?: string;

  @IsOptional()
  @Type(() => RequestVehicleInfoDto)
  vehicleInfo?: RequestVehicleInfoDto;

  @IsOptional()
  @IsUUID('4')
  deliveryAddressId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'زمان موردنیاز معتبر نیست.' })
  neededBy?: string;
}

export class QuoteItemDto {
  /** پیشنهاد از محصول ثبت‌شده فروشگاه (اولویت اول) */
  @IsOptional()
  @IsUUID('4')
  sellerProductId?: string;

  /** پیشنهاد جایگزین با مشخصات دستی */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameFa?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;

  @Type(() => Number)
  @IsInt({ message: 'قیمت واحد باید عدد صحیح تومان باشد.' })
  @Min(0)
  @Max(10_000_000_000)
  unitPrice!: number;

  @IsOptional()
  @IsIn(QUALITY_GRADES as unknown as string[])
  quality?: QualityGrade;

  @IsOptional()
  @IsBoolean()
  isSubstitute?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreateQuoteDto {
  @IsArray()
  @ArrayMaxSize(10)
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4320)
  preparationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  supportsPlatformDelivery?: boolean;
}

export class DeclineQuoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
