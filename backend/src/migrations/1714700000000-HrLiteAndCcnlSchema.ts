import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M-020 — HR-lite + CCNL reference data (plan §31.1 Sprint 17 / S17.1..S17.4).
 *
 * Tables:
 *   - employees
 *   - attendances
 *   - leave_requests
 *   - ccnls (global reference)
 *   - ccnl_pay_grades (global reference)
 *   - ccnl_leave_entitlements (global reference)
 *
 * Reference-data seed: CCNL Metalmeccanico Industria + CCNL Commercio
 * Terziario, the two contracts that cover the largest share of the
 * SmartERP target base (Verona / Veneto manifatturiere SMEs + their
 * commerciale subsidiaries).
 */
export class HrLiteAndCcnlSchema1714700000000 implements MigrationInterface {
  name = 'HrLiteAndCcnlSchema1714700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── enums ────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "employee_status_enum" AS ENUM ('prospect', 'onboarding', 'active', 'terminated')`,
    );
    await queryRunner.query(
      `CREATE TYPE "employee_contract_type_enum" AS ENUM ('indeterminato', 'determinato', 'apprendistato', 'somministrazione', 'cococo', 'stage', 'collaborazione_occasionale')`,
    );
    await queryRunner.query(
      `CREATE TYPE "attendance_status_enum" AS ENUM ('open', 'closed', 'auto_closed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "attendance_location_enum" AS ENUM ('office', 'remote', 'site', 'travel', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "leave_status_enum" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "leave_type_enum" AS ENUM ('ferie', 'permesso_retribuito', 'permesso_non_retribuito', 'malattia', 'congedo_maternita', 'congedo_paternita', 'congedo_parentale', 'congedo_matrimoniale', 'lutto', 'l104', 'altro')`,
    );

    // ─── employees ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "employeeNumber" varchar(50) NOT NULL,
        "firstName" varchar(100) NOT NULL,
        "lastName" varchar(100) NOT NULL,
        "fiscalCode" varchar(16) NULL,
        "email" varchar(255) NULL,
        "phone" varchar(30) NULL,
        "dateOfBirth" date NULL,
        "placeOfBirth" varchar(100) NULL,
        "nationality" varchar(2) NULL,
        "residenceAddress" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "contractType" employee_contract_type_enum NOT NULL DEFAULT 'indeterminato',
        "ccnlCode" varchar(50) NULL,
        "payGradeCode" varchar(50) NULL,
        "weeklyHours" numeric(4,2) NOT NULL DEFAULT 40,
        "monthlyWageCents" bigint NOT NULL DEFAULT 0,
        "hourlyWageCents" bigint NOT NULL DEFAULT 0,
        "hireDate" date NULL,
        "terminationDate" date NULL,
        "terminationReason" text NULL,
        "status" employee_status_enum NOT NULL DEFAULT 'prospect',
        "userId" uuid NULL,
        "managerEmployeeId" uuid NULL,
        "notes" text NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_tenantId" ON "employees" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_employees_tenant_number" ON "employees" ("tenantId", "employeeNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_tenant_status" ON "employees" ("tenantId", "status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_employees_tenant_fiscalCode" ON "employees" ("tenantId", "fiscalCode") WHERE "fiscalCode" IS NOT NULL`,
    );

    // ─── attendances ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "attendances" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "employeeId" uuid NOT NULL,
        "date" date NOT NULL,
        "clockInAt" timestamptz NULL,
        "clockOutAt" timestamptz NULL,
        "breakMinutes" int NOT NULL DEFAULT 0,
        "workedHours" numeric(5,2) NOT NULL DEFAULT 0,
        "location" attendance_location_enum NOT NULL DEFAULT 'office',
        "locationLabel" varchar(100) NULL,
        "status" attendance_status_enum NOT NULL DEFAULT 'open',
        "notes" text NULL,
        "recordedBy" uuid NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_attendances_tenantId" ON "attendances" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_attendances_tenant_emp_date" ON "attendances" ("tenantId", "employeeId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attendances_tenant_date" ON "attendances" ("tenantId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attendances_tenant_emp_status" ON "attendances" ("tenantId", "employeeId", "status")`,
    );

    // ─── leave_requests ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "leave_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "employeeId" uuid NOT NULL,
        "leaveType" leave_type_enum NOT NULL,
        "startDate" date NOT NULL,
        "endDate" date NOT NULL,
        "daysRequested" numeric(6,2) NOT NULL,
        "reason" text NULL,
        "status" leave_status_enum NOT NULL DEFAULT 'draft',
        "submittedAt" timestamptz NULL,
        "decidedAt" timestamptz NULL,
        "decidedBy" uuid NULL,
        "decisionReason" text NULL,
        "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "attachmentPath" varchar(500) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_leave_requests_tenantId" ON "leave_requests" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_leave_requests_emp" ON "leave_requests" ("tenantId", "employeeId", "startDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_leave_requests_status" ON "leave_requests" ("tenantId", "status", "startDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_leave_requests_type" ON "leave_requests" ("tenantId", "leaveType", "startDate")`,
    );

    // ─── ccnls (global reference) ─────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ccnls" (
        "code" varchar(50) PRIMARY KEY,
        "name" varchar(255) NOT NULL,
        "sector" varchar(100) NOT NULL,
        "version" varchar(50) NULL,
        "effectiveFrom" date NULL,
        "effectiveTo" date NULL,
        "sourceUrl" varchar(500) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "ccnl_pay_grades" (
        "id" varchar(100) PRIMARY KEY,
        "ccnlCode" varchar(50) NOT NULL,
        "code" varchar(50) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" varchar(500) NULL,
        "monthlyMinCents" bigint NOT NULL DEFAULT 0,
        "weeklyHours" numeric(4,2) NOT NULL DEFAULT 40,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_ccnl_pay_grades_ccnl" FOREIGN KEY ("ccnlCode") REFERENCES "ccnls"("code") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ccnl_pay_grades_ccnl_code" ON "ccnl_pay_grades" ("ccnlCode", "code")`,
    );
    await queryRunner.query(`
      CREATE TABLE "ccnl_leave_entitlements" (
        "id" varchar(100) PRIMARY KEY,
        "ccnlCode" varchar(50) NOT NULL,
        "leaveType" varchar(50) NOT NULL,
        "daysPerYearByYearsOfService" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "notes" varchar(500) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_ccnl_leave_ccnl" FOREIGN KEY ("ccnlCode") REFERENCES "ccnls"("code") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ccnl_leave_ccnl_type" ON "ccnl_leave_entitlements" ("ccnlCode", "leaveType")`,
    );

    // ─── seed CCNL reference data ─────────────────────────────
    // CCNL Industria Metalmeccanica (Federmeccanica + Assistal vs FIM/FIOM/UILM,
    // vigente 2024-2027). Source: federmeccanica.it.
    await queryRunner.query(`
      INSERT INTO "ccnls" ("code", "name", "sector", "version", "effectiveFrom", "effectiveTo", "sourceUrl") VALUES
        ('metalmeccanico_industria',
         'CCNL Industria Metalmeccanica e Installazione Impianti',
         'Industria',
         '2024-2027',
         '2024-07-01',
         '2027-06-30',
         'https://www.federmeccanica.it/contratto-collettivo-nazionale-di-lavoro/'),
        ('commercio_terziario',
         'CCNL Terziario, Distribuzione e Servizi (Confcommercio)',
         'Commercio',
         '2024-2027',
         '2024-04-01',
         '2027-03-31',
         'https://www.confcommercio.it/lavoro')
    `);

    // CCNL Metalmeccanico — minimi tabellari (a livello d'inquadramento)
    // riferiti al 2026; valori di riferimento Federmeccanica.
    await queryRunner.query(`
      INSERT INTO "ccnl_pay_grades" ("id", "ccnlCode", "code", "name", "description", "monthlyMinCents", "weeklyHours") VALUES
        ('metalmeccanico_industria:liv_1', 'metalmeccanico_industria', 'liv_1', 'Livello 1', 'Operai non qualificati', 168000, 40),
        ('metalmeccanico_industria:liv_2', 'metalmeccanico_industria', 'liv_2', 'Livello 2', 'Operai qualificati', 175000, 40),
        ('metalmeccanico_industria:liv_3', 'metalmeccanico_industria', 'liv_3', 'Livello 3', 'Operai specializzati', 184000, 40),
        ('metalmeccanico_industria:liv_3s','metalmeccanico_industria', 'liv_3s','Livello 3 Super', 'Operai specializzati superiori / impiegati amm. d''ordine', 191000, 40),
        ('metalmeccanico_industria:liv_4', 'metalmeccanico_industria', 'liv_4', 'Livello 4', 'Tecnici/impiegati di concetto', 200000, 40),
        ('metalmeccanico_industria:liv_5', 'metalmeccanico_industria', 'liv_5', 'Livello 5', 'Tecnici esperti', 215000, 40),
        ('metalmeccanico_industria:liv_5s','metalmeccanico_industria', 'liv_5s','Livello 5 Super', 'Quadri operativi / impiegati di alta concezione', 232000, 40),
        ('metalmeccanico_industria:liv_6', 'metalmeccanico_industria', 'liv_6', 'Livello 6', 'Quadri', 250000, 40),
        ('metalmeccanico_industria:liv_7', 'metalmeccanico_industria', 'liv_7', 'Livello 7', 'Quadri di alta direzione', 270000, 40),
        ('commercio_terziario:liv_1',     'commercio_terziario',      'liv_1', 'Livello 1', 'Quadri', 235000, 40),
        ('commercio_terziario:liv_2',     'commercio_terziario',      'liv_2', 'Livello 2', 'Capi area / capi reparto', 195000, 40),
        ('commercio_terziario:liv_3',     'commercio_terziario',      'liv_3', 'Livello 3', 'Concettuali con responsabilita', 178000, 40),
        ('commercio_terziario:liv_4',     'commercio_terziario',      'liv_4', 'Livello 4', 'Operativi specializzati', 165000, 40),
        ('commercio_terziario:liv_5',     'commercio_terziario',      'liv_5', 'Livello 5', 'Operativi qualificati', 158000, 40),
        ('commercio_terziario:liv_6',     'commercio_terziario',      'liv_6', 'Livello 6', 'Operativi non qualificati', 152000, 40),
        ('commercio_terziario:liv_7',     'commercio_terziario',      'liv_7', 'Livello 7', 'Personale ausiliario', 145000, 40)
    `);

    // Ferie + permessi standard per CCNL.
    await queryRunner.query(`
      INSERT INTO "ccnl_leave_entitlements" ("id", "ccnlCode", "leaveType", "daysPerYearByYearsOfService", "notes") VALUES
        ('metalmeccanico_industria:ferie',
         'metalmeccanico_industria', 'ferie',
         '{"0": 22, "10": 25, "18": 26}'::jsonb,
         'Ferie a giorni lavorativi con maturazione progressiva per anzianita.'),
        ('metalmeccanico_industria:permesso_retribuito',
         'metalmeccanico_industria', 'permesso_retribuito',
         '{"0": 13}'::jsonb,
         'Permessi retribuiti = ROL + ex-festivita; valore aggregato 2026.'),
        ('metalmeccanico_industria:malattia',
         'metalmeccanico_industria', 'malattia',
         '{"0": 180}'::jsonb,
         'Periodo di comporto base 180 gg/anno (variabile per anzianita).'),
        ('commercio_terziario:ferie',
         'commercio_terziario', 'ferie',
         '{"0": 22, "10": 25, "18": 26}'::jsonb,
         'Ferie a giorni lavorativi.'),
        ('commercio_terziario:permesso_retribuito',
         'commercio_terziario', 'permesso_retribuito',
         '{"0": 14}'::jsonb,
         'ROL + ex-festivita.'),
        ('commercio_terziario:malattia',
         'commercio_terziario', 'malattia',
         '{"0": 180}'::jsonb,
         'Comporto 180 gg/anno.')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ccnl_leave_entitlements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ccnl_pay_grades"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ccnls"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attendances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employees"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "leave_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "leave_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "attendance_location_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "attendance_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "employee_contract_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "employee_status_enum"`);
  }
}
