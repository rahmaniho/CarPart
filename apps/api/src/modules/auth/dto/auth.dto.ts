import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import type { Role } from '@carpart/contract';

export const REGISTERABLE_ROLES: Role[] = ['mechanic', 'seller', 'courier'];

export class RegisterDto {
  @IsString({ message: 'شماره موبایل الزامی است.' })
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.' })
  mobile!: string;

  @IsString({ message: 'نام و نام خانوادگی الزامی است.' })
  @Length(3, 160, { message: 'نام باید بین ۳ تا ۱۶۰ نویسه باشد.' })
  fullName!: string;

  @IsIn(REGISTERABLE_ROLES as unknown as string[], { message: 'نقش انتخابی معتبر نیست.' })
  role!: Role;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ نویسه باشد.' })
  @Matches(/^(?=.*[a-zA-Z\u0600-\u06FF])(?=.*\d).+$/, {
    message: 'رمز عبور باید حداقل شامل یک حرف و یک رقم باشد.',
  })
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  workshopName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  storeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean;
}

export class LoginDto {
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست.' })
  mobile!: string;

  @IsString({ message: 'رمز عبور الزامی است.' })
  password!: string;
}

export class OtpRequestDto {
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست.' })
  mobile!: string;

  @IsOptional()
  @IsIn(['login', 'mobile_verify', 'password_reset'])
  purpose?: 'login' | 'mobile_verify' | 'password_reset';
}

export class OtpVerifyDto {
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست.' })
  mobile!: string;

  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'کد تأیید باید ۴ تا ۸ رقم باشد.' })
  code!: string;

  @IsOptional()
  @IsIn(['login', 'mobile_verify', 'password_reset'])
  purpose?: 'login' | 'mobile_verify' | 'password_reset';
}

export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
