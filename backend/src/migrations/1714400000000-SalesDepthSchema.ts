import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-017 — Quotation + DDT + ContactActivity (Sprint 15 / S15.1, S15.2, S15.3).
 *
 * tenantId-first composite indexes (R-D01); money in bigint cents
 * (R-D04 / ADR-013).
 */
export class SalesDepthSchema1714400000000 implements MigrationInterface {
  name = 'SalesDepthSchema1714400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."quotation_status_enum" AS ENUM (
      'draft','sent','revised','accepted','rejected','expired','converted'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."ddt_status_enum" AS ENUM (
      'draft','issued','in_transit','delivered','invoiced','returned','lost','disputed','cancelled'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."ddt_causale_enum" AS ENUM (
      'vendita','conto_visione','conto_lavorazione','reso','tentata_vendita','campionatura','altro'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."contact_activity_kind_enum" AS ENUM (
      'call','email','meeting','demo','visit','note'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."contact_activity_direction_enum" AS ENUM (
      'inbound','outbound','internal'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."contact_activity_linked_enum" AS ENUM (
      'customer','quotation','sales_order','invoice','ddt','rfq','complaint'
    )`);

    // quotations
    await queryRunner.query(`
      CREATE TABLE "quotations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "quotationNumber" varchar(50) NOT NULL,
        "customerId" uuid NOT NULL,
        "issueDate" date NOT NULL,
        "validUntilDate" date NOT NULL,
        "status" "public"."quotation_status_enum" NOT NULL DEFAULT 'draft',
        "subtotalCents" bigint NOT NULL DEFAULT 0,
        "taxCents" bigint NOT NULL DEFAULT 0,
        "totalCents" bigint NOT NULL DEFAULT 0,
        "currency" varchar(3) NOT NULL DEFAULT 'EUR',
        "notes" text,
        "sentAt" timestamptz,
        "acceptedAt" timestamptz,
        "rejectedAt" timestamptz,
        "rejectionReason" text,
        "convertedToSalesOrderId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_quot_tenant_number" ON "quotations"("tenantId","quotationNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_quot_tenant_status_issue" ON "quotations"("tenantId","status","issueDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_quot_tenant_customer_issue" ON "quotations"("tenantId","customerId","issueDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_quot_tenant" ON "quotations"("tenantId")`,
    );

    // quotation_lines
    await queryRunner.query(`
      CREATE TABLE "quotation_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "quotationId" uuid NOT NULL,
        "productId" uuid,
        "description" varchar(500) NOT NULL,
        "quantity" numeric(14,4) NOT NULL,
        "unitOfMeasure" varchar(20) NOT NULL DEFAULT 'pz',
        "unitPriceCents" bigint NOT NULL DEFAULT 0,
        "discountPct" numeric(5,2) NOT NULL DEFAULT 0,
        "taxRate" int NOT NULL DEFAULT 22,
        "lineTotalCents" bigint NOT NULL DEFAULT 0,
        CONSTRAINT "fk_qline_quot" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_qline_tenant_quot" ON "quotation_lines"("tenantId","quotationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_qline_tenant" ON "quotation_lines"("tenantId")`,
    );

    // ddts
    await queryRunner.query(`
      CREATE TABLE "ddts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "ddtNumber" varchar(50) NOT NULL,
        "customerId" uuid NOT NULL,
        "salesOrderId" uuid,
        "issueDate" date NOT NULL,
        "shippedAt" timestamptz,
        "deliveredAt" timestamptz,
        "status" "public"."ddt_status_enum" NOT NULL DEFAULT 'draft',
        "causaleTrasporto" "public"."ddt_causale_enum" NOT NULL DEFAULT 'vendita',
        "carrierId" uuid,
        "trackingNumber" varchar(100),
        "packageCount" int NOT NULL DEFAULT 1,
        "totalWeightKg" numeric(10,3),
        "shipFromAddress" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "shipToAddress" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "invoiceId" uuid,
        "notes" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_ddt_tenant_number" ON "ddts"("tenantId","ddtNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_ddt_tenant_status_issue" ON "ddts"("tenantId","status","issueDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_ddt_tenant_customer_issue" ON "ddts"("tenantId","customerId","issueDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_ddt_tenant_so" ON "ddts"("tenantId","salesOrderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_ddt_tenant" ON "ddts"("tenantId")`,
    );

    // ddt_lines
    await queryRunner.query(`
      CREATE TABLE "ddt_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "ddtId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "salesOrderLineId" uuid,
        "description" varchar(500) NOT NULL,
        "quantity" numeric(14,4) NOT NULL,
        "unitOfMeasure" varchar(20) NOT NULL DEFAULT 'pz',
        "serialIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "lotId" uuid,
        CONSTRAINT "fk_dline_ddt" FOREIGN KEY ("ddtId") REFERENCES "ddts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_dline_tenant_ddt" ON "ddt_lines"("tenantId","ddtId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_dline_tenant_sol" ON "ddt_lines"("tenantId","salesOrderLineId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_dline_tenant" ON "ddt_lines"("tenantId")`,
    );

    // contact_activities
    await queryRunner.query(`
      CREATE TABLE "contact_activities" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "customerId" uuid NOT NULL,
        "contactPersonId" uuid,
        "kind" "public"."contact_activity_kind_enum" NOT NULL,
        "direction" "public"."contact_activity_direction_enum" NOT NULL DEFAULT 'outbound',
        "occurredAt" timestamptz NOT NULL,
        "durationMinutes" int,
        "subject" varchar(200) NOT NULL,
        "body" text,
        "linkedEntityType" "public"."contact_activity_linked_enum" NOT NULL DEFAULT 'customer',
        "linkedEntityId" uuid,
        "recordedBy" uuid NOT NULL,
        "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_ca_tenant_customer_at" ON "contact_activities"("tenantId","customerId","occurredAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_ca_tenant_kind_at" ON "contact_activities"("tenantId","kind","occurredAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_ca_tenant_linked" ON "contact_activities"("tenantId","linkedEntityType","linkedEntityId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_ca_tenant_at" ON "contact_activities"("tenantId","occurredAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_ca_tenant" ON "contact_activities"("tenantId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_activities"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ddt_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ddts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quotation_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quotations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."contact_activity_linked_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."contact_activity_direction_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."contact_activity_kind_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."ddt_causale_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."ddt_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."quotation_status_enum"`);
  }
}
