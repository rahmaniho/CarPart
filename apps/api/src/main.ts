import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { CONFIG_TOKEN, type AppConfig } from './config/configuration';
import { seedDatabase } from './database/seed';

/**
 * راه‌اندازی سرویس API.
 *
 * - مسیر پایه همه اندپوینت‌ها `/api/v1` است (مسیر سلامت بیرون از آن).
 * - اعتبارسنجی ورودی به‌صورت سراسری با حذف فیلدهای ناشناخته انجام می‌شود.
 * - CORS فقط برای دامنه‌های پیکربندی‌شده و با اعتبارنامه (کوکی رفرش) باز است.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get<AppConfig>(CONFIG_TOKEN);

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  app.enableCors({
    origin: config.app.corsOrigins.length ? config.app.corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('کارپارت — API')
    .setDescription('مستندات زنده REST API بازار قطعات یدکی خودرو (همه پاسخ‌ها و پیام‌ها فارسی است)')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addApiKey({ type: 'apiKey', name: 'idempotency-key', in: 'header' }, 'idempotency')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    customSiteTitle: 'مستندات API کارپارت',
  });

  if (config.seed.demoData && !config.app.isProduction) {
    await seedDatabase(app.get(DataSource), config, { force: false });
  }

  await app.listen(config.app.port, '0.0.0.0');
  logger.log(`API روی ${config.app.apiUrl} در حال اجراست (محیط: ${config.app.env})`);
  logger.log(`مستندات: ${config.app.apiUrl.replace(/\/api\/v1\/?$/, '')}/api/docs`);
  logger.log(`پایگاه‌داده: ${config.db.type} | درگاه پرداخت: ${config.payment.provider} | نقشه: ${config.map.provider}`);
  if (config.payment.provider === 'sandbox') {
    logger.warn('درگاه پرداخت در حالت آزمایشی است؛ هیچ تراکنش واقعی انجام نمی‌شود.');
  }
  if (config.map.provider === 'mock') {
    logger.warn('مسافت و زمان ارسال با تخمین داخلی محاسبه می‌شود (سرویس نقشه واقعی پیکربندی نشده است).');
  }
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('راه‌اندازی سرویس ناموفق بود:', error);
  process.exit(1);
});
