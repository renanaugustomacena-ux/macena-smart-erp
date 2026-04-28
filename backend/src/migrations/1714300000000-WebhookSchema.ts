import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-016 — Webhook subscriptions + outbox + delivery attempts + DLQ
 * (Sprint 14 / S14.6; ADR-037).
 *
 * tenantId-first composite indexes (R-D01); jsonb for CloudEvents
 * payload; HMAC secret column carries ciphertext (ADR-DA07).
 */
export class WebhookSchema1714300000000 implements MigrationInterface {
  name = 'WebhookSchema1714300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."webhook_subscription_status_enum" AS ENUM (
      'active','paused','disabled'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."webhook_delivery_outcome_enum" AS ENUM (
      'success_2xx','client_4xx','server_5xx','timeout','connection_refused',
      'tls_error','gone_410','not_found_404','rate_limited_429','unknown'
    )`);

    // webhook_subscriptions
    await queryRunner.query(`
      CREATE TABLE "webhook_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "eventType" varchar(200) NOT NULL,
        "targetUrl" varchar(1000) NOT NULL,
        "hmacSecret" varchar(4000) NOT NULL,
        "status" "public"."webhook_subscription_status_enum" NOT NULL DEFAULT 'active',
        "disabledReason" text,
        "disabledAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_whsub_tenant_event_status" ON "webhook_subscriptions"("tenantId","eventType","status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_whsub_tenant_status" ON "webhook_subscriptions"("tenantId","status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_whsub_tenant" ON "webhook_subscriptions"("tenantId")`,
    );

    // webhook_outbox_events
    await queryRunner.query(`
      CREATE TABLE "webhook_outbox_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "eventType" varchar(200) NOT NULL,
        "source" varchar(500) NOT NULL,
        "eventTime" timestamptz NOT NULL,
        "data" jsonb NOT NULL,
        "dispatchedAt" timestamptz,
        "completedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_whoutbox_tenant_completed" ON "webhook_outbox_events"("tenantId","completedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_whoutbox_tenant_event_created" ON "webhook_outbox_events"("tenantId","eventType","createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_whoutbox_tenant" ON "webhook_outbox_events"("tenantId")`,
    );

    // webhook_delivery_attempts
    await queryRunner.query(`
      CREATE TABLE "webhook_delivery_attempts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "subscriptionId" uuid NOT NULL,
        "outboxEventId" uuid NOT NULL,
        "attemptNumber" int NOT NULL,
        "outcome" "public"."webhook_delivery_outcome_enum" NOT NULL,
        "httpStatus" int,
        "durationMs" int NOT NULL,
        "errorMessage" text,
        "deliveryId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_whatt_tenant_sub_created" ON "webhook_delivery_attempts"("tenantId","subscriptionId","createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_whatt_tenant_outbox" ON "webhook_delivery_attempts"("tenantId","outboxEventId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_whatt_tenant_outcome_created" ON "webhook_delivery_attempts"("tenantId","outcome","createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_whatt_tenant" ON "webhook_delivery_attempts"("tenantId")`,
    );

    // webhook_dlq_entries
    await queryRunner.query(`
      CREATE TABLE "webhook_dlq_entries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "subscriptionId" uuid NOT NULL,
        "outboxEventId" uuid NOT NULL,
        "eventType" varchar(200) NOT NULL,
        "totalAttempts" int NOT NULL,
        "lastOutcome" varchar(32) NOT NULL,
        "lastHttpStatus" int,
        "lastErrorMessage" text,
        "replayedAt" timestamptz,
        "replayedBy" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_whdlq_tenant_sub_created" ON "webhook_dlq_entries"("tenantId","subscriptionId","createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_whdlq_tenant_event_created" ON "webhook_dlq_entries"("tenantId","eventType","createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_whdlq_tenant" ON "webhook_dlq_entries"("tenantId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_dlq_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_delivery_attempts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_outbox_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_subscriptions"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."webhook_delivery_outcome_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."webhook_subscription_status_enum"`,
    );
  }
}
