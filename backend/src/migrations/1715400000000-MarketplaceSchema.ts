import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-029 — Marketplace schema (plan §31.3 Sprint 37).
 */
export class MarketplaceSchema1715400000000 implements MigrationInterface {
  name = 'MarketplaceSchema1715400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "marketplace_packages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor" varchar(100) NOT NULL,
        "slug" varchar(100) NOT NULL,
        "displayName" varchar(200) NOT NULL,
        "descriptionMd" text NOT NULL,
        "version" varchar(50) NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'active',
        "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "monthlyPriceCents" bigint NULL,
        "contactEmail" varchar(100) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_marketplace_pkg_vendor_slug" ON "marketplace_packages" ("vendor", "slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_marketplace_pkg_status" ON "marketplace_packages" ("status")`,
    );
    await queryRunner.query(`
      CREATE TABLE "marketplace_installations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "packageId" uuid NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'active',
        "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "installedAt" timestamptz NULL,
        "cancelledAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_marketplace_inst_tenantId" ON "marketplace_installations" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_marketplace_inst_unique" ON "marketplace_installations" ("tenantId", "packageId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_marketplace_inst_status" ON "marketplace_installations" ("tenantId", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "marketplace_installations"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace_packages"`);
  }
}
