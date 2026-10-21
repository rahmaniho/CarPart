import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { NotificationChannel } from '@carpart/contract';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(3, 160, { message: 'نام باید بین ۳ تا ۱۶۰ نویسه باشد.' })
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'ایمیل معتبر نیست.' })
  @MaxLength(200)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;

  @IsOptional()
  @Type(() => Object)
  preferences?: {
    channels?: NotificationChannel[];
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
  };
}
