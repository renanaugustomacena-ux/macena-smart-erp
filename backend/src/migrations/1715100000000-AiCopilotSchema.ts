import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-024 — AI Copilot per-tenant per-day token counters
 * (plan §31.2 Sprint 25 / S25.5).
 */
export class AiCopilotSchema1715100000000 implements MigrationInterface {
  name = 'AiCopilotSchema1715100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "copilot_cost_counters" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "date" date NOT NULL,
        "inputTokens" bigint NOT NULL DEFAULT 0,
        "outputTokens" bigint NOT NULL DEFAULT 0,
        "cacheCreationTokens" bigint NOT NULL DEFAULT 0,
        "cacheReadTokens" bigint NOT NULL DEFAULT 0,
        "turnsCount" int NOT NULL DEFAULT 0,
        "capRejectionsCount" int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_copilot_cost_tenantId" ON "copilot_cost_counters" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_copilot_cost_tenant_date" ON "copilot_cost_counters" ("tenantId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_copilot_cost_date" ON "copilot_cost_counters" ("date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "copilot_cost_counters"`,
    );
  }
}
