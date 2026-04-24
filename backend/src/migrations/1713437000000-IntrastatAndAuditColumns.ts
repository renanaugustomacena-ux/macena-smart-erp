import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Follow-up migration:
 *   - sales_orders: adds Intrastat-sufficient fields per v2.0 §20.8
 *     (combined-nomenclature NC8 code, net mass, country of origin).
 *   - products: same Intrastat fields at master-data level.
 *
 * Closes gap H-07.
 */
export class IntrastatAndAuditColumns1713437000000 implements MigrationInterface {
  name = 'IntrastatAndAuditColumns1713437000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "intrastatNc8" varchar(8)`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "netMassKg" decimal(10,3)`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "countryOfOrigin" varchar(2)`);

    await queryRunner.query(`ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "intrastatNatureOfTransaction" varchar(2)`);
    await queryRunner.query(`ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "intrastatRegimeStatistico" varchar(2)`);
    await queryRunner.query(`ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "intrastatModalitaTrasporto" varchar(1)`);
    await queryRunner.query(`ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "intrastatPaeseDestinazione" varchar(2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales_orders" DROP COLUMN IF EXISTS "intrastatPaeseDestinazione"`);
    await queryRunner.query(`ALTER TABLE "sales_orders" DROP COLUMN IF EXISTS "intrastatModalitaTrasporto"`);
    await queryRunner.query(`ALTER TABLE "sales_orders" DROP COLUMN IF EXISTS "intrastatRegimeStatistico"`);
    await queryRunner.query(`ALTER TABLE "sales_orders" DROP COLUMN IF EXISTS "intrastatNatureOfTransaction"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "countryOfOrigin"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "netMassKg"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "intrastatNc8"`);
  }
}
