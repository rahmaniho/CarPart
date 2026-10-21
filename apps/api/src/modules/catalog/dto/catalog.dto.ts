import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
import { COMPATIBILITY_LEVELS, QUALITY_GRADES, type CompatibilityLevel, type QualityGrade } from '@carpart/contract';

export class CreateCategoryDto {
  @IsString()
  @Length(2, 160, { message: 'نام دسته‌بندی باید بین ۲ تا ۱۶۰ نویسه باشد.' })
  nameFa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEn?: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  icon?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateBrandDto {
  @IsString()
  @Length(2, 160, { message: 'نام برند باید بین ۲ تا ۱۶۰ نویسه باشد.' })
  nameFa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isOem?: boolean;
}

export class CreateVehicleMakeDto {
  @IsString()
  @Length(2, 160)
  nameFa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string;
}

export class CreateVehicleModelDto {
  @IsUUID('4')
  makeId!: string;

  @IsString()
  @Length(2, 160)
  nameFa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  bodyType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  yearFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  yearTo?: number;
}

export class CreateVehicleVariantDto {
  @IsUUID('4')
  modelId!: string;

  @IsString()
  @Length(2, 160)
  nameFa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  engine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  gearbox?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  yearFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  yearTo?: number;
}

export class CreatePartDto {
  @IsString()
  @Length(2, 200, { message: 'نام قطعه باید بین ۲ تا ۲۰۰ نویسه باشد.' })
  nameFa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameEn?: string;

  @IsUUID('4', { message: 'دسته‌بندی معتبر نیست.' })
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

  @IsOptional()
  specs?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsIn(QUALITY_GRADES as unknown as string[])
  defaultQuality?: QualityGrade;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minOrderQty?: number;

  @IsOptional()
  @IsBoolean()
  isCompatibilityCritical?: boolean;
}

export class UpdatePartDto extends CreatePartDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCompatibilityDto {
  @IsUUID('4')
  partId!: string;

  @IsOptional()
  @IsUUID('4')
  makeId?: string | null;

  @IsOptional()
  @IsUUID('4')
  modelId?: string | null;

  @IsOptional()
  @IsUUID('4')
  variantId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearTo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  engine?: string;

  @IsOptional()
  @IsIn(COMPATIBILITY_LEVELS as unknown as string[])
  level?: CompatibilityLevel;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsIn(['seller', 'admin', 'system'])
  source?: 'seller' | 'admin' | 'system';
}
