import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-018 — Intrastat schema (plan §31.1 Sprint 16 / S16.2).
 *
 * Adds:
 *   - intrastat_declarations + intrastat_lines (with FSM enums)
 *   - partnerCountry / partnerVatNumber on supplier_invoices to enable
 *     INTRA-2bis aggregation without requiring a Supplier master entity.
 */
export class IntrastatSchema1714500000000 implements MigrationInterface {
  name = 'IntrastatSchema1714500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "intrastat_declaration_type_enum" AS ENUM ('cessioni', 'acquisti')`,
    );
    await queryRunner.query(
      `CREATE TYPE "intrastat_periodicity_enum" AS ENUM ('monthly', 'quarterly')`,
    );
    await queryRunner.query(
      `CREATE TYPE "intrastat_status_enum" AS ENUM ('draft', 'generated', 'submitted', 'accepted', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TYPE "intrastat_source_doc_type_enum" AS ENUM ('invoice', 'supplier_invoice')`,
    );

    await queryRunner.query(`
      CREATE TABLE "intrastat_declarations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "type" intrastat_declaration_type_enum NOT NULL,
        "periodicity" intrastat_periodicity_enum NOT NULL DEFAULT 'monthly',
        "periodYear" int NOT NULL,
        "periodMonth" int NULL,
        "periodQuarter" int NULL,
        "status" intrastat_status_enum NOT NULL DEFAULT 'draft',
        "totalValueCents" bigint NOT NULL DEFAULT 0,
        "lineCount" int NOT NULL DEFAULT 0,
        "admProtocollo" varchar(50) NULL,
        "generatedAt" timestamptz NULL,
        "submittedAt" timestamptz NULL,
        "acceptedAt" timestamptz NULL,
        "rejectedAt" timestamptz NULL,
        "rejectionReason" text NULL,
        "generatedBy" uuid NULL,
        "submittedBy" uuid NULL,
        "notes" text NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_intrastat_declarations_tenantId" ON "intrastat_declarations" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_intrastat_declarations_period" ON "intrastat_declarations" ("tenantId", "type", "periodYear", "periodMonth") WHERE "periodMonth" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_intrastat_declarations_status" ON "intrastat_declarations" ("tenantId", "status", "periodYear", "periodMonth")`,
    );

    await queryRunner.query(`
      CREATE TABLE "intrastat_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "declarationId" uuid NOT NULL,
        "position" int NOT NULL,
        "partnerCountry" varchar(2) NOT NULL,
        "partnerVatNumber" varchar(32) NULL,
        "nc8Code" varchar(8) NULL,
        "netMassKg" numeric(12,3) NULL,
        "supplementaryUnits" numeric(14,4) NULL,
        "valueCents" bigint NOT NULL,
        "statisticalValueCents" bigint NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'EUR',
        "naturaTransazione" varchar(2) NULL,
        "modalitaTrasporto" varchar(1) NULL,
        "regimeStatistico" varchar(2) NULL,
        "paeseDestinazioneProvenienza" varchar(2) NULL,
        "paeseOrigine" varchar(2) NULL,
        "sourceDocType" intrastat_source_doc_type_enum NOT NULL,
        "sourceDocId" uuid NOT NULL,
        CONSTRAINT "FK_intrastat_lines_declaration"
          FOREIGN KEY ("declarationId")
          REFERENCES "intrastat_declarations"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_intrastat_lines_tenantId" ON "intrastat_lines" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_intrastat_lines_decl" ON "intrastat_lines" ("tenantId", "declarationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_intrastat_lines_source" ON "intrastat_lines" ("tenantId", "sourceDocType", "sourceDocId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "supplier_invoices" ADD COLUMN IF NOT EXISTS "partnerCountry" varchar(2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_invoices" ADD COLUMN IF NOT EXISTS "partnerVatNumber" varchar(32) NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_invoices_partner_country" ON "supplier_invoices" ("tenantId", "partnerCountry", "supplierInvoiceDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_supplier_invoices_partner_country"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_invoices" DROP COLUMN IF EXISTS "partnerVatNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_invoices" DROP COLUMN IF EXISTS "partnerCountry"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "intrastat_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "intrastat_declarations"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "intrastat_source_doc_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "intrastat_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "intrastat_periodicity_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "intrastat_declaration_type_enum"`,
    );
  }
}
