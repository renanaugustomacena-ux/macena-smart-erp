import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema migration.
 *
 * Derived from the current entity models in backend/src (`*.entity.ts`)
 * and `auth.service.ts` (inline @Entity). This replaces the dev-time
 * `synchronize: true` behaviour for production deployments.
 *
 * Tables created:
 *   - tenants, users
 *   - products, warehouses, stock_levels, stock_movements
 *   - customers, sales_orders
 *   - production_orders, bills_of_materials, bom_lines, work_orders
 *   - chart_of_accounts, journal_entries, invoices
 *   - audit_logs (per v2.0 §12 / §20.9 — see B-10 in GAPS)
 *
 * PostgreSQL Row Level Security policies are declared by a second
 * migration (1713436900000-EnableRowLevelSecurity) to keep concerns
 * separate and allow the schema migration to run in environments
 * where RLS is managed externally (managed Postgres with restricted
 * ALTER TABLE privileges).
 */
export class InitialSchema1713436800000 implements MigrationInterface {
  name = 'InitialSchema1713436800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums
    await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM ('admin','manager','operator','viewer')`);
    await queryRunner.query(`CREATE TYPE "public"."subscription_plan_enum" AS ENUM ('base','professionale','enterprise')`);
    await queryRunner.query(`CREATE TYPE "public"."tenant_status_enum" AS ENUM ('trial','active','past_due','suspended','cancelled')`);
    await queryRunner.query(`CREATE TYPE "public"."product_category_enum" AS ENUM ('raw_material','semi_finished','finished_product','consumable','packaging','spare_part')`);
    await queryRunner.query(`CREATE TYPE "public"."uom_enum" AS ENUM ('pz','kg','g','l','m','mq','mc','box','pallet')`);
    await queryRunner.query(`CREATE TYPE "public"."stock_movement_type_enum" AS ENUM ('inbound','outbound','transfer','adjustment','production_consumption','production_output','return','scrap')`);
    await queryRunner.query(`CREATE TYPE "public"."customer_type_enum" AS ENUM ('business','public_administration','individual','foreign')`);
    await queryRunner.query(`CREATE TYPE "public"."sales_order_status_enum" AS ENUM ('draft','confirmed','partially_shipped','shipped','invoiced','cancelled')`);
    await queryRunner.query(`CREATE TYPE "public"."account_type_enum" AS ENUM ('asset','liability','equity','revenue','expense','cogs','other')`);
    await queryRunner.query(`CREATE TYPE "public"."invoice_document_type_enum" AS ENUM ('TD01','TD02','TD04','TD05','TD17','TD18','TD19','TD24','TD26')`);
    await queryRunner.query(`CREATE TYPE "public"."invoice_status_enum" AS ENUM ('draft','queued','sent','received','accepted','rejected','not_delivered','expired','cancelled')`);

    // tenants
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "vatNumber" varchar(11),
        "fiscalCode" varchar(16),
        "sdiDestinationCode" varchar(7),
        "pecEmail" varchar(255),
        "billingAddress" text,
        "billingCity" varchar(100),
        "billingPostalCode" varchar(5),
        "billingProvince" varchar(2),
        "billingCountry" varchar(2) DEFAULT 'IT',
        "plan" "public"."subscription_plan_enum" DEFAULT 'base',
        "status" "public"."tenant_status_enum" DEFAULT 'trial',
        "seatLimit" integer DEFAULT 3,
        "trialEndsAt" timestamp,
        "settings" jsonb,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_tenants_vat" ON "tenants"("vatNumber") WHERE "vatNumber" IS NOT NULL`);

    // users (matches entity in auth.service.ts)
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "firstName" varchar(100) NOT NULL,
        "lastName" varchar(100) NOT NULL,
        "email" varchar(255) NOT NULL,
        "passwordHash" varchar NOT NULL,
        "companyName" varchar(255) NOT NULL,
        "phone" varchar(20),
        "partitaIva" varchar(11),
        "role" "public"."user_role_enum" DEFAULT 'admin',
        "tenantId" uuid,
        "refreshTokenHash" varchar,
        "tokenVersion" integer DEFAULT 0,
        "isActive" boolean DEFAULT true,
        "lastLoginAt" timestamp,
        "failedLoginAttempts" integer DEFAULT 0,
        "lockedUntil" timestamp,
        "sessionCreatedAt" timestamp,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_users_email" ON "users"("email")`);
    await queryRunner.query(`CREATE INDEX "ix_users_tenant" ON "users"("tenantId")`);

    // products
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "sku" varchar(50) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "category" "public"."product_category_enum" NOT NULL,
        "unitOfMeasure" "public"."uom_enum" DEFAULT 'pz',
        "unitCost" decimal(10,2) DEFAULT 0,
        "sellingPrice" decimal(10,2) DEFAULT 0,
        "weight" decimal(10,2) DEFAULT 0,
        "barcode" varchar(50),
        "minimumStock" integer DEFAULT 0,
        "reorderPoint" integer DEFAULT 0,
        "reorderQuantity" integer DEFAULT 0,
        "leadTimeDays" integer DEFAULT 0,
        "supplier" varchar(100),
        "isActive" boolean DEFAULT true,
        "metadata" jsonb,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_products_tenant_sku" ON "products"("tenantId","sku")`);

    // warehouses
    await queryRunner.query(`
      CREATE TABLE "warehouses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "code" varchar(20) NOT NULL,
        "name" varchar(255) NOT NULL,
        "address" text,
        "city" varchar(100),
        "postalCode" varchar(5),
        "province" varchar(100),
        "contactPerson" varchar(100),
        "contactPhone" varchar(20),
        "capacitySquareMeters" decimal(10,2),
        "isActive" boolean DEFAULT true,
        "zones" jsonb,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_wh_tenant_code" ON "warehouses"("tenantId","code")`);

    // stock_levels
    await queryRunner.query(`
      CREATE TABLE "stock_levels" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "warehouseId" uuid NOT NULL,
        "quantityOnHand" decimal(12,2) DEFAULT 0,
        "quantityReserved" decimal(12,2) DEFAULT 0,
        "quantityOnOrder" decimal(12,2) DEFAULT 0,
        "zone" varchar(50),
        "location" varchar(50),
        "lastCountDate" timestamp,
        "updatedAt" timestamp DEFAULT now(),
        CONSTRAINT "fk_sl_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_sl_warehouse" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_sl_tenant_prod_wh" ON "stock_levels"("tenantId","productId","warehouseId")`);

    // stock_movements
    await queryRunner.query(`
      CREATE TABLE "stock_movements" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "movementType" "public"."stock_movement_type_enum" NOT NULL,
        "quantity" decimal(12,2) NOT NULL,
        "sourceWarehouseId" uuid,
        "destinationWarehouseId" uuid,
        "referenceNumber" varchar(100),
        "notes" text,
        "performedBy" varchar(100),
        "unitCostAtTime" decimal(10,2),
        "createdAt" timestamp DEFAULT now(),
        CONSTRAINT "fk_sm_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_sm_tenant_created" ON "stock_movements"("tenantId","createdAt")`);

    // customers
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "code" varchar(50) NOT NULL,
        "name" varchar(255) NOT NULL,
        "customerType" "public"."customer_type_enum" DEFAULT 'business',
        "vatNumber" varchar(11),
        "fiscalCode" varchar(16),
        "sdiDestinationCode" varchar(7),
        "pecEmail" varchar(255),
        "email" varchar(255),
        "phone" varchar(30),
        "address" text,
        "city" varchar(100),
        "postalCode" varchar(5),
        "province" varchar(2),
        "country" varchar(2) DEFAULT 'IT',
        "defaultIvaRate" integer DEFAULT 22,
        "paymentTermsDays" integer DEFAULT 30,
        "splitPayment" boolean DEFAULT false,
        "isActive" boolean DEFAULT true,
        "notes" jsonb,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_customers_tenant_code" ON "customers"("tenantId","code")`);

    // sales_orders
    await queryRunner.query(`
      CREATE TABLE "sales_orders" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "orderNumber" varchar(50) NOT NULL,
        "customerId" uuid NOT NULL,
        "status" "public"."sales_order_status_enum" DEFAULT 'draft',
        "orderDate" date NOT NULL,
        "requestedDeliveryDate" date,
        "customerPoReference" varchar(100),
        "subtotalAmount" decimal(12,2) DEFAULT 0,
        "taxAmount" decimal(12,2) DEFAULT 0,
        "totalAmount" decimal(12,2) DEFAULT 0,
        "notes" text,
        "lines" jsonb DEFAULT '[]'::jsonb,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        CONSTRAINT "fk_so_customer" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_so_tenant_number" ON "sales_orders"("tenantId","orderNumber")`);

    // chart_of_accounts
    await queryRunner.query(`
      CREATE TABLE "chart_of_accounts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "code" varchar(20) NOT NULL,
        "description" varchar(255) NOT NULL,
        "type" "public"."account_type_enum" NOT NULL,
        "parentCode" varchar(20),
        "isActive" boolean DEFAULT true,
        "isBankAccount" boolean DEFAULT false,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_coa_tenant_code" ON "chart_of_accounts"("tenantId","code")`);

    // journal_entries
    await queryRunner.query(`
      CREATE TABLE "journal_entries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "reference" varchar(50) NOT NULL,
        "entryDate" date NOT NULL,
        "journal" varchar(50),
        "description" varchar(500) NOT NULL,
        "lines" jsonb NOT NULL,
        "totalDebit" decimal(12,2) NOT NULL,
        "totalCredit" decimal(12,2) NOT NULL,
        "isPosted" boolean DEFAULT false,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_je_tenant_date" ON "journal_entries"("tenantId","entryDate")`);

    // invoices
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "documentType" "public"."invoice_document_type_enum" DEFAULT 'TD01',
        "number" varchar(20) NOT NULL,
        "fiscalYear" integer NOT NULL,
        "invoiceDate" date NOT NULL,
        "customerId" uuid NOT NULL,
        "customerName" varchar(255) NOT NULL,
        "customerVatNumber" varchar(11),
        "customerFiscalCode" varchar(16),
        "customerSdiCode" varchar(7),
        "customerPecEmail" varchar(255),
        "status" "public"."invoice_status_enum" DEFAULT 'draft',
        "subtotalAmount" decimal(12,2) DEFAULT 0,
        "taxAmount" decimal(12,2) DEFAULT 0,
        "totalAmount" decimal(12,2) DEFAULT 0,
        "lines" jsonb DEFAULT '[]'::jsonb,
        "xmlPath" varchar(500),
        "receiptPath" varchar(500),
        "archivePath" varchar(500),
        "submittedAt" timestamp,
        "archivedAt" timestamp,
        "notes" text,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_inv_tenant_num_year" ON "invoices"("tenantId","number","fiscalYear")`);

    // audit_logs (v2.0 §12, §20.9) - used by the audit interceptor
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid,
        "userId" uuid,
        "actorEmail" varchar(255),
        "action" varchar(100) NOT NULL,
        "resourceType" varchar(100),
        "resourceId" varchar(100),
        "method" varchar(10) NOT NULL,
        "path" varchar(500) NOT NULL,
        "statusCode" integer,
        "ipAddress" varchar(45),
        "userAgent" varchar(500),
        "correlationId" varchar(100),
        "diff" jsonb,
        "outcome" varchar(20) NOT NULL DEFAULT 'success',
        "createdAt" timestamp DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_audit_tenant_time" ON "audit_logs"("tenantId","createdAt")`);
    await queryRunner.query(`CREATE INDEX "ix_audit_corr" ON "audit_logs"("correlationId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "audit_logs"');
    await queryRunner.query('DROP TABLE IF EXISTS "invoices"');
    await queryRunner.query('DROP TABLE IF EXISTS "journal_entries"');
    await queryRunner.query('DROP TABLE IF EXISTS "chart_of_accounts"');
    await queryRunner.query('DROP TABLE IF EXISTS "sales_orders"');
    await queryRunner.query('DROP TABLE IF EXISTS "customers"');
    await queryRunner.query('DROP TABLE IF EXISTS "stock_movements"');
    await queryRunner.query('DROP TABLE IF EXISTS "stock_levels"');
    await queryRunner.query('DROP TABLE IF EXISTS "warehouses"');
    await queryRunner.query('DROP TABLE IF EXISTS "products"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
    await queryRunner.query('DROP TABLE IF EXISTS "tenants"');

    for (const t of [
      'invoice_status_enum',
      'invoice_document_type_enum',
      'account_type_enum',
      'sales_order_status_enum',
      'customer_type_enum',
      'stock_movement_type_enum',
      'uom_enum',
      'product_category_enum',
      'tenant_status_enum',
      'subscription_plan_enum',
      'user_role_enum',
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS "public"."${t}"`);
    }
  }
}
