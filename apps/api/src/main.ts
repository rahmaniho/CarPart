import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { CONFIG_TOKEN, type AppConfig } from './config/configuration';
import { seedDatabase } from './database/seed';
import { configureApp } from './common/http/configure-app';

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

  // پیکربندی مشترک با تست‌های سرتاسری: helmet، کوکی‌پارسر، پیشوند مسیر، اعتبارسنجی و CORS
  configureApp(app, config);

  // Swagger در production عمومی نمی‌شود تا سطح حمله و افشای قراردادهای مدیریتی کاهش یابد.
  // مستندات تولید باید پشت VPN/احراز هویت سازمانی یا از artifact قرارداد ارائه شوند.
  if (!config.app.isProduction) {
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
  }

  if (config.seed.demoData && !config.app.isProduction) {
    await seedDatabase(app.get(DataSource), config, { force: false });
  }

  await app.listen(config.app.port, '0.0.0.0');
  logger.log(`API روی ${config.app.apiUrl} در حال اجراست (محیط: ${config.app.env})`);
  if (!config.app.isProduction) logger.log(`مستندات: ${config.app.apiUrl.replace(/\/api\/v1\/?$/, '')}/api/docs`);
  logger.log(`پایگاه‌داده: ${config.db.type} | درگاه پرداخت: ${config.payment.provider} | نقشه: ${config.map.provider}`);
  if (config.payment.provider === 'sandbox') {
    logger.warn('درگاه پرداخت در حالت آزمایشی است؛ هیچ تراکنش واقعی انجام نمی‌شود.');
  }
  if (config.map.provider === 'mock') {
    logger.warn('مسافت و زمان ارسال با تخمین داخلی محاسبه می‌شود (سرویس نقشه واقعی پیکربندی نشده است).');
  }
}

bootstrap().catch((error) => {
  console.error('راه‌اندازی سرویس ناموفق بود:', error);
  process.exit(1);
});
