# ADR-004 — PostgreSQL 16 (Aurora in production) as the system of record

- **Status**: Accepted 2026-04-28 (inherited; ratified)
- **Date**: 2026-04-28
- **Owner**: CTO

## Context

SmartERP's domain is fundamentally relational (invoices, customers, products, accounting entries, with explicit referential integrity). It also benefits from JSONB for semi-structured payloads (BoM trees, audit-log diffs, tenant settings, journal-entry lines). It needs row-level security for multi-tenancy (per plan §7.5 + ADR-002). It needs partitioning for hot tables (`audit_logs` quarterly, `stock_movements` monthly). It needs strong ACID for fiscal-grade integrity (per ADR-012 SERIALIZABLE for fiscal flows).

## Decision

PostgreSQL 16 (Aurora variant in production: AWS RDS Aurora PostgreSQL 16 Multi-AZ) as the single source of truth for transactional state.

- JSONB for semi-structured payloads with documented schemas (per R-DA06).
- RLS for tenant isolation (per migration `EnableRowLevelSecurity1713436900000`).
- Quarterly partitioning for `audit_logs`; monthly for `stock_movements` past 1M rows; quarterly for `journal_entries` past 500k rows.
- PgBouncer transaction-pooling sidecar per app pod (Stage 3+).
- Read replicas for reporting workload (per ADR-031).

Redis (per ADR-DA01) is cache, ephemeral session store, and BullMQ substrate — not the system of record.

## Consequences

- Positive:
  - Best-in-class open-source RDBMS; rich feature set (JSONB, RLS, partitioning, generated columns, GIN/GiST indexes, pgvector for AI embeddings).
  - Mature operations; large hiring pool of operators in Italy.
  - Vendor-neutrality (every major cloud and Linux distro supports it).
- Negative:
  - Not infinitely scalable horizontally (mitigation: tenant sharding at Stage 5 per ADR-042).
  - Long-running transactions block VACUUM (mitigation: transactions stay short).
- Neutral:
  - Aurora Multi-AZ adds cost at Stage 2+ but Multi-AZ failover is the operational answer to single-instance failure.

## Alternatives considered

- **MySQL**: rejected — JSONB weaker; RLS not native; less rich type system.
- **MongoDB**: rejected — fundamentally relational domain; transactional guarantees weaker; sharding adds complexity not value.
- **CockroachDB**: rejected — global-scale designed for; over-engineered for our 2026-2028 scale; cost; smaller pool of operators in Italy.
- **SQL Server / Oracle**: rejected — licensing cost; vendor lock; not the team's stack.

## References

- Plan §2.4, §7.5, §10.1.
- Existing `backend/src/config/database.config.ts`.
- LIB-12:03_Database_Engineering.
- MODUS_OPERANDI §4.3.
