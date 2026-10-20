import { Type } from 'class-transformer';
import { IsBooleanString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { QUALITY_GRADES, type QualityGrade } from '@carpart/contract';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsUUID('4')
  brandId?: string;

  @IsOptional()
  @IsUUID('4')
  makeId?: string;

  @IsOptional()
  @IsUUID('4')
  modelId?: string;

  @IsOptional()
  @IsUUID('4')
  variantId?: string;

  /** خودرو ذخیره‌شده کاربر — اگر داده شود، سازگاری بر اساس آن محاسبه می‌شود */
  @IsOptional()
  @IsUUID('4')
  vehicleId?: string;

  @IsOptional()
  @IsIn(QUALITY_GRADES as unknown as string[])
  quality?: QualityGrade;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  radiusKm?: number;

  @IsOptional()
  @IsBooleanString()
  inStockOnly?: string;

  @IsOptional()
  @IsBooleanString()
  includeIncompatible?: string;

  @IsOptional()
  @IsIn(['rank', 'price_asc', 'price_desc', 'distance', 'newest', 'rating'])
  sort?: 'rank' | 'price_asc' | 'price_desc' | 'distance' | 'newest' | 'rating' = 'rank';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
