import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-014 — RequestForQuote schema (Sprint 13 / S13.2).
 *
 * Adds:
 *   - request_for_quotes (header)
 *   - request_for_quote_lines (line items)
 *   - request_for_quote_quotes (per-supplier solicitation + response)
 *
 * tenantId-first composite indexes per R-D01; money in bigint cents per
 * R-D04 / ADR-013.
 */
export class RfqSchema1714100000000 implements MigrationInterface {
  name = 'RfqSchema1714100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."rfq_status_enum" AS ENUM (
      'draft','sent','quotes_received','awarded','converted','expired','cancelled'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."rfq_quote_status_enum" AS ENUM (
      'pending','received','declined'
    )`);

    // request_for_quotes
    await queryRunner.query(`
      CREATE TABLE "request_for_quotes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "rfqNumber" varchar(50) NOT NULL,
        "requesterId" uuid NOT NULL,
        "issueDate" date NOT NULL,
        "validUntilDate" date NOT NULL,
        "status" "public"."rfq_status_enum" NOT NULL DEFAULT 'draft',
        "notes" text,
        "awardedQuoteId" uuid,
        "awardedAt" timestamptz,
        "convertedToPurchaseOrderId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_rfq_tenant_number" ON "request_for_quotes"("tenantId","rfqNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_rfq_tenant_status_valid" ON "request_for_quotes"("tenantId","status","validUntilDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_rfq_tenant" ON "request_for_quotes"("tenantId")`,
    );

    // request_for_quote_lines
    await queryRunner.query(`
      CREATE TABLE "request_for_quote_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "rfqId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "description" varchar(500) NOT NULL,
        "quantity" numeric(14,4) NOT NULL,
        "unitOfMeasure" varchar(20) NOT NULL DEFAULT 'pz',
        "needByDate" date,
        CONSTRAINT "fk_rfql_rfq" FOREIGN KEY ("rfqId") REFERENCES "request_for_quotes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_rfql_tenant_rfq" ON "request_for_quote_lines"("tenantId","rfqId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_rfql_tenant" ON "request_for_quote_lines"("tenantId")`,
    );

    // request_for_quote_quotes (per-supplier solicitation + response)
    await queryRunner.query(`
      CREATE TABLE "request_for_quote_quotes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "rfqId" uuid NOT NULL,
        "supplierId" uuid NOT NULL,
        "status" "public"."rfq_quote_status_enum" NOT NULL DEFAULT 'pending',
        "totalCents" bigint,
        "currency" varchar(3) NOT NULL DEFAULT 'EUR',
        "validUntilDate" date,
        "perLineCosts" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "receivedAt" timestamptz,
        "notes" text,
        CONSTRAINT "fk_rfqq_rfq" FOREIGN KEY ("rfqId") REFERENCES "request_for_quotes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_rfqq_tenant_rfq_supplier" ON "request_for_quote_quotes"("tenantId","rfqId","supplierId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_rfqq_tenant" ON "request_for_quote_quotes"("tenantId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "request_for_quote_quotes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "request_for_quote_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "request_for_quotes"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."rfq_quote_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."rfq_status_enum"`);
  }
}
