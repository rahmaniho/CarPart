import type { Env } from './env.schema';

export interface AppConfig {
  app: {
    env: string;
    isProduction: boolean;
    isTest: boolean;
    port: number;
    apiUrl: string;
    webUrl: string;
    corsOrigins: string[];
  };
  db: {
    type: 'sqljs' | 'postgres';
    sqljsFile: string;
    synchronize: boolean;
    logging: boolean;
    migrationsRun: boolean;
    postgres: {
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
      ssl: boolean;
    };
  };
  auth: {
    accessSecret: string;
    refreshSecret: string;
    accessTtlSeconds: number;
    refreshTtlDays: number;
    encryptionKey: string;
    otpTtlSeconds: number;
    otpMaxAttempts: number;
    exposeDevOtp: boolean;
  };
  payment: {
    provider: 'sandbox' | 'zarinpal';
    sandboxSecret: string;
    zarinpalMerchantId: string;
    zarinpalApiUrl: string;
    expireMinutes: number;
  };
  map: {
    provider: 'mock' | 'neshan' | 'osrm';
    apiKey: string;
    routeUrl: string;
    detourFactor: number;
    avgSpeedKmh: number;
  };
  messaging: {
    smsProvider: 'mock' | 'kavenegar' | 'smsir';
    smsApiKey: string;
    smsSender: string;
    emailProvider: 'mock' | 'smtp';
    smtpUrl: string;
    emailFrom: string;
  };
  jobs: {
    runner: 'inline' | 'redis';
    redisUrl: string;
    pollIntervalMs: number;
  };
  storage: {
    provider: 'local' | 's3';
    localDir: string;
    maxFileMb: number;
  };
  throttle: {
    ttlSeconds: number;
    limit: number;
    authTtlSeconds: number;
    authLimit: number;
  };
  business: {
    commissionPercent: number;
    deliveryBaseFee: number;
    deliveryPerKmFee: number;
    quoteDeadlineMinutes: number;
    courierOfferTimeoutMinutes: number;
    refundWindowDays: number;
    autoCompleteAfterDeliveryHours: number;
  };
  seed: {
    adminMobile: string;
    adminPassword: string;
    demoData: boolean;
  };
}

export function buildConfig(env: Env): AppConfig {
  return {
    app: {
      env: env.NODE_ENV,
      isProduction: env.NODE_ENV === 'production',
      isTest: env.NODE_ENV === 'test',
      port: env.PORT,
      apiUrl: env.PUBLIC_API_URL.replace(/\/$/, ''),
      webUrl: env.PUBLIC_WEB_URL.replace(/\/$/, ''),
      corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    },
    db: {
      type: env.DB_TYPE,
      sqljsFile: env.DB_SQLJS_FILE,
      synchronize: env.DB_SYNC,
      logging: env.DB_LOGGING,
      migrationsRun: env.DB_MIGRATIONS_RUN,
      postgres: {
        host: env.POSTGRES_HOST,
        port: env.POSTGRES_PORT,
        username: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
        database: env.POSTGRES_DB,
        ssl: env.POSTGRES_SSL,
      },
    },
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtlSeconds: env.JWT_ACCESS_TTL,
      refreshTtlDays: env.JWT_REFRESH_TTL_DAYS,
      encryptionKey: env.DATA_ENCRYPTION_KEY,
      otpTtlSeconds: env.OTP_TTL_SECONDS,
      otpMaxAttempts: env.OTP_MAX_ATTEMPTS,
      // در محیط تولید هرگز کد تأیید در پاسخ API برگردانده نمی‌شود.
      exposeDevOtp: env.AUTH_EXPOSE_DEV_OTP && env.NODE_ENV !== 'production',
    },
    payment: {
      provider: env.PAYMENT_PROVIDER,
      sandboxSecret: env.PAYMENT_SANDBOX_SECRET,
      zarinpalMerchantId: env.ZARINPAL_MERCHANT_ID,
      zarinpalApiUrl: env.ZARINPAL_API_URL,
      expireMinutes: env.PAYMENT_EXPIRE_MINUTES,
    },
    map: {
      provider: env.MAP_PROVIDER,
      apiKey: env.MAP_API_KEY,
      routeUrl: env.MAP_ROUTE_URL,
      detourFactor: env.MAP_DETOUR_FACTOR,
      avgSpeedKmh: env.MAP_AVG_SPEED_KMH,
    },
    messaging: {
      smsProvider: env.SMS_PROVIDER,
      smsApiKey: env.SMS_API_KEY,
      smsSender: env.SMS_SENDER,
      emailProvider: env.EMAIL_PROVIDER,
      smtpUrl: env.SMTP_URL,
      emailFrom: env.EMAIL_FROM,
    },
    jobs: {
      runner: env.JOB_RUNNER,
      redisUrl: env.REDIS_URL,
      pollIntervalMs: env.JOB_POLL_INTERVAL_MS,
    },
    storage: {
      provider: env.STORAGE_PROVIDER,
      localDir: env.STORAGE_LOCAL_DIR,
      maxFileMb: env.STORAGE_MAX_FILE_MB,
    },
    throttle: {
      ttlSeconds: env.THROTTLE_TTL_SECONDS,
      limit: env.THROTTLE_LIMIT,
      authTtlSeconds: env.THROTTLE_AUTH_TTL_SECONDS,
      authLimit: env.THROTTLE_AUTH_LIMIT,
    },
    business: {
      commissionPercent: env.DEFAULT_COMMISSION_PERCENT,
      deliveryBaseFee: env.DEFAULT_DELIVERY_BASE_FEE,
      deliveryPerKmFee: env.DEFAULT_DELIVERY_PER_KM_FEE,
      quoteDeadlineMinutes: env.QUOTE_DEADLINE_MINUTES,
      courierOfferTimeoutMinutes: env.COURIER_OFFER_TIMEOUT_MINUTES,
      refundWindowDays: env.REFUND_WINDOW_DAYS,
      autoCompleteAfterDeliveryHours: env.AUTO_COMPLETE_AFTER_DELIVERY_HOURS,
    },
    seed: {
      adminMobile: env.SEED_ADMIN_MOBILE,
      adminPassword: env.SEED_ADMIN_PASSWORD,
      demoData: env.SEED_DEMO_DATA,
    },
  };
}

export const CONFIG_TOKEN = 'APP_CONFIG';
