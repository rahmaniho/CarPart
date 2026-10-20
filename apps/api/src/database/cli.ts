import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import { Logger } from '@nestjs/common';
import { buildConfig, type AppConfig } from '../config/configuration';
import { validateEnv } from '../config/env.schema';
import { createDataSource } from './data-source';
import { seedDatabase } from './seed';

function loadEnvFilesIfNeeded(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/api/.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../../.env'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFilesIfNeeded();

const logger = new Logger('DatabaseCLI');

const HELP = `
کاربرد: npm run db:<command> [--flags]

دستورها:
  migrate    اجرای مهاجرت‌های ثبت‌شده (برای PostgreSQL عملیاتی)
  seed       ساخت داده نمونه توسعه (با --force داده موجود پاک و از نو ساخته می‌شود)
  reset      حذف ساختار و ساخت دوباره + داده نمونه (برای PostgreSQL نیاز به --confirm-drop دارد)
  settings   چاپ تنظیمات سامانه (کلید و مقدار فعلی)
`;

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);
  const force = process.argv.includes('--force');
  const confirmDrop = process.argv.includes('--confirm-drop');
  const config: AppConfig = buildConfig(validateEnv(process.env as unknown as Record<string, unknown>));
  const dataSource = createDataSource();

  await dataSource.initialize();
  logger.log(`اتصال به پایگاه‌داده ${config.db.type} برقرار شد.`);

  switch (command) {
    case 'migrate': {
      if (config.db.type !== 'postgres') {
        logger.warn('در حالت sqljs ساختار با synchronize ساخته می‌شود؛ مهاجرت‌ها برای PostgreSQL عملیاتی لازم است.');
      }
      const migrations = await dataSource.runMigrations();
      logger.log(`${migrations.length} مهاجرت اجرا شد.`);
      break;
    }
    case 'seed': {
      const report = await seedDatabase(dataSource, config, { force });
      logger.log(report.message);
      break;
    }
    case 'reset': {
      if (config.db.type === 'postgres' && !confirmDrop) {
        logger.error('برای حذف پایگاه‌داده PostgreSQL باید پرچم --confirm-drop داده شود.');
        process.exitCode = 1;
        break;
      }
      await dataSource.dropDatabase();
      await dataSource.synchronize();
      logger.log('ساختار پایگاه‌داده از نو ساخته شد.');
      const report = await seedDatabase(dataSource, config, { force: true });
      logger.log(report.message);
      break;
    }
    case 'settings': {
      const rows = await dataSource.query('SELECT "key", "value", "faLabel" FROM system_settings ORDER BY "group", "key"');
      for (const row of rows as Array<{ key: string; value: unknown; faLabel: string }>) {
        // eslint-disable-next-line no-console
        console.log(`${row.key} = ${String(row.value)}  (${row.faLabel})`);
      }
      break;
    }
    default:
      logger.log(HELP);
      process.exitCode = command ? 1 : 0;
  }

  await dataSource.destroy();
}

main().catch((error) => {
  logger.error(`اجرای دستور ناموفق بود: ${(error as Error).message}`);
  process.exit(1);
});
