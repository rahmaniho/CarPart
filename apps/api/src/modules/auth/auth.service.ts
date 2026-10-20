import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeIranMobile, permissionsOf } from '@carpart/contract';
import type { CurrentUserDto, Role } from '@carpart/contract';
import { AppException, ErrorCodes, ConflictException } from '../../common/errors/app-error';
import { hashPassword, verifyPassword } from '../../common/utils/crypto';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { ProfilesService } from '../profiles/profiles.service';
import { Seller } from '../sellers/entities/seller.entity';
import { User } from '../users/entities/user.entity';
import { UsersRepository } from '../users/users.repository';
import { Workshop } from '../workshops/entities/workshop.entity';
import { LoginDto, OtpRequestDto, OtpVerifyDto, RegisterDto } from './dto/auth.dto';
import { OtpService } from './otp.service';
import { TokenService, type IssuedTokens, type SessionMeta } from './token.service';

export interface AuthResult {
  user: CurrentUserDto;
  tokens: IssuedTokens;
  requiresMobileVerification: boolean;
}

export interface RegisterResult {
  userId: string;
  mobile: string;
  fullName: string;
  role: Role;
  requiresOtpVerification: true;
  otp: { expiresIn: number; simulated: boolean; devCode?: string; notice: string };
}

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly profiles: ProfilesService,
    @InjectRepository(Workshop) private readonly workshops: Repository<Workshop>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
  ) {}

  private toDto(user: User): CurrentUserDto {
    return {
      id: user.id,
      mobile: user.mobile,
      fullName: user.fullName,
      roles: user.roles ?? [],
      permissions: permissionsOf(user.roles ?? []),
      email: user.email ?? null,
      isActive: user.isActive,
      city: user.city ?? null,
    };
  }

  /** ثبت‌نام: ساخت کاربر + پروفایل اولیه + ارسال کد تأیید موبایل. */
  async register(dto: RegisterDto, meta: SessionMeta = {}): Promise<RegisterResult> {
    const mobile = normalizeIranMobile(dto.mobile);
    if (!mobile) {
      throw new AppException('شماره موبایل معتبر نیست.', ErrorCodes.VALIDATION_FAILED);
    }
    const existing = await this.users.findByMobile(mobile);
    if (existing) {
      throw new ConflictException('این شماره موبایل پیش‌تر ثبت شده است. وارد شوید یا کد تأیید دریافت کنید.', ErrorCodes.MOBILE_ALREADY_REGISTERED);
    }

    const roles: Role[] = [dto.role];
    const user = await this.users.create({
      mobile,
      fullName: dto.fullName.trim(),
      roles,
      city: dto.city ?? null,
      isMobileVerified: false,
      isActive: true,
      passwordHash: dto.password ? await hashPassword(dto.password) : null,
      preferences: { channels: ['inapp', 'sms'], language: 'fa' },
    });

    await this.createProfileSkeleton(user, dto);

    const otpResult = await this.otp.request(mobile, 'mobile_verify', meta.ip ?? null);
    this.logger.log(`کاربر جدید ثبت شد: ${user.id} با نقش ${dto.role}`);

    return {
      userId: user.id,
      mobile: user.mobile,
      fullName: user.fullName,
      role: dto.role,
      requiresOtpVerification: true,
      otp: {
        expiresIn: otpResult.expiresIn,
        simulated: otpResult.simulated,
        devCode: otpResult.devCode,
        notice: otpResult.notice,
      },
    };
  }

  /** ساخت پروفایل اولیه متناسب با نقش (وضعیت تأیید: پیش‌نویس). */
  private async createProfileSkeleton(user: User, dto: RegisterDto): Promise<void> {
    if (dto.role === 'mechanic') {
      await this.workshops.save(
        this.workshops.create({
          userId: user.id,
          name: dto.workshopName?.trim() || `${user.fullName} — تعمیرگاه`,
          ownerName: user.fullName,
          phone: user.mobile,
          city: user.city,
          verificationStatus: 'DRAFT',
          isActive: true,
        }),
      );
      return;
    }
    if (dto.role === 'seller') {
      await this.sellers.save(
        this.sellers.create({
          userId: user.id,
          storeName: dto.storeName?.trim() || `${user.fullName} — فروشگاه لوازم یدکی`,
          phone: user.mobile,
          email: user.email,
          city: user.city,
          verificationStatus: 'DRAFT',
          isActive: true,
        }),
      );
      return;
    }
    await this.couriers.save(
      this.couriers.create({
        userId: user.id,
        verificationStatus: 'DRAFT',
        serviceCity: user.city,
        availability: 'offline',
        isActive: true,
      }),
    );
  }

  /** ورود با رمز عبور. */
  async login(dto: LoginDto, meta: SessionMeta = {}): Promise<AuthResult> {
    const mobile = normalizeIranMobile(dto.mobile);
    if (!mobile) throw new AppException('شماره موبایل معتبر نیست.', ErrorCodes.VALIDATION_FAILED);
    const user = await this.users.findByMobileWithPassword(mobile);
    if (!user) {
      // یکسان‌سازی زمان پاسخ برای جلوگیری از کشف وجود حساب
      await hashPassword('timing-equalizer');
      throw new AppException('شماره موبایل یا رمز عبور نادرست است.', ErrorCodes.UNAUTHENTICATED, { statusCode: 401 });
    }
    if (!user.isActive) {
      throw new AppException('حساب کاربری شما غیرفعال است. با پشتیبانی تماس بگیرید.', ErrorCodes.ACCOUNT_SUSPENDED, { statusCode: 403 });
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new AppException(`به دلیل تلاش‌های ناموفق، حساب تا ${minutes} دقیقه قفل است.`, ErrorCodes.RATE_LIMITED, {
        statusCode: 429,
      });
    }
    if (!user.passwordHash) {
      throw new AppException('برای این حساب رمز عبور تنظیم نشده است. با کد یکبارمصرف وارد شوید.', ErrorCodes.VALIDATION_FAILED, {
        statusCode: 400,
      });
    }
    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      user.failedLoginCount = (user.failedLoginCount ?? 0) + 1;
      if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
        user.failedLoginCount = 0;
      }
      await this.users.save(user);
      throw new AppException('شماره موبایل یا رمز عبور نادرست است.', ErrorCodes.UNAUTHENTICATED, { statusCode: 401 });
    }

    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await this.users.save(user);

    const tokens = await this.tokens.issue(user, meta);
    const detail = await this.profiles.toRequestUser(user, tokens.sessionId);
    return {
      user: { ...this.toDto(user), profileId: detail.profileId, profileKind: detail.profileKind, verificationStatus: detail.verificationStatus },
      tokens,
      requiresMobileVerification: !user.isMobileVerified,
    };
  }

  /** درخواست کد یکبارمصرف. */
  async requestOtp(dto: OtpRequestDto, meta: SessionMeta = {}) {
    const mobile = normalizeIranMobile(dto.mobile);
    if (!mobile) throw new AppException('شماره موبایل معتبر نیست.', ErrorCodes.VALIDATION_FAILED);
    const purpose = dto.purpose ?? 'login';
    if (purpose === 'login' || purpose === 'password_reset') {
      const user = await this.users.findByMobile(mobile);
      if (!user) {
        throw new AppException('حسابی با این شماره موبایل ثبت نشده است. ابتدا ثبت‌نام کنید.', ErrorCodes.NOT_FOUND, { statusCode: 404 });
      }
      if (!user.isActive) {
        throw new AppException('حساب کاربری غیرفعال است.', ErrorCodes.ACCOUNT_SUSPENDED, { statusCode: 403 });
      }
    }
    return this.otp.request(mobile, purpose, meta.ip ?? null);
  }

  /** ورود یا تأیید موبایل با کد یکبارمصرف. */
  async verifyOtp(dto: OtpVerifyDto, meta: SessionMeta = {}): Promise<AuthResult> {
    const mobile = normalizeIranMobile(dto.mobile);
    if (!mobile) throw new AppException('شماره موبایل معتبر نیست.', ErrorCodes.VALIDATION_FAILED);
    const purpose = dto.purpose ?? 'login';
    await this.otp.verify(mobile, dto.code, purpose);

    const user = await this.users.findByMobile(mobile);
    if (!user) {
      throw new AppException('حسابی با این شماره موبایل یافت نشد.', ErrorCodes.NOT_FOUND, { statusCode: 404 });
    }
    if (!user.isActive) {
      throw new AppException('حساب کاربری غیرفعال است.', ErrorCodes.ACCOUNT_SUSPENDED, { statusCode: 403 });
    }
    if (!user.isMobileVerified) {
      user.isMobileVerified = true;
    }
    user.lastLoginAt = new Date();
    await this.users.save(user);

    const tokens = await this.tokens.issue(user, meta);
    const detail = await this.profiles.toRequestUser(user, tokens.sessionId);
    return {
      user: { ...this.toDto(user), profileId: detail.profileId, profileKind: detail.profileKind, verificationStatus: detail.verificationStatus },
      tokens,
      requiresMobileVerification: false,
    };
  }

  async refresh(refreshToken: string, meta: SessionMeta = {}): Promise<AuthResult> {
    const tokens = await this.tokens.rotate(refreshToken, meta);
    const user = await this.users.findById(tokens.userId);
    if (!user) throw new AppException('کاربر یافت نشد.', ErrorCodes.UNAUTHENTICATED, { statusCode: 401 });
    const detail = await this.profiles.toRequestUser(user, tokens.sessionId);
    return {
      user: { ...this.toDto(user), profileId: detail.profileId, profileKind: detail.profileKind, verificationStatus: detail.verificationStatus },
      tokens,
      requiresMobileVerification: !user.isMobileVerified,
    };
  }

  async logout(sessionId: string): Promise<{ ok: true }> {
    await this.tokens.revoke(sessionId, 'خروج کاربر');
    return { ok: true };
  }

  async me(userId: string): Promise<CurrentUserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('کاربر یافت نشد.', ErrorCodes.UNAUTHENTICATED, { statusCode: 401 });
    const detail = await this.profiles.toRequestUser(user, 'n/a');
    return {
      ...this.toDto(user),
      profileId: detail.profileId,
      profileKind: detail.profileKind,
      verificationStatus: detail.verificationStatus,
      isActive: detail.isActive,
      city: detail.city ?? user.city ?? null,
    };
  }
}
