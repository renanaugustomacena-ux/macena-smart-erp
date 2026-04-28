import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-023 — Treasury foundation (plan §31.1 Sprint 23 / S23.1).
 */
export class TreasurySchema1715000000000 implements MigrationInterface {
  name = 'TreasurySchema1715000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "bank_account_status_enum" AS ENUM ('active', 'inactive', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "psd2_provider_enum" AS ENUM ('intesa', 'unicredit', 'bper', 'manual')`,
    );
    await queryRunner.query(
      `CREATE TYPE "bank_tx_reconciliation_status_enum" AS ENUM ('unmatched', 'matched', 'partial', 'ignored')`,
    );

    await queryRunner.query(`
      CREATE TABLE "bank_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "ibanEncrypted" varchar(500) NOT NULL,
        "ibanMasked" varchar(12) NULL,
        "bicSwift" varchar(11) NULL,
        "bankName" varchar(100) NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'EUR',
        "psd2Provider" psd2_provider_enum NOT NULL DEFAULT 'manual',
        "psd2Consent" jsonb NULL,
        "status" bank_account_status_enum NOT NULL DEFAULT 'active',
        "lastTransactionCursor" varchar(200) NULL,
        "lastSyncedAt" timestamptz NULL,
        "notes" text NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_bank_accounts_tenantId" ON "bank_accounts" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bank_accounts_tenant_name" ON "bank_accounts" ("tenantId", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bank_accounts_tenant_status" ON "bank_accounts" ("tenantId", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "bank_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "bankAccountId" uuid NOT NULL,
        "externalId" varchar(200) NOT NULL,
        "valueDate" date NOT NULL,
        "bookingDate" date NOT NULL,
        "amountCents" bigint NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'EUR',
        "description" varchar(500) NOT NULL,
        "counterpartyName" varchar(200) NULL,
        "counterpartyIbanEncrypted" varchar(500) NULL,
        "reconciliationStatus" bank_tx_reconciliation_status_enum NOT NULL DEFAULT 'unmatched',
        "matchedDocumentType" varchar(50) NULL,
        "matchedDocumentId" uuid NULL,
        "matchedAt" timestamptz NULL,
        "matchedBy" uuid NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_bank_transactions_account"
          FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_bank_tx_tenantId" ON "bank_transactions" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bank_tx_account" ON "bank_transactions" ("tenantId", "bankAccountId", "valueDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bank_tx_status" ON "bank_transactions" ("tenantId", "reconciliationStatus")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bank_tx_external" ON "bank_transactions" ("tenantId", "externalId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_accounts"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bank_tx_reconciliation_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "psd2_provider_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bank_account_status_enum"`);
  }
}
