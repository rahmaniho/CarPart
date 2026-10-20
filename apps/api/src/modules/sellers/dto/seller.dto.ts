import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QUALITY_GRADES, type QualityGrade } from '@carpart/contract';

export class UpsertSellerDto {
  @IsString()
  @Length(3, 200, { message: 'نام فروشگاه باید بین ۳ تا ۲۰۰ نویسه باشد.' })
  storeName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  nationalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxCode?: string;

  @IsOptional()
  @Matches(/^(09\d{9}|0\d{2,3}\d{7,8})$/, { message: 'شماره تماس معتبر نیست.' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  documents?: Array<{ kind: string; fileUrl: string }>;

  @IsOptional()
  @IsObject()
  payoutInfo?: { bankName?: string; accountNumber?: string; iban?: string; cardNumber?: string; ownerName?: string };
}

export class BusinessHourDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  day!: number;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'ساعت باید با قالب HH:MM باشد.' })
  open?: string | null;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'ساعت باید با قالب HH:MM باشد.' })
  close?: string | null;

  @IsOptional()
  @IsBoolean()
  closed?: boolean;
}

export class UpsertBranchDto {
  @IsString()
  @Length(3, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsOptional()
  @IsString()
  addressText?: string;

  @IsOptional()
  @Matches(/^(09\d{9}|0\d{2,3}\d{7,8})$/, { message: 'شماره تماس معتبر نیست.' })
  phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(300)
  serviceRadiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  prepTimeMinutes?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDto)
  businessHours?: BusinessHourDto[];

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class NewPartDto {
  @IsString()
  @Length(2, 200)
  nameFa!: string;

  @IsUUID('4')
  categoryId!: string;

  @IsOptional()
  @IsUUID('4')
  brandId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  technicalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  oemCode?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateProductDto {
  /** شناسه قطعه موجود در کاتالوگ — یا از newPart استفاده کنید */
  @IsOptional()
  @IsUUID('4')
  partId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NewPartDto)
  newPart?: NewPartDto;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  sku?: string;

  @Type(() => Number)
  @IsInt({ message: 'قیمت باید عدد صحیح تومان باشد.' })
  @Min(0, { message: 'قیمت نمی‌تواند منفی باشد.' })
  @Max(10_000_000_000)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  listPrice?: number | null;

  @Type(() => Number)
  @IsInt({ message: 'موجودی باید عدد صحیح باشد.' })
  @Min(0)
  @Max(1_000_000)
  stock!: number;

  @IsOptional()
  @IsIn(QUALITY_GRADES as unknown as string[])
  quality?: QualityGrade;

  @IsOptional()
  @IsBoolean()
  isGenuineClaimed?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4320)
  preparationMinutes?: number;

  @IsOptional()
  @IsString()
  warrantyNote?: string;

  @IsOptional()
  @IsString()
  returnPolicy?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  returnWindowDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  conditionNote?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto extends CreateProductDto {}

export class UpdateStockDto {
  /** یکی از دو فیلد delta یا absoluteStock */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  delta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  absoluteStock?: number;

  @IsIn(['initial', 'restock', 'adjustment', 'return'], { message: 'دلیل تغییر موجودی معتبر نیست.' })
  reason!: 'initial' | 'restock' | 'adjustment' | 'return';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdatePriceDto {
  @Type(() => Number)
  @IsInt({ message: 'قیمت باید عدد صحیح تومان باشد.' })
  @Min(0)
  @Max(10_000_000_000)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  listPrice?: number | null;
}

export class PayoutInfoDto {
  @IsString()
  @MaxLength(64)
  bankName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  accountNumber?: string;

  @IsOptional()
  @Matches(/^IR\d{24}$/, { message: 'شبا باید با IR و ۲۴ رقم باشد.' })
  iban?: string;

  @IsString()
  @MaxLength(120)
  ownerName!: string;
}
