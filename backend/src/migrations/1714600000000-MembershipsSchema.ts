import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-019 — memberships table + home-tenant backfill (plan §31.1 Sprint 16 / S16.3).
 *
 * Introduces the multi-tenant Membership join behind the "Andrea pattern":
 * a single user identity can belong to N tenants with a per-tenant role.
 *
 * Backfill: every existing user with a non-null `tenantId` gets an `active`
 * membership for that tenant carrying the user's current `role`. This keeps
 * the existing single-tenant flow working (login mints a JWT for the home
 * tenant) while letting the `MembershipsService` add cross-tenant rows
 * (e.g., commercialista access to client tenants).
 */
export class MembershipsSchema1714600000000 implements MigrationInterface {
  name = 'MembershipsSchema1714600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "membership_role_enum" AS ENUM ('admin', 'manager', 'operator', 'viewer', 'commercialista')`,
    );
    await queryRunner.query(
      `CREATE TYPE "membership_status_enum" AS ENUM ('pending', 'active', 'revoked')`,
    );

    await queryRunner.query(`
      CREATE TABLE "memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" membership_role_enum NOT NULL DEFAULT 'viewer',
        "status" membership_status_enum NOT NULL DEFAULT 'pending',
        "invitedAt" timestamptz NULL,
        "consentedAt" timestamptz NULL,
        "grantedAt" timestamptz NULL,
        "revokedAt" timestamptz NULL,
        "invitedBy" uuid NULL,
        "revokedBy" uuid NULL,
        "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "notes" text NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_memberships_tenant_user" ON "memberships" ("tenantId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_memberships_userId" ON "memberships" ("userId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_memberships_role" ON "memberships" ("tenantId", "role", "status")`,
    );

    // Home-tenant backfill — one active membership per user with a tenantId.
    await queryRunner.query(`
      INSERT INTO "memberships" ("tenantId", "userId", "role", "status", "grantedAt")
      SELECT u."tenantId", u."id", u."role"::text::membership_role_enum, 'active', now()
      FROM "users" u
      WHERE u."tenantId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "memberships" m
          WHERE m."tenantId" = u."tenantId" AND m."userId" = u."id"
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "memberships"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "membership_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "membership_role_enum"`);
  }
}
