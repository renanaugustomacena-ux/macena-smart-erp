## ADR-042 — Tenant-sharding prep: schema-per-tenant fallback at Stage 5

- **Status**: Accepted 2026-04-29 (Sprint 44, S44.1)
- **Date**: 2026-04-29
- **Owner**: CTO + DBA owner

## Context

Plan §7.9 (Scalability path) names five stages. Stage 5 is "schema-per-tenant" or "tenant-sharded cluster" — applied when the shared-schema-with-tenantId model hits 200+ TB or 20+ TB hot-data per primary. That ceiling is realistic at ~5 000 active tenants on the current data volume per tenant, well past v4 (200 customers per plan §31.3 Sprint 48). v1-v4 stays single-cluster.

NIS2 + SOC 2 + the Italian fiscal data-residency rules don't force per-tenant isolation today — the multi-AZ + cross-region story plus RLS + R-D02 lint are sufficient. But the migration path needs to be documented before we hit the ceiling, not after.

## Decision

Tenant-sharding lands as a **per-tenant Postgres schema** within the same cluster (Stage 5a) before splitting clusters (Stage 5b). The migration steps:

1. **Stage 5a** (~5 000 tenants): introduce a `tenant_schema` column on `tenants` with the per-tenant schema name. The `TypeORM` data source resolves the schema from the JWT claim at request time (custom `schema()` helper). Existing data migrates one tenant at a time via the tooling under `infra/sharding/migrate-tenant.ts` (deferred — first full PR lands at Sprint 50).

2. **Stage 5b** (~20 000 tenants): hot tenants move to a dedicated cluster behind the same NestJS app via a per-tenant `connectionName`. Cold tenants stay on the shared cluster. Routing: a thin `TenantClusterRouter` resolves the cluster from the tenant id; cache-backed.

Pre-requisites that v4 satisfies:

- Every query carries `tenantId` (R-D02). ✓ — enforced by the `no-untenanted-query` ESLint rule.
- Every multi-column index leads with `tenantId` (R-D01). ✓ — enforced by the `audit:tenant-indexes` script.
- Every entity declares a `tenantId` column. ✓ — enforced via convention + the M-001 audit.
- BullMQ jobs carry `tenantId` in the job name. ✓ — already true (Sprint 14 webhook outbox + Sprint 24 conservation worker pattern).

What v4 does **not** satisfy yet (deferred to Stage 5a PR):

- Cross-tenant joins in BI / consolidation queries — they still issue a single multi-tenant query. Stage 5a refactors those queries into a fan-out+merge path.
- Migration tooling: schema-per-tenant means N-times the migration runs. Tooling under `backend/scripts/migrations-per-tenant.ts` is sketched in this ADR but not implemented in v4.

## Consequences

- Positive:
  - The migration path is documented + the v4 codebase already satisfies the pre-requisites — Stage 5a is "open the box and run the migrator", not "rewrite the data layer".
  - Tenant-sharding decouples the noisy-neighbour risk: a runaway tenant query stays inside its schema.
- Negative:
  - Schema-per-tenant means N migrations per release; CI cost grows linearly with tenant count.
  - Cross-tenant queries (anonymised benchmarking, S36 + Sprint 45) must move to a separate analytics warehouse before Stage 5a.
- Neutral:
  - The full Stage 5b cluster split is a separate ADR (deferred to Sprint 50+).

## Alternatives considered

- **Database-per-tenant (one Postgres database per tenant)**: rejected — too many open connections; migration cost.
- **Citus / CockroachDB / Yugabyte (logical sharding)**: deferred. Strong fit for the future, but adds a database-vendor dependency before we hit the ceiling.
- **Stay shared-schema forever**: rejected — fails at the 200 TB hot-data envelope.

## References

- Plan §7.9 — Scalability path (5 stages).
- Plan §31.3 Sprint 44 (S44.1 — this ADR).
- ADR-001 — multi-tenant cloud posture.
- R-D01 (tenantId-first composite indexes), R-D02 (no-untenanted-query lint).
- M-001 — tenantId index audit (Sprint 1).
