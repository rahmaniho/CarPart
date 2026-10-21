import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces the payment-aggregate (parent) / seller-package (child) order model.
 * Existing rows remain `single`; only aggregate rows may have null seller/branch.
 *
 * Rollback is intentionally guarded by PostgreSQL's NOT NULL validation: operators
 * must first remove/refactor parent rows before running `down`, so no financial
 * records are silently discarded.
 */
export class MultiSellerOrderHierarchy1792540800000 implements MigrationInterface {
  name = 'MultiSellerOrderHierarchy1792540800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "sellerId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "branchId" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN "orderKind" varchar(16) NOT NULL DEFAULT 'single'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "CHK_orders_kind_shape" CHECK (
        ("orderKind" = 'parent' AND "sellerId" IS NULL AND "branchId" IS NULL AND "parentOrderId" IS NULL)
        OR ("orderKind" = 'child' AND "sellerId" IS NOT NULL AND "branchId" IS NOT NULL AND "parentOrderId" IS NOT NULL)
        OR ("orderKind" = 'single' AND "sellerId" IS NOT NULL AND "branchId" IS NOT NULL AND "parentOrderId" IS NULL)
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_parent_order" FOREIGN KEY ("parentOrderId") REFERENCES "orders"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_orders_order_kind" ON "orders" ("orderKind")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_parent_order_id" ON "orders" ("parentOrderId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_orders_parent_order_id"`);
    await queryRunner.query(`DROP INDEX "IDX_orders_order_kind"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_parent_order"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_kind_shape"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "orderKind"`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "branchId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "sellerId" SET NOT NULL`);
  }
}
