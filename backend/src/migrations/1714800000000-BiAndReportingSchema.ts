import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-021 — BI / CQRS read-model + reporting schema
 * (plan §31.1 Sprint 18 / S18.1, S18.3, S18.6).
 */
export class BiAndReportingSchema1714800000000 implements MigrationInterface {
  name = 'BiAndReportingSchema1714800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "projection_cursor_status_enum" AS ENUM ('idle', 'running', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "report_schedule_status_enum" AS ENUM ('active', 'paused', 'failed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "report_schedule_channel_enum" AS ENUM ('email', 'pec')`,
    );
    await queryRunner.query(
      `CREATE TYPE "report_schedule_format_enum" AS ENUM ('pdf', 'xlsx', 'csv')`,
    );

    await queryRunner.query(`
      CREATE TABLE "read_model_rows" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "projectionId" varchar(100) NOT NULL,
        "key" varchar(200) NOT NULL,
        "payload" jsonb NOT NULL,
        "version" int NOT NULL DEFAULT 1,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_read_model_rows_tenantId" ON "read_model_rows" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_read_model_rows_unique" ON "read_model_rows" ("tenantId", "projectionId", "key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_read_model_rows_projection_updated" ON "read_model_rows" ("tenantId", "projectionId", "updatedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_read_model_rows_projection" ON "read_model_rows" ("projectionId", "updatedAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "projection_cursors" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "projectionId" varchar(100) NOT NULL,
        "lastProcessedAt" timestamptz NULL,
        "lastProcessedSourceId" uuid NULL,
        "rowsProjected" int NOT NULL DEFAULT 0,
        "status" projection_cursor_status_enum NOT NULL DEFAULT 'idle',
        "lastError" text NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_projection_cursors_tenantId" ON "projection_cursors" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_projection_cursors_unique" ON "projection_cursors" ("tenantId", "projectionId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "report_definitions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "description" varchar(500) NULL,
        "createdBy" uuid NOT NULL,
        "body" jsonb NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_report_definitions_tenantId" ON "report_definitions" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_report_definitions_unique" ON "report_definitions" ("tenantId", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_report_definitions_creator" ON "report_definitions" ("tenantId", "createdBy")`,
    );

    await queryRunner.query(`
      CREATE TABLE "report_schedules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "reportDefinitionId" uuid NOT NULL,
        "cronExpression" varchar(50) NOT NULL,
        "timezone" varchar(5) NOT NULL,
        "channel" report_schedule_channel_enum NOT NULL DEFAULT 'email',
        "recipients" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "format" report_schedule_format_enum NOT NULL DEFAULT 'pdf',
        "status" report_schedule_status_enum NOT NULL DEFAULT 'active',
        "nextRunAt" timestamptz NULL,
        "lastRunAt" timestamptz NULL,
        "lastError" text NULL,
        "createdBy" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_report_schedules_tenantId" ON "report_schedules" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_report_schedules_definition" ON "report_schedules" ("tenantId", "reportDefinitionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_report_schedules_due" ON "report_schedules" ("tenantId", "status", "nextRunAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_schedules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_definitions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projection_cursors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "read_model_rows"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_schedule_format_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_schedule_channel_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_schedule_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "projection_cursor_status_enum"`);
  }
}
