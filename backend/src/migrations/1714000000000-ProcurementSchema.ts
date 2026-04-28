import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-013 — Procurement schema (Sprint 13).
 *
 * Adds:
 *   - purchase_requisitions, purchase_requisition_lines
 *   - purchase_orders, purchase_order_lines
 *
 * Both aggregate roots carry tenantId-first composite indexes per R-D01
 * (see docs/audits/M-001-tenantid-index-audit.md). Money columns are
 * `bigint cents` per R-D04 / ADR-013.
 */
export class ProcurementSchema1714000000000 implements MigrationInterface {
  name = 'ProcurementSchema1714000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- enums -----------------------------------------------------
    await queryRunner.query(`CREATE TYPE "public"."purchase_requisition_status_enum" AS ENUM (
      'draft','submitted','approved','rejected','converted','cancelled'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."purchase_order_status_enum" AS ENUM (
      'draft','sent','acknowledged','partially_received','received','invoiced','closed','cancelled'
    )`);

    // --- purchase_requisitions ------------------------------------
    await queryRunner.query(`
      CREATE TABLE "purchase_requisitions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "requisitionNumber" varchar(50) NOT NULL,
        "requestedBy" uuid NOT NULL,
        "requestedDate" date NOT NULL,
        "needByDate" date,
        "status" "public"."purchase_requisition_status_enum" NOT NULL DEFAULT 'draft',
        "approverChain" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "totalEstimateCents" bigint NOT NULL DEFAULT 0,
        "notes" text,
        "convertedToPurchaseOrderId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_pr_tenant_number" ON "purchase_requisitions"("tenantId","requisitionNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_pr_tenant_status_created" ON "purchase_requisitions"("tenantId","status","createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_pr_tenant" ON "purchase_requisitions"("tenantId")`,
    );

    // --- purchase_requisition_lines -------------------------------
    await queryRunner.query(`
      CREATE TABLE "purchase_requisition_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "requisitionId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "description" varchar(500) NOT NULL,
        "quantity" numeric(14,4) NOT NULL,
        "unitOfMeasure" varchar(20) NOT NULL DEFAULT 'pz',
        "estimatedUnitCostCents" bigint NOT NULL DEFAULT 0,
        "preferredSupplierId" uuid,
        "needByDate" date,
        "notes" text,
        CONSTRAINT "fk_prl_req" FOREIGN KEY ("requisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_prl_tenant_req" ON "purchase_requisition_lines"("tenantId","requisitionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_prl_tenant" ON "purchase_requisition_lines"("tenantId")`,
    );

    // --- purchase_orders ------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "purchase_orders" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "poNumber" varchar(50) NOT NULL,
        "supplierId" uuid NOT NULL,
        "requisitionId" uuid,
        "orderDate" date NOT NULL,
        "expectedDeliveryDate" date,
        "shipToWarehouseId" uuid,
        "status" "public"."purchase_order_status_enum" NOT NULL DEFAULT 'draft',
        "paymentTermsDays" int NOT NULL DEFAULT 30,
        "paymentMethod" varchar(50) NOT NULL DEFAULT 'sepa_bank_transfer',
        "shippingTermsIncoterms" varchar(3),
        "currency" varchar(3) NOT NULL DEFAULT 'EUR',
        "subtotalCents" bigint NOT NULL DEFAULT 0,
        "taxCents" bigint NOT NULL DEFAULT 0,
        "totalCents" bigint NOT NULL DEFAULT 0,
        "notes" text,
        "sentAt" timestamptz,
        "acknowledgedAt" timestamptz,
        "closedAt" timestamptz,
        "cancelledAt" timestamptz,
        "cancellationReason" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_po_tenant_number" ON "purchase_orders"("tenantId","poNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_po_tenant_status_date" ON "purchase_orders"("tenantId","status","orderDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_po_tenant" ON "purchase_orders"("tenantId")`,
    );

    // --- purchase_order_lines -------------------------------------
    await queryRunner.query(`
      CREATE TABLE "purchase_order_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "purchaseOrderId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "description" varchar(500) NOT NULL,
        "quantity" numeric(14,4) NOT NULL,
        "unitOfMeasure" varchar(20) NOT NULL DEFAULT 'pz',
        "unitCostCents" bigint NOT NULL DEFAULT 0,
        "lineTotalCents" bigint NOT NULL DEFAULT 0,
        "taxRate" int NOT NULL DEFAULT 22,
        "taxAmountCents" bigint NOT NULL DEFAULT 0,
        "expectedDeliveryDate" date,
        "receivedQuantity" numeric(14,4) NOT NULL DEFAULT 0,
        "invoicedQuantity" numeric(14,4) NOT NULL DEFAULT 0,
        "notes" text,
        CONSTRAINT "fk_pol_po" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_pol_tenant_po" ON "purchase_order_lines"("tenantId","purchaseOrderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_pol_tenant" ON "purchase_order_lines"("tenantId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_order_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_requisition_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_requisitions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."purchase_order_status_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."purchase_requisition_status_enum"`,
    );
  }
}
