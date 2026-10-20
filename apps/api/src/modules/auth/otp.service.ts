import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OtpPurpose } from '../users/entities/otp-code.entity';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import { AppException, ErrorCodes } from '../../common/errors/app-error';
import { hmac, hashToken } from '../../common/utils/crypto';
import { numericOtp } from '../../common/utils/id';
import { OtpCode } from '../users/entities/otp-code.entity';
import { SmsGateway } from '../notifications/sms.gateway';
import { SystemSettingsService } from '../settings/system-settings.service';

export interface OtpRequestResult {
  sent: true;
  expiresIn: number;
  /** در حالت توسعه/آزمایشی کد برگردانده می‌شود تا ورود قابل آزمایش باشد */
  devCode?: string;
  simulated: boolean;
  notice: string;
}

const RESEND_COOLDOWN_SECONDS = 90;

/** سرویس کد یکبارمصرف: صدور، محدودسازی نرخ و اعتبارسنجی. */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(OtpCode) private readonly repo: Repository<OtpCode>,
    private readonly gateway: SmsGateway,
    private readonly settings: SystemSettingsService,
    @Inject(CONFIG_TOKEN) private readonly config: AppConfig,
  ) {}

  async request(mobile: string, purpose: OtpPurpose = 'login', ip?: string | null): Promise<OtpRequestResult> {
    const ttlSeconds = this.config.auth.otpTtlSeconds;

    const recent = await this.repo.findOne({
      where: { mobile, purpose, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (recent) {
      const elapsed = Math.floor((Date.now() - recent.createdAt.getTime()) / 1000);
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        throw new AppException(
          `برای دریافت کد جدید ${RESEND_COOLDOWN_SECONDS - elapsed} ثانیه صبر کنید.`,
          ErrorCodes.RATE_LIMITED,
          { statusCode: 429, details: { retryAfterSeconds: RESEND_COOLDOWN_SECONDS - elapsed } },
        );
      }
    }

    const hourlyCount = await this.repo.count({
      where: { mobile, createdAt: MoreThan(new Date(Date.now() - 3_600_000)) },
    });
    if (hourlyCount >= 8) {
      throw new AppException('تعداد درخواست کد تأیید بیش از حد مجاز است. یک ساعت دیگر تلاش کنید.', ErrorCodes.RATE_LIMITED, {
        statusCode: 429,
      });
    }

    const code = numericOtp(5);
    const entity = this.repo.create({
      mobile,
      codeHash: hmac(this.config.auth.accessSecret, `${mobile}:${purpose}:${code}`),
      purpose,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      ip: ip ?? null,
      attempts: 0,
    });
    await this.repo.save(entity);

    const appName = await this.settings.getString('platform.name', 'قطعه‌رسان');
    const message = `${appName}\nکد تأیید: ${code}\nاعتبار: ${Math.round(ttlSeconds / 60)} دقیقه\nاین کد را در اختیار کسی قرار ندهید.`;
    const sendResult = await this.gateway.sendSms(mobile, message, { purpose }).catch((error) => {
      this.logger.error(`ارسال پیامک کد تأیید ناموفق بود: ${(error as Error).message}`);
      return { simulated: true, status: 'failed' as const, provider: 'mock', messageId: null, error: (error as Error).message };
    });

    return {
      sent: true,
      expiresIn: ttlSeconds,
      devCode: this.config.auth.exposeDevOtp ? code : undefined,
      simulated: sendResult.simulated,
      notice: sendResult.simulated
        ? 'در این استقرار سرویس پیامک واقعی متصل نیست؛ کد به‌صورت آزمایشی ثبت و در پاسخ توسعه برگردانده شد.'
        : 'کد تأیید با پیامک ارسال شد.',
    };
  }

  async verify(mobile: string, code: string, purpose: OtpPurpose = 'login'): Promise<{ ok: true; otpId: string }> {
    const otp = await this.repo.findOne({
      where: { mobile, purpose, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!otp) {
      throw new AppException('کد تأییدی برای این شماره یافت نشد. درخواست کد جدید بدهید.', ErrorCodes.OTP_INVALID, {
        statusCode: 400,
      });
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      otp.consumedAt = new Date();
      await this.repo.save(otp);
      throw new AppException('کد تأیید منقضی شده است. کد جدید درخواست دهید.', ErrorCodes.OTP_EXPIRED, { statusCode: 400 });
    }
    if (otp.attempts >= this.config.auth.otpMaxAttempts) {
      otp.consumedAt = new Date();
      await this.repo.save(otp);
      throw new AppException('تعداد تلاش‌های ناموفق بیش از حد مجاز است. کد جدید درخواست دهید.', ErrorCodes.OTP_TOO_MANY_ATTEMPTS, {
        statusCode: 429,
      });
    }
    const expected = hmac(this.config.auth.accessSecret, `${mobile}:${purpose}:${code}`);
    if (otp.codeHash !== expected && hashToken(code) !== otp.codeHash) {
      otp.attempts += 1;
      await this.repo.save(otp);
      throw new AppException('کد تأیید نادرست است.', ErrorCodes.OTP_INVALID, {
        statusCode: 400,
        details: { remainingAttempts: Math.max(0, this.config.auth.otpMaxAttempts - otp.attempts) },
      });
    }
    otp.consumedAt = new Date();
    await this.repo.save(otp);
    return { ok: true, otpId: otp.id };
  }

  /** پاک‌سازی کدهای منقضی (توسط فرایند زمان‌بندی‌شده فراخوانی می‌شود). */
  async cleanupExpired(): Promise<number> {
    const result = await this.repo.delete({ expiresAt: LessThan(new Date(Date.now() - 86_400_000)) });
    return result.affected ?? 0;
  }
}
