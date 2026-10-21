import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsNull } from 'typeorm';
import type { Role } from '@carpart/contract';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import { AppException, ErrorCodes } from '../../common/errors/app-error';
import { hashToken } from '../../common/utils/crypto';
import { randomToken } from '../../common/utils/id';
import type { AccessTokenPayload } from '../../common/types/auth';
import { User } from '../users/entities/user.entity';
import { UserSession } from '../users/entities/user-session.entity';
import { UsersRepository } from '../users/users.repository';

export interface IssuedTokens {
  userId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
  sessionId: string;
}

export interface SessionMeta {
  ip?: string | null;
  deviceInfo?: string | null;
}

/** مدیریت توکن‌ها و نشست‌ها: صدور، چرخش (rotation) و ابطال. */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersRepository,
    @Inject(CONFIG_TOKEN) private readonly config: AppConfig,
  ) {}

  async issue(user: User, meta: SessionMeta = {}): Promise<IssuedTokens> {
    // Generate the unique value before INSERT. A shared temporary value such as
    // "pending" violates the unique index when different users log in concurrently
    // on PostgreSQL, and creates an avoidable two-write exposure window.
    const refreshToken = randomToken(48);
    const session = this.users.sessionRepo.create({
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      ip: meta.ip ?? null,
      deviceInfo: meta.deviceInfo ?? null,
      expiresAt: new Date(Date.now() + this.config.auth.refreshTtlDays * 86_400_000),
    });
    const saved = await this.users.sessionRepo.save(session);

    const accessToken = await this.signAccess(user, saved.id);
    return {
      userId: user.id,
      accessToken,
      refreshToken,
      accessExpiresIn: this.config.auth.accessTtlSeconds,
      refreshExpiresIn: this.config.auth.refreshTtlDays * 86_400,
      sessionId: saved.id,
    };
  }

  private async signAccess(user: User, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      mobile: user.mobile,
      roles: (user.roles ?? []) as Role[],
      sessionId,
      typ: 'access',
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.auth.accessSecret,
      expiresIn: this.config.auth.accessTtlSeconds,
    });
  }

  async verifyAccess(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.config.auth.accessSecret });
    } catch (error) {
      const name = (error as Error).name;
      if (name === 'TokenExpiredError') {
        throw new AppException('نشست شما منقضی شده است. دوباره وارد شوید.', ErrorCodes.TOKEN_EXPIRED, { statusCode: 401 });
      }
      throw new AppException('توکن ورود معتبر نیست.', ErrorCodes.TOKEN_INVALID, { statusCode: 401 });
    }
  }

  /**
   * چرخش رفرش توکن.
   * اگر توکنی که قبلاً ابطال شده دوباره استفاده شود (نشانه سرقت توکن)،
   * همه نشست‌های آن کاربر باطل می‌شود.
   */
  async rotate(refreshToken: string, meta: SessionMeta = {}): Promise<IssuedTokens> {
    if (!refreshToken) {
      throw new AppException('توکن نشست ارائه نشده است.', ErrorCodes.UNAUTHENTICATED, { statusCode: 401 });
    }
    const tokenHash = hashToken(refreshToken);
    const session = await this.users.sessionRepo.findOne({ where: { refreshTokenHash: tokenHash } });
    if (!session) {
      throw new AppException('نشست معتبر نیست. دوباره وارد شوید.', ErrorCodes.TOKEN_INVALID, { statusCode: 401 });
    }
    if (session.revokedAt) {
      await this.revokeAllForUser(session.userId, 'استفاده مجدد از توکن باطل‌شده');
      throw new AppException('این نشست پیش‌تر بسته شده است. برای امنیت، همه نشست‌ها بسته شدند.', ErrorCodes.TOKEN_INVALID, {
        statusCode: 401,
      });
    }
    if (session.expiresAt.getTime() < Date.now()) {
      session.revokedAt = new Date();
      session.revokeReason = 'انقضا';
      await this.users.sessionRepo.save(session);
      throw new AppException('نشست شما منقضی شده است.', ErrorCodes.TOKEN_EXPIRED, { statusCode: 401 });
    }
    const user = await this.users.findById(session.userId);
    if (!user || !user.isActive) {
      throw new AppException('حساب کاربری فعال نیست.', ErrorCodes.ACCOUNT_SUSPENDED, { statusCode: 403 });
    }

    // ابطال نشست قبلی و صدور نشست جدید (rotation)
    session.revokedAt = new Date();
    session.revokeReason = 'چرخش توکن';
    await this.users.sessionRepo.save(session);
    return this.issue(user, meta);
  }

  async revoke(sessionId: string, reason = 'خروج کاربر'): Promise<void> {
    const session = await this.users.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session || session.revokedAt) return;
    session.revokedAt = new Date();
    session.revokeReason = reason;
    await this.users.sessionRepo.save(session);
  }

  async revokeAllForUser(userId: string, reason: string): Promise<number> {
    const result = await this.users.sessionRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokeReason: reason },
    );
    this.logger.warn(`همه نشست‌های کاربر ${userId} به دلیل «${reason}» باطل شد.`);
    return result.affected ?? 0;
  }

  async findActiveSession(sessionId: string): Promise<UserSession | null> {
    const session = await this.users.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) return null;
    session.lastUsedAt = new Date();
    await this.users.sessionRepo.save(session);
    return session;
  }
}
