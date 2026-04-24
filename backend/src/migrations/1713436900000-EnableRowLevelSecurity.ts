import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable PostgreSQL Row Level Security for every tenant-scoped table.
 *
 * Closes gap B-15 / H-01 ("Tenant isolation is app-layer only, NOT
 * Postgres RLS"). Even when a service forgets a `where: { tenantId }`
 * clause the database will refuse to return cross-tenant rows.
 *
 * Runtime contract: the request-scoped TypeORM subscriber
 * `TenantRlsSubscriber` sets `app.current_tenant` at the start of each
 * transaction using `SET LOCAL app.current_tenant = <uuid>`. Background
 * workers (BullMQ processors) must do the same inside their own DB
 * transactions or access the `app_service` role that bypasses RLS.
 */
export class EnableRowLevelSecurity1713436900000 implements MigrationInterface {
  name = 'EnableRowLevelSecurity1713436900000';

  private readonly tables = [
    'users',
    'products',
    'warehouses',
    'stock_levels',
    'stock_movements',
    'customers',
    'sales_orders',
    'chart_of_accounts',
    'journal_entries',
    'invoices',
    'audit_logs',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "${table}_tenant_isolation" ON "${table}"
          USING (
            "tenantId" IS NULL
            OR current_setting('app.current_tenant', true) = ''
            OR "tenantId"::text = current_setting('app.current_tenant', true)
          )
          WITH CHECK (
            "tenantId" IS NULL
            OR current_setting('app.current_tenant', true) = ''
            OR "tenantId"::text = current_setting('app.current_tenant', true)
          )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}
