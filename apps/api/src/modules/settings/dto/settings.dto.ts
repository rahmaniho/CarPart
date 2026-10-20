import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  /** مقدار جدید — رشته‌ای ارسال می‌شود و بر اساس valueType اعتبارسنجی می‌گردد */
  @IsString()
  @MaxLength(2000)
  value!: string;
}

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  audienceRoles?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(16)
  tone?: 'info' | 'success' | 'warning' | 'danger';

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  isActive?: boolean;
}
