# M-001 — `tenantId`-first multi-column index audit

> **Sprint 1 — Story S1.2.** Audit every multi-column index in the schema;
> verify `tenantId` is the first column on every tenant-scoped table.
> Per plan §2.1.1 doctrine R-D01.

**Audit date**: 2026-04-28.
**Auditor**: autonomous-agent (Sprint 1).
**Scope**: `backend/src/**/*.entity.ts` + `backend/src/migrations/*.ts`.

## Result: 100% compliant

Every multi-column index on a tenant-scoped table starts with `tenantId`.
The two single-column unique indexes on globally-unique business keys
(`users.email`, `tenants.vatNumber`) are intentional per the documented
exemptions (ADR-007 + ADR-001) and not in scope for R-D01.

## Index inventory

### Multi-column indexes (all R-D01-compliant)

| Table | Index | Columns | Compliant |
|---|---|---|---|
| `audit_logs` | `ix_audit_tenant_time` | `(tenantId, createdAt)` | ✓ |
| `products` | `ux_products_tenant_sku` | `(tenantId, sku)` UNIQUE | ✓ |
| `warehouses` | `ux_wh_tenant_code` | `(tenantId, code)` UNIQUE | ✓ |
| `stock_levels` | `ux_sl_tenant_prod_wh` | `(tenantId, productId, warehouseId)` UNIQUE | ✓ |
| `stock_movements` | `ix_sm_tenant_created` | `(tenantId, createdAt)` | ✓ |
| `customers` | `ux_customers_tenant_code` | `(tenantId, code)` UNIQUE | ✓ |
| `sales_orders` | `ux_so_tenant_number` | `(tenantId, orderNumber)` UNIQUE | ✓ |
| `chart_of_accounts` | `ux_coa_tenant_code` | `(tenantId, code)` UNIQUE | ✓ |
| `journal_entries` | `ix_je_tenant_date` | `(tenantId, entryDate)` | ✓ |
| `journal_entries` | (entity-level) | `(tenantId, reference)` | ✓ |
| `invoices` | `ux_inv_tenant_num_year` | `(tenantId, number, fiscalYear)` UNIQUE | ✓ |

### Single-column indexes — intentional exemptions

| Table | Index | Column | Reason |
|---|---|---|---|
| `users` | `ux_users_email` | `(email)` UNIQUE | **Globally unique** by design (per ADR-007 + plan §9.1.6 multi-tenant membership). The Andrea-commercialista pattern requires one identity to span N tenant memberships; the email must be globally unique to avoid two people sharing an email across tenants. |
| `users` | `ix_users_tenant` | `(tenantId)` | Tenant scope on its own; supports `users WHERE tenantId = ?` enumeration for the admin UI. |
| `tenants` | `ux_tenants_vat` | `(vatNumber)` UNIQUE WHERE NOT NULL | The Tenant aggregate **is** the tenant (per ADR-001 + ADR-051). `tenantId` IS this entity's PK (`id`), so a multi-column `(tenantId, vatNumber)` would be functionally equivalent to `(id, vatNumber)` — no benefit. The Partita IVA dedup is intentional cross-registry (one PIVA = one Tenant). |
| `audit_logs` | `ix_audit_corr` | `(correlationId)` | Cross-tenant correlation lookup is the design (an incident traces all events with a given correlationId regardless of tenant). The tenant-scoped query path uses `ix_audit_tenant_time` instead. |

### `@Index()` (single-column TypeORM decorators on entity columns)

The `@Index()` decorator on `tenantId` columns in entity classes
(`accounting.entity.ts:65`, `sales.entity.ts:40`, etc.) generates a
single-column index on `tenantId`. This complements (does not replace)
the multi-column composite indexes, and is consistent with the doctrine.

## CI guard

A lightweight grep-based audit script lives at
`backend/scripts/audit-tenant-indexes.sh`. It scans the schema source
files, finds every multi-column index declaration, and asserts the
first column is `tenantId` (with documented exemptions). Exit 1 on
violation.

Wire-in points:
- `npm run audit:tenant-indexes` (separate script).
- CI pipeline (Sprint 6+ when CI hardening lands).

## Next-iteration note

When new tables/indexes land, the engineer:

1. Default: composite index starts with `tenantId`.
2. Exception (single-column unique on a globally-unique business key,
   or per-aggregate-PK): document here with the rationale + ADR
   reference.
3. Re-run `bash backend/scripts/audit-tenant-indexes.sh`.
