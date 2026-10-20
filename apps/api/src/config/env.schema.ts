import { z } from 'zod';

/** اعتبارسنجی متغیرهای محیطی هنگام بالا آمدن سرویس — پیکربندی ناقص باید زود و شفاف شکست بخورد. */
const boolish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase())));

const int = (fallback: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .pipe(z.number().int());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: int(4000),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  DB_TYPE: z.enum(['sqljs', 'postgres']).default('sqljs'),
  DB_SQLJS_FILE: z.string().default('./data/carpart.sqlite'),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: int(5432),
  POSTGRES_USER: z.string().default('carpart'),
  POSTGRES_PASSWORD: z.string().default(''),
  POSTGRES_DB: z.string().default('carpart'),
  POSTGRES_SSL: boolish.default(false),
  DB_SYNC: boolish.default(true),
  DB_LOGGING: boolish.default(false),
  DB_MIGRATIONS_RUN: boolish.default(false),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: int(900),
  JWT_REFRESH_TTL_DAYS: int(30),
  DATA_ENCRYPTION_KEY: z.string().min(32).default('0'.repeat(64)),
  OTP_TTL_SECONDS: int(120),
  OTP_MAX_ATTEMPTS: int(5),
  // نمایش کد تأیید در پاسخ API فقط برای توسعه (در تولید همیشه غیرفعال می‌شود)
  AUTH_EXPOSE_DEV_OTP: boolish.default(true),

  PAYMENT_PROVIDER: z.enum(['sandbox', 'zarinpal']).default('sandbox'),
  PAYMENT_SANDBOX_SECRET: z.string().default('dev-sandbox-payment-secret'),
  ZARINPAL_MERCHANT_ID: z.string().default(''),
  ZARINPAL_API_URL: z.string().default('https://api.zarinpal.com/pg/v4/payment'),
  PAYMENT_EXPIRE_MINUTES: int(15),

  MAP_PROVIDER: z.enum(['mock', 'neshan', 'osrm']).default('mock'),
  MAP_API_KEY: z.string().default(''),
  MAP_ROUTE_URL: z.string().default(''),
  MAP_DETOUR_FACTOR: z.coerce.number().default(1.35),
  MAP_AVG_SPEED_KMH: z.coerce.number().default(24),

  SMS_PROVIDER: z.enum(['mock', 'kavenegar', 'smsir']).default('mock'),
  SMS_API_KEY: z.string().default(''),
  SMS_SENDER: z.string().default(''),
  EMAIL_PROVIDER: z.enum(['mock', 'smtp']).default('mock'),
  SMTP_URL: z.string().default(''),
  EMAIL_FROM: z.string().default('no-reply@carpart.local'),

  JOB_RUNNER: z.enum(['inline', 'redis']).default('inline'),
  REDIS_URL: z.string().default(''),
  JOB_POLL_INTERVAL_MS: int(5000),

  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  STORAGE_MAX_FILE_MB: int(5),

  THROTTLE_TTL_SECONDS: int(60),
  THROTTLE_LIMIT: int(180),
  THROTTLE_AUTH_TTL_SECONDS: int(60),
  THROTTLE_AUTH_LIMIT: int(10),
  /** غیرفعال‌سازی محدودسازی نرخ فقط برای محیط تست (پیش‌فرض: فعال در همه محیط‌های واقعی) */
  THROTTLE_DISABLED: boolish.default(false),

  DEFAULT_COMMISSION_PERCENT: z.coerce.number().default(7),
  DEFAULT_DELIVERY_BASE_FEE: int(25000),
  DEFAULT_DELIVERY_PER_KM_FEE: int(6000),
  QUOTE_DEADLINE_MINUTES: int(45),
  COURIER_OFFER_TIMEOUT_MINUTES: int(4),
  REFUND_WINDOW_DAYS: int(3),
  AUTO_COMPLETE_AFTER_DELIVERY_HOURS: int(48),

  SEED_ADMIN_MOBILE: z.string().default('09120000000'),
  SEED_ADMIN_PASSWORD: z.string().default('ChangeMe!12345'),
  SEED_DEMO_DATA: boolish.default(true),
});

export type Env = z.infer<typeof envSchema>;

/** اعتبارسنجی محیط برای @nestjs/config */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`تنظیمات محیطی نامعتبر است:\n${issues}`);
  }
  return parsed.data;
}
