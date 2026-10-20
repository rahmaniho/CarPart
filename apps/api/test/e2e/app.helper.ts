import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { CONFIG_TOKEN, type AppConfig } from '../../src/config/configuration';
import { seedDatabase } from '../../src/database/seed';
import { configureApp } from '../../src/common/http/configure-app';

export interface TestContext {
  app: INestApplication;
  http: ReturnType<typeof request>;
  dataSource: DataSource;
  config: AppConfig;
  close: () => Promise<void>;
}

/** راه‌اندازی برنامه کامل با پایگاه‌داده حافظه‌ای و داده نمونه. */
export async function createTestApp(options: { seed?: boolean } = {}): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  // با TEST_LOGS=true لاگ‌های سرویس در تست چاپ می‌شوند (برای یافتن هشدارهای توسعه‌دهنده)
  const app = moduleRef.createNestApplication({ logger: process.env.TEST_LOGS ? ['warn', 'error'] : false });
  const config = moduleRef.get<AppConfig>(CONFIG_TOKEN, { strict: false });
  // همان پیکربندی زمان اجرا (helmet، کوکی‌پارسر، اعتبارسنجی فارسی، CORS) تا تست‌ها
  // جریان‌های واقعی مانند کوکی رفرش توکن را بسنجند
  configureApp(app, config);
  await app.init();
  const dataSource = app.get(DataSource);
  if (options.seed !== false) {
    await seedDatabase(dataSource, config, { force: false });
  }

  return {
    app,
    http: request(app.getHttpServer()),
    dataSource,
    config,
    close: async () => {
      await app.close();
    },
  };
}

export interface Session {
  token: string;
  user: { id: string; mobile: string; roles: string[] };
}

/** ورود با کد یکبارمصرف (در محیط تست کد در پاسخ برگردانده می‌شود). */
export async function login(ctx: TestContext, mobile: string): Promise<Session> {
  const requested = await ctx.http.post('/api/v1/auth/otp/request').send({ mobile, purpose: 'login' });
  if (![200, 201].includes(requested.status)) {
    throw new Error(`درخواست کد تأیید ناموفق بود (${requested.status}): ${JSON.stringify(requested.body)}`);
  }
  const code = requested.body?.devCode as string | undefined;
  if (!code) throw new Error('کد تأیید آزمایشی در دسترس نیست (AUTH_EXPOSE_DEV_OTP).');
  const verified = await ctx.http.post('/api/v1/auth/otp/verify').send({ mobile, code, purpose: 'login' });
  if (verified.status !== 200) {
    throw new Error(`تأیید کد ناموفق بود (${verified.status}): ${JSON.stringify(verified.body)}`);
  }
  return { token: verified.body.accessToken as string, user: verified.body.user };
}

export const DEMO = {
  admin: '09120000000',
  operator: '09120000001',
  mechanic: '09121110001',
  mechanic2: '09121110002',
  seller: '09122220001',
  seller2: '09122220002',
  seller3: '09122220003',
  courier: '09123330001',
  courier2: '09123330002',
};

/** انتظار با تکرار تا برآورده‌شدن یک شرط (برای جریان‌های ناهمگام صف کار). */
export async function waitFor<T>(fn: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs = 15_000, intervalMs = 250): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await fn();
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await fn();
  }
  return last;
}
