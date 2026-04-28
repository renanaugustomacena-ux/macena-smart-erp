import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-027 — Multi-company Phase A schema (plan §31.2 Sprint 33).
 *
 * Adds `companies` table. Document-level companyId backfill is a
 * separate migration (M-028) wired in the Sprint 33 release branch.
 */
export class MultiCompanySchema1715300000000 implements MigrationInterface {
  name = 'MultiCompanySchema1715300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "code" varchar(50) NOT NULL,
        "name" varchar(200) NOT NULL,
        "vatNumber" varchar(11) NULL,
        "fiscalCode" varchar(16) NULL,
        "sdiDestinationCode" varchar(7) NULL,
        "pecEmail" varchar(255) NULL,
        "address" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "currency" varchar(3) NOT NULL DEFAULT 'EUR',
        "isPrimary" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "notes" text NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_companies_tenantId" ON "companies" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_companies_tenant_code" ON "companies" ("tenantId", "code")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_companies_tenant_vat" ON "companies" ("tenantId", "vatNumber") WHERE "vatNumber" IS NOT NULL`,
    );
    // Backfill: one primary Company per existing tenant matching the
    // tenant's anagrafica.
    await queryRunner.query(`
      INSERT INTO "companies" ("tenantId", "code", "name", "vatNumber", "fiscalCode", "sdiDestinationCode", "pecEmail", "address", "isPrimary")
      SELECT t."id", 'COMPANY-PRIMARY', t."name", t."vatNumber", t."fiscalCode", t."sdiDestinationCode", t."pecEmail", '{}'::jsonb, true
      FROM "tenants" t
      WHERE NOT EXISTS (SELECT 1 FROM "companies" c WHERE c."tenantId" = t."id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "companies"`);
  }
}
