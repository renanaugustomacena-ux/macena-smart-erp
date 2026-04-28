# ADR-041 — Multi-region: active-passive against eu-south-1 (Milan) + eu-west-1 (Ireland) before active-active

- **Status**: Accepted 2026-04-29 (Sprint 39, S39.1)
- **Date**: 2026-04-29
- **Owner**: CTO + SRE owner

## Context

Italian fiscal regulation pins the primary processing region to the EU; SmartERP runs in `eu-south-1` (AWS Milan) by default. NIS2 D.Lgs. 138/2024 art. 24 + the Sprint 35 SOC 2 control matrix require a documented failover region. Two routes:

- **Active-active** across two EU regions — strongest availability story; complex Postgres cross-region write coordination.
- **Active-passive** — primary serves all writes from `eu-south-1`; `eu-west-1` is a hot standby with cross-region RDS replicas + S3 cross-region replication. Failover is a controlled DNS flip.

The team is small. Active-active introduces conflict-resolution complexity (idempotency keys per row, multi-master Postgres patterns) without a corresponding revenue case until > €5M annual revenue. Active-passive satisfies the SOC 2 + NIS2 requirements at < 20% of the engineering cost.

## Decision

The platform runs **active-passive** at v3 and v4 release tags:

- Primary: `eu-south-1` — all writes.
- Hot standby: `eu-west-1` (Ireland) — RDS Postgres physical replica via cross-region read-replica; S3 cross-region replication for the conservation buckets + the report archive; ECR cross-region replication for container images.
- Failover: controlled DNS flip of `api.smarterp.it` from the `eu-south-1` ALB to the `eu-west-1` ALB. RPO 1 minute (last replicated WAL); RTO 30 minutes (DNS TTL + manual confirmation step).

Operating discipline:

- Quarterly DR drill (Sprint 47 owns the recurring runbook). The DR drill exercises the DNS flip + the synthetic-tenant smoke suite + the rollback to `eu-south-1`.
- Per-quarter capacity review of `eu-west-1` ensuring it can carry full primary load for the duration of an `eu-south-1` outage.
- Conservation versamenti from `eu-west-1` after a failover continue to write to the same Aruba / InfoCert tenant (the upstream Conservatori are themselves multi-region).

Active-active is reconsidered at **€5M annual revenue** (ADR-051 deferred) or when the cross-region writer-coordination story is materially cheaper than today.

## Consequences

- Positive:
  - Satisfies NIS2 + SOC 2 documented-failover requirement.
  - DR drill is a routinely-rehearsed muscle, not a one-off.
  - Failover surface is one DNS flip — testable, reversible.
- Negative:
  - During failover, write traffic loses the last-replicated-WAL window (typically < 60 seconds of writes).
  - Standby region's idle cost (~25% of primary spend) is permanent.
- Neutral:
  - Per-tenant data residency stays Italy (the standby is in Ireland, still EU). Tenants requiring hard "Italy-only" residency are flagged at provisioning + receive a runbook entry indicating the failover behaviour.

## Alternatives considered

- **Active-active**: deferred per Context.
- **Single-region**: rejected — fails SOC 2 + NIS2 documented-failover requirement.
- **AZ-only failover (no second region)**: rejected — does not survive a regional incident.

## References

- Plan §31.3 Sprint 39 (S39.1 — this ADR); Sprint 40 (eu-west-1 standby live).
- ADR-001 — multi-tenant cloud posture.
- ADR-027 — audit log retention.
- D.Lgs. 138/2024 (NIS2) art. 24.
- AWS Cross-Region RDS read-replica documentation.
- SOC 2 TSC A1.3 — BCP / DR (mapped in docs/compliance/SOC2-AUDIT-PREP.md).
