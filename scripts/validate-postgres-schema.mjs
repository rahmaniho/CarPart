import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

if (process.env.DB_TYPE !== 'postgres') {
  throw new Error('این بررسی باید با DB_TYPE=postgres اجرا شود تا نوع ستون‌های تولید بارگذاری شوند.');
}

const require = createRequire(import.meta.url);
const { DataType, newDb } = require('pg-mem');
const { ENTITIES } = require('../apps/api/dist/database/entity-list.js');
const { MIGRATIONS } = require('../apps/api/dist/database/migration-list.js');

const memory = newDb({ autoCreateForeignKeyIndices: false });
memory.registerExtension('uuid-ossp', (schema) => {
  schema.registerFunction({ name: 'uuid_generate_v4', returns: DataType.uuid, impure: true, implementation: randomUUID });
});
memory.public.registerFunction({ name: 'current_database', returns: DataType.text, implementation: () => 'carpart_schema_check' });
memory.public.registerFunction({ name: 'version', returns: DataType.text, implementation: () => 'PostgreSQL 16 compatible schema check' });

// initialize شدن DataSource با ENTITIES، ناسازگاری‌هایی مانند datetime یا uuid+length
// را همان‌جا رد می‌کند. اجرای migration نیز syntax و ترتیب قیود baseline را می‌سنجد.
const dataSource = await memory.adapters.createTypeormDataSource({
  type: 'postgres',
  database: 'carpart_schema_check',
  entities: ENTITIES,
  migrations: MIGRATIONS,
  migrationsTableName: 'schema_migrations',
});

await dataSource.initialize();
try {
  const applied = await dataSource.runMigrations({ transaction: 'all' });
  const rows = await dataSource.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
  const tableNames = new Set(rows.map((row) => row.table_name));
  const required = ['users', 'parts', 'seller_products', 'orders', 'payments', 'deliveries', 'schema_migrations'];
  const missing = required.filter((name) => !tableNames.has(name));
  if (missing.length) throw new Error(`جدول‌های الزامی ساخته نشدند: ${missing.join(', ')}`);
  if (await dataSource.showMigrations()) throw new Error('پس از اجرای baseline هنوز migration اجرا‌نشده وجود دارد.');
  console.log(`PostgreSQL compatibility check موفق: ${applied.length} migration، ${ENTITIES.length} entity، ${tableNames.size} جدول.`);
} finally {
  await dataSource.destroy();
}
