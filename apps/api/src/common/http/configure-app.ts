import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { AppConfig } from '../../config/configuration';
import { requestContextMiddleware } from '../middleware/request-context.middleware';
import { createValidationPipe } from './validation';

export interface ConfigureAppOptions {
  /** هدرهای امنیتی helmet (پیش‌فرض: فعال) */
  securityHeaders?: boolean;
  /** تنظیم CORS بر اساس دامنه‌های پیکربندی‌شده (پیش‌فرض: فعال) */
  cors?: boolean;
  /** اعتماد به پروکسی معکوس برای IP واقعی کاربر (پیش‌فرض: فعال) */
  trustProxy?: boolean;
}

/**
 * پیکربندی مشترک برنامه HTTP.
 *
 * این تابع هم در `main.ts` (زمان اجرا) و هم در راه‌انداز تست‌های سرتاسری استفاده می‌شود،
 * تا تست‌ها دقیقاً همان میان‌افزارها، پیشوند مسیر و اعتبارسنجی تولید را بسنجند.
 * نبود این همسان‌سازی پیش‌تر باعث شد جریان کوکی رفرش توکن فقط در محیط اجرا کار کند.
 */
export function configureApp(app: INestApplication, config: AppConfig, options: ConfigureAppOptions = {}): void {
  const express = app as NestExpressApplication;

  if (options.trustProxy !== false) {
    express.set('trust proxy', 1);
  }

  if (options.securityHeaders !== false) {
    express.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }),
    );
  }

  // کوکی رفرش توکن (httpOnly) تنها با این میان‌افزار خوانده می‌شود
  express.use(cookieParser());

  // شناسه درخواست باید پیش از گاردها ساخته شود تا پاسخ‌های ۴۰۱/۴۰۳ هم قابل رهگیری باشند
  express.use(requestContextMiddleware);

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  app.useGlobalPipes(createValidationPipe());

  if (options.cors !== false) {
    app.enableCors({
      origin: config.app.corsOrigins.length ? config.app.corsOrigins : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Idempotency-Key', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
    });
  }

  app.enableShutdownHooks();
}
