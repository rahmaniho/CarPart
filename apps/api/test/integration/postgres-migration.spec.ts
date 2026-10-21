import { randomUUID } from 'node:crypto';
import { DataType, newDb } from 'pg-mem';
import { InitialPostgresSchema1761011200000 } from '../../src/database/migrations/1761011200000-InitialPostgresSchema';

/**
 * این آزمون PostgreSQL واقعی نیست؛ parser/constraintهای PostgreSQL را با pg-mem بررسی می‌کند.
 * اجرای Migration روی PostgreSQL 16 واقعی همچنان بخشی از Gate استقرار است.
 */
describe('مهاجرت baseline پایگاه PostgreSQL', () => {
  it('روی پایگاه خالی همه جدول‌ها و قیود اصلی را می‌سازد و قابل rollback است', async () => {
    const memory = newDb({ autoCreateForeignKeyIndices: false });
    memory.registerExtension('uuid-ossp', (schema) => {
      schema.registerFunction({
        name: 'uuid_generate_v4',
        returns: DataType.uuid,
        impure: true,
        implementation: randomUUID,
      });
    });
    memory.public.registerFunction({ name: 'current_database', returns: DataType.text, implementation: () => 'carpart_test' });
    memory.public.registerFunction({ name: 'version', returns: DataType.text, implementation: () => 'PostgreSQL 16 compatible test' });

    const dataSource = await memory.adapters.createTypeormDataSource({
      type: 'postgres',
      database: 'carpart_test',
      entities: [],
      migrations: [InitialPostgresSchema1761011200000],
      migrationsTableName: 'schema_migrations',
    });

    await dataSource.initialize();
    try {
      const applied = await dataSource.runMigrations({ transaction: 'all' });
      expect((applied as Array<{ name: string }>).map((item) => item.name)).toContain('InitialPostgresSchema1761011200000');

      const tables = (await dataSource.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      )) as Array<{ table_name: string }>;
      const names = new Set(tables.map((row) => row.table_name));
      for (const required of ['users', 'parts', 'seller_products', 'orders', 'payments', 'deliveries', 'schema_migrations']) {
        expect(names.has(required)).toBe(true);
      }

      const pending = await dataSource.showMigrations();
      expect(pending).toBe(false);

      await dataSource.undoLastMigration({ transaction: 'all' });
      const ordersAfterRollback = (await dataSource.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders'`,
      )) as Array<{ table_name: string }>;
      expect(ordersAfterRollback).toHaveLength(0);
    } finally {
      await dataSource.destroy();
    }
  }, 60_000);
});
