import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Durable checkpoint for local payment effects. Historical orders that already
 * have a commission are backfilled so a late/replayed callback cannot deduct
 * their stock a second time.
 */
export class IdempotentPaidOrderEffects1792544400000 implements MigrationInterface {
  name = 'IdempotentPaidOrderEffects1792544400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "paidEffectsAppliedAt" TIMESTAMP NULL`);
    await queryRunner.query(
      `UPDATE "orders"
       SET "paidEffectsAppliedAt" = COALESCE("paidAt", "updatedAt")
       WHERE "id" IN (SELECT "orderId" FROM "commissions")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "paidEffectsAppliedAt"`);
  }
}
