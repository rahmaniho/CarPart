import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Role } from '@carpart/contract';
import { ROLES } from '@carpart/contract';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'حداقل یک نقش باید انتخاب شود.' })
  @IsIn(ROLES as unknown as string[], { each: true, message: 'نقش نامعتبر است.' })
  roles?: Role[];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
