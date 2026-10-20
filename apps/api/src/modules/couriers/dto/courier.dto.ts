import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpsertCourierDto {
  @IsOptional()
  @IsString()
  @Length(3, 160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  nationalId?: string;

  @IsOptional()
  @IsIn(['motorcycle', 'car', 'pickup', 'van'], { message: 'نوع وسیله نقلیه معتبر نیست.' })
  vehicleType?: 'motorcycle' | 'car' | 'pickup' | 'van';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vehicleModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  vehiclePlate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  capacityKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  capacityLiters?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  serviceCity?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsArray()
  documents?: Array<{ kind: string; fileUrl: string }>;
}

export class UpdateAvailabilityDto {
  @IsIn(['online', 'offline'], { message: 'وضعیت باید online یا offline باشد.' })
  availability!: 'online' | 'offline';
}

export class UpdateLocationDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracyM?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(200)
  speedKmh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  deliveryId?: string;
}

export class CourierPayoutInfoDto {
  @IsString()
  @MaxLength(64)
  bankName!: string;

  @IsOptional()
  @Matches(/^IR\d{24}$/, { message: 'شبا باید با IR و ۲۴ رقم باشد.' })
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  accountNumber?: string;

  @IsString()
  @MaxLength(120)
  ownerName!: string;
}
