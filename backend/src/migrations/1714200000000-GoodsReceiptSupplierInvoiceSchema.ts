import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-015 — GoodsReceipt + SupplierInvoice schema (Sprint 14 / S14.1, S14.2).
 *
 * tenantId-first composite indexes (R-D01); money in bigint cents
 * (R-D04 / ADR-013).
 */
export class GoodsReceiptSupplierInvoiceSchema1714200000000
  implements MigrationInterface
{
  name = 'GoodsReceiptSupplierInvoiceSchema1714200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."goods_receipt_status_enum" AS ENUM (
      'draft','confirmed','partially_inspected','inspected','rejected'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."supplier_invoice_status_enum" AS ENUM (
      'received','matched','approved','disputed','rejected','paid','cancelled'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."supplier_invoice_received_via_enum" AS ENUM (
      'pec','manual','ocr','sdi'
    )`);

    // goods_receipts
    await queryRunner.query(`
      CREATE TABLE "goods_receipts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "grNumber" varchar(50) NOT NULL,
        "poId" uuid NOT NULL,
        "supplierId" uuid NOT NULL,
        "warehouseId" uuid NOT NULL,
        "receiptDate" date NOT NULL,
        "receivedBy" uuid NOT NULL,
        "carrierTrackingNumber" varchar(100),
        "supplierDdtNumber" varchar(100),
        "supplierDdtDate" date,
        "status" "public"."goods_receipt_status_enum" NOT NULL DEFAULT 'draft',
        "notes" text,
        "confirmedAt" timestamptz,
        "inspectedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_gr_tenant_number" ON "goods_receipts"("tenantId","grNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_gr_tenant_po_date" ON "goods_receipts"("tenantId","poId","receiptDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_gr_tenant" ON "goods_receipts"("tenantId")`,
    );

    // goods_receipt_lines
    await queryRunner.query(`
      CREATE TABLE "goods_receipt_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "goodsReceiptId" uuid NOT NULL,
        "poLineId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "receivedQuantity" numeric(14,4) NOT NULL,
        "acceptedQuantity" numeric(14,4) NOT NULL DEFAULT 0,
        "rejectedQuantity" numeric(14,4) NOT NULL DEFAULT 0,
        "rejectReason" text,
        "lotId" uuid,
        "serialIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "inspectionId" uuid,
        "warehouseLocation" varchar(50),
        CONSTRAINT "fk_grl_gr" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_grl_tenant_gr" ON "goods_receipt_lines"("tenantId","goodsReceiptId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_grl_tenant_pol" ON "goods_receipt_lines"("tenantId","poLineId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_grl_tenant" ON "goods_receipt_lines"("tenantId")`,
    );

    // supplier_invoices
    await queryRunner.query(`
      CREATE TABLE "supplier_invoices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "supplierId" uuid NOT NULL,
        "supplierInvoiceNumber" varchar(50) NOT NULL,
        "supplierInvoiceDate" date NOT NULL,
        "receivedDate" timestamptz NOT NULL DEFAULT now(),
        "receivedVia" "public"."supplier_invoice_received_via_enum" NOT NULL DEFAULT 'manual',
        "externalMessageId" varchar(255),
        "fatturaPaXmlPath" varchar(500),
        "subtotalCents" bigint NOT NULL DEFAULT 0,
        "taxCents" bigint NOT NULL DEFAULT 0,
        "totalCents" bigint NOT NULL DEFAULT 0,
        "ivaBreakdown" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "paymentDueDate" date NOT NULL,
        "paymentTermsDays" int NOT NULL DEFAULT 30,
        "status" "public"."supplier_invoice_status_enum" NOT NULL DEFAULT 'received',
        "poIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "discrepancies" jsonb,
        "matchedAt" timestamptz,
        "matchedBy" uuid,
        "approvedAt" timestamptz,
        "approvedBy" uuid,
        "paidAt" timestamptz,
        "paymentBatchId" uuid,
        "notes" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_si_tenant_supp_num" ON "supplier_invoices"("tenantId","supplierId","supplierInvoiceNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_si_tenant_status_due" ON "supplier_invoices"("tenantId","status","paymentDueDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_si_tenant" ON "supplier_invoices"("tenantId")`,
    );

    // supplier_invoice_lines
    await queryRunner.query(`
      CREATE TABLE "supplier_invoice_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "supplierInvoiceId" uuid NOT NULL,
        "description" varchar(500) NOT NULL,
        "quantity" numeric(14,4) NOT NULL,
        "unitOfMeasure" varchar(20) NOT NULL DEFAULT 'pz',
        "unitCostCents" bigint NOT NULL DEFAULT 0,
        "lineTotalCents" bigint NOT NULL DEFAULT 0,
        "taxRate" int NOT NULL DEFAULT 22,
        "taxAmountCents" bigint NOT NULL DEFAULT 0,
        "naturaCode" varchar(10),
        "poLineId" uuid,
        "notes" text,
        CONSTRAINT "fk_sil_si" FOREIGN KEY ("supplierInvoiceId") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_sil_tenant_si" ON "supplier_invoice_lines"("tenantId","supplierInvoiceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sil_tenant_pol" ON "supplier_invoice_lines"("tenantId","poLineId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sil_tenant" ON "supplier_invoice_lines"("tenantId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_invoice_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "goods_receipt_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "goods_receipts"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."supplier_invoice_received_via_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."supplier_invoice_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."goods_receipt_status_enum"`,
    );
  }
}
