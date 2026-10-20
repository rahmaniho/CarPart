import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import { AppException, ErrorCodes } from '../../common/errors/app-error';
import type { AccessTokenPayload, RequestUser } from '../../common/types/auth';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersRepository } from '../users/users.repository';
import { TokenService } from './token.service';

/**
 * استراتژی JWT.
 * توکن دسترسی فقط از هدر Authorization خوانده می‌شود و در هر درخواست وضعیت کاربر و نشست
 * از پایگاه‌داده بررسی می‌گردد تا ابطال نشست یا غیرفعال‌شدن حساب بلافاصله اثر کند.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(CONFIG_TOKEN) config: AppConfig,
    private readonly users: UsersRepository,
    private readonly profiles: ProfilesService,
    private readonly tokens: TokenService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.auth.accessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    if (payload?.typ !== 'access') {
      throw new AppException('توکن نامعتبر است.', ErrorCodes.TOKEN_INVALID, { statusCode: 401 });
    }
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new AppException('کاربر یافت نشد.', ErrorCodes.UNAUTHENTICATED, { statusCode: 401 });
    }
    if (!user.isActive) {
      throw new AppException('حساب کاربری غیرفعال است.', ErrorCodes.ACCOUNT_SUSPENDED, { statusCode: 403 });
    }
    const session = await this.tokens.findActiveSession(payload.sessionId);
    if (!session) {
      throw new AppException('نشست شما بسته شده است. دوباره وارد شوید.', ErrorCodes.TOKEN_INVALID, { statusCode: 401 });
    }
    return this.profiles.toRequestUser(user, session.id);
  }
}
