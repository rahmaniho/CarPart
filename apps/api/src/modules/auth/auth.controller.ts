import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AppException, ErrorCodes } from '../../common/errors/app-error';
import type { RequestUser } from '../../common/types/auth';
import { AuthService } from './auth.service';
import { LoginDto, OtpRequestDto, OtpVerifyDto, RegisterDto, RefreshDto } from './dto/auth.dto';

const REFRESH_COOKIE = 'carpart_rt';

@ApiTags('احراز هویت')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(CONFIG_TOKEN) private readonly config: AppConfig,
  ) {}

  private meta(req: Request) {
    return {
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null,
      deviceInfo: (req.headers['user-agent'] as string)?.slice(0, 60) ?? null,
    };
  }

  /** آیا درخواست از پوسته نیتیو معتبر آمده؟ (وب هرگز refreshToken را در body نمی‌گیرد) */
  private isNativeClient(req: Request): boolean {
    const platform = String(req.headers['x-client-platform'] ?? '').toLowerCase();
    return platform === 'android' || platform === 'ios';
  }

  private nativeRefresh(req: Request, token: string): { refreshToken: string } | Record<string, never> {
    return this.isNativeClient(req) ? { refreshToken: token } : {};
  }

  /** کوکی رفرش: فقط httpOnly، SameSite=Strict و در تولید Secure. */
  private setRefreshCookie(res: Response, refreshToken: string, maxAgeSeconds: number): void {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.app.isProduction,
      path: '/api/v1/auth',
      maxAge: maxAgeSeconds * 1000,
    });
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @ApiOperation({ summary: 'ثبت‌نام کاربر جدید (مکانیک/فروشنده/پیک) + ارسال کد تأیید موبایل' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.meta(req));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @ApiOperation({ summary: 'ورود با شماره موبایل و رمز عبور' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, this.meta(req));
    this.setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshExpiresIn);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      accessExpiresIn: result.tokens.accessExpiresIn,
      ...this.nativeRefresh(req, result.tokens.refreshToken),
      requiresMobileVerification: result.requiresMobileVerification,
    };
  }

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 6, ttl: 600_000 } })
  @ApiOperation({ summary: 'درخواست کد یکبارمصرف' })
  async requestOtp(@Body() dto: OtpRequestDto, @Req() req: Request) {
    return this.auth.requestOtp(dto, this.meta(req));
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @ApiOperation({ summary: 'ورود/تأیید موبایل با کد یکبارمصرف' })
  async verifyOtp(@Body() dto: OtpVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyOtp(dto, this.meta(req));
    this.setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshExpiresIn);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      accessExpiresIn: result.tokens.accessExpiresIn,
      ...this.nativeRefresh(req, result.tokens.refreshToken),
      requiresMobileVerification: result.requiresMobileVerification,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 300_000 } })
  @ApiOperation({ summary: 'تمدید توکن دسترسی با چرخش رفرش توکن' })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? dto.refreshToken;
    if (!token) {
      throw new AppException('برای تمدید نشست، ابتدا وارد شوید.', ErrorCodes.UNAUTHENTICATED, { statusCode: 401 });
    }
    const result = await this.auth.refresh(token, this.meta(req));
    this.setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshExpiresIn);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      accessExpiresIn: result.tokens.accessExpiresIn,
      ...this.nativeRefresh(req, result.tokens.refreshToken),
    };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'خروج و ابطال نشست جاری' })
  async logout(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.sessionId);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { ok: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'اطلاعات کاربر جاری همراه با نقش‌ها و مجوزها' })
  async me(@CurrentUser() user: RequestUser) {
    const detail = await this.auth.me(user.id);
    return { ...detail, sessionId: user.sessionId };
  }
}
