import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-022 — SSO config schema (plan §31.1 Sprint 22 / S22.5).
 */
export class SsoSchema1714900000000 implements MigrationInterface {
  name = 'SsoSchema1714900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "sso_protocol_enum" AS ENUM ('saml2', 'scim2')`,
    );
    await queryRunner.query(
      `CREATE TYPE "sso_status_enum" AS ENUM ('active', 'paused', 'pending')`,
    );
    await queryRunner.query(`
      CREATE TABLE "sso_configs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "protocol" sso_protocol_enum NOT NULL,
        "status" sso_status_enum NOT NULL DEFAULT 'pending',
        "idpEntityId" varchar(1000) NULL,
        "idpSsoUrl" varchar(1000) NULL,
        "idpX509Cert" text NULL,
        "attributeMappingEmail" varchar(100) NULL,
        "attributeMappingName" varchar(100) NULL,
        "defaultRole" varchar(50) NOT NULL DEFAULT 'viewer',
        "scimBearerTokenHash" varchar(200) NULL,
        "breakGlassEmail" varchar(255) NULL,
        "breakGlassRotatedAt" timestamptz NULL,
        "notes" text NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sso_configs_tenantId" ON "sso_configs" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_sso_configs_tenant_protocol" ON "sso_configs" ("tenantId", "protocol")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sso_configs_tenant_status" ON "sso_configs" ("tenantId", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sso_configs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sso_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sso_protocol_enum"`);
  }
}
