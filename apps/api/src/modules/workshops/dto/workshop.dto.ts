import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VEHICLE_TYPES, type VehicleType } from '@carpart/contract';

export class UpsertWorkshopDto {
  @IsString()
  @Length(3, 200, { message: 'نام تعمیرگاه باید بین ۳ تا ۲۰۰ نویسه باشد.' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  ownerName?: string;

  @IsOptional()
  @Matches(/^(09\d{9}|0\d{2,3}\d{7,8})$/, { message: 'شماره تماس معتبر نیست.' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  nationalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsOptional()
  @IsString()
  addressText?: string;

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
  @IsString()
  @MaxLength(300)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];
}

export class UpsertAddressDto {
  @IsString()
  @Length(2, 100, { message: 'عنوان آدرس باید بین ۲ تا ۱۰۰ نویسه باشد.' })
  title!: string;

  @IsString()
  @Length(3, 160)
  receiverName!: string;

  @IsString()
  @Length(8, 20, { message: 'شماره تماس معتبر نیست.' })
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsString()
  @Length(10, 1000, { message: 'آدرس باید حداقل ۱۰ نویسه باشد.' })
  addressText!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  postalCode?: string;

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
  @IsBoolean()
  isDefault?: boolean;
}

export class UpsertVehicleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string;

  @IsOptional()
  @IsUUID('4')
  modelId?: string | null;

  @IsOptional()
  @IsUUID('4')
  variantId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  freeMakeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  freeModelName?: string;

  @IsOptional()
  @IsIn(VEHICLE_TYPES as unknown as string[], { message: 'نوع خودرو معتبر نیست.' })
  vehicleType?: VehicleType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  yearFrom?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  yearTo?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  engine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  gearbox?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  plate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  vin?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ToggleFavoriteDto {
  @IsString()
  kind!: 'part' | 'seller' | 'product' | 'request';

  @IsUUID('4')
  refId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  snapshot?: Record<string, unknown>;
}
