import { validateEnv } from '../../src/config/env.schema';

const productionEnv = {
  NODE_ENV: 'production',
  DB_TYPE: 'postgres',
  DB_SYNC: 'false',
  DB_MIGRATIONS_RUN: 'true',
  POSTGRES_PASSWORD: 'strong-db-password-123',
  JWT_ACCESS_SECRET: 'access-secret-production-123456',
  JWT_REFRESH_SECRET: 'refresh-secret-production-654321',
  DATA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  CORS_ORIGINS: 'https://app.example.test',
  SEED_DEMO_DATA: 'false',
};

describe('اعتبارسنجی تنظیمات محیط', () => {
  it('تنظیم production امن و PostgreSQL را می‌پذیرد', () => {
    const env = validateEnv(productionEnv);
    expect(env.DB_TYPE).toBe('postgres');
    expect(env.DB_SYNC).toBe(false);
    expect(env.SEED_DEMO_DATA).toBe(false);
  });

  it.each([
    [{ DB_TYPE: 'sqljs' }, 'DB_TYPE'],
    [{ DB_SYNC: 'true' }, 'DB_SYNC'],
    [{ POSTGRES_PASSWORD: 'short' }, 'POSTGRES_PASSWORD'],
    [{ SEED_DEMO_DATA: 'true' }, 'SEED_DEMO_DATA'],
    [{ JWT_REFRESH_SECRET: productionEnv.JWT_ACCESS_SECRET }, 'JWT_REFRESH_SECRET'],
    [{ DATA_ENCRYPTION_KEY: '0'.repeat(64) }, 'DATA_ENCRYPTION_KEY'],
    [{ CORS_ORIGINS: '*' }, 'CORS_ORIGINS'],
  ])('تنظیم ناامن production را زودهنگام رد می‌کند: %s', (override, field) => {
    expect(() => validateEnv({ ...productionEnv, ...override })).toThrow(field);
  });

  it('محیط تست را برای sql.js و داده نمونه محدود نمی‌کند', () => {
    const env = validateEnv({
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test-access-secret-12345',
      JWT_REFRESH_SECRET: 'test-refresh-secret-12345',
    });
    expect(env.DB_TYPE).toBe('sqljs');
    expect(env.SEED_DEMO_DATA).toBe(true);
  });
});
