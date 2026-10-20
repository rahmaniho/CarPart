import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DataSource, type DataSourceOptions, type LogLevel } from 'typeorm';
import type { AppConfig } from '../config/configuration';
import { buildConfig } from '../config/configuration';
import { validateEnv } from '../config/env.schema';
import { ENTITIES } from './entity-list';
import { MIGRATIONS } from './migration-list';

/**
 * ساخت گزینه‌های اتصال پایگاه‌داده.
 * - sqljs: محیط توسعه و تست (بدون نیاز به نصب سرویس؛ فایل محلی یا حافظه)
 * - postgres: محیط عملیاتی
 */
export function buildDataSourceOptions(config: AppConfig): DataSourceOptions {
  const base = {
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize: config.db.synchronize && !config.app.isProduction,
    migrationsRun: config.db.migrationsRun,
    logging: (config.db.logging ? ['error', 'warn', 'migration'] : ['error']) as LogLevel[],
    migrationsTableName: 'schema_migrations',
  };

  if (config.db.type === 'postgres') {
    return {
      ...base,
      type: 'postgres',
      host: config.db.postgres.host,
      port: config.db.postgres.port,
      username: config.db.postgres.username,
      password: config.db.postgres.password,
      database: config.db.postgres.database,
      ssl: config.db.postgres.ssl ? { rejectUnauthorized: false } : false,
      extra: { max: Number(process.env.DB_POOL_SIZE ?? 10), connectionTimeoutMillis: 10_000 },
    } as DataSourceOptions;
  }

  const isMemory = config.db.sqljsFile === ':memory:' || config.app.isTest;
  const location = isMemory ? undefined : resolve(process.cwd(), config.db.sqljsFile);
  if (location) mkdirSync(dirname(location), { recursive: true });

  return {
    ...base,
    type: 'sqljs',
    location,
    autoSave: Boolean(location),
    // برای محیط تست همیشه پایگاه‌داده تازه در حافظه ساخته می‌شود.
  } as DataSourceOptions;
}

export function createDataSource(configOverride?: Partial<AppConfig>): DataSource {
  const config = { ...buildConfig(validateEnv(process.env as unknown as Record<string, unknown>)), ...configOverride } as AppConfig;
  return new DataSource(buildDataSourceOptions(config));
}
