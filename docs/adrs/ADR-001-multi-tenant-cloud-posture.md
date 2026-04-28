# ADR-001 — Multi-tenant cloud as the deployment posture

- **Status**: Accepted 2026-04-28
- **Date**: 2026-04-28
- **Owner**: CTO

## Context

SmartERP's value proposition depends on operating the system for tenants — fiscal-compliance updates pushed within 14 calendar days of an AdE provvedimento, observability across tenants, AI-copilot embeddings derived from anonymised cross-tenant patterns. A self-hosted (on-prem) or BYOC (bring-your-own-cloud) deployment forecloses all three. The customer segment (10-250 employee Italian manufacturing SMEs) is willing to accept cloud as the default posture per the Q1 2026 discovery research (42 owner/commercialista interviews in Verona).

The product plan (§1.5, §1.8) commits to "multi-tenant cloud" as a first-class commitment.

## Decision

SmartERP is a multi-tenant cloud product:

- One running platform serves many customer organisations (tenants).
- Tenants do not get to deploy SmartERP on their own infrastructure.
- Hybrid integration is supported (the tenant's conservazione provider is on their own InfoCert account; the tenant's PEC is their own).
- The core (PostgreSQL, Redis, BullMQ, NestJS, Next.js) runs in SmartERP's AWS account (eu-south-1 Milan primary; eu-west-1 Dublin DR/expansion).
- An on-prem path is reconsidered only at Phase 5+ when 3+ paying Enterprise tenants commit per ADR-048.

## Consequences

- Positive:
  - Continuous deployment cadence (twice weekly).
  - Cross-tenant insight (anonymised benchmarks per ADR-057).
  - Operational economy (one-team-runs-everything).
  - Predictable security posture.
  - AI-copilot moat preserved.
- Negative:
  - Cannot serve customers with strict on-prem mandates (some PA suppliers, some NIS2-essential entities at the upper bound of their compliance interpretation).
  - Cannot serve customers in non-EU jurisdictions without significant work.
- Neutral:
  - Data-residency commitment to eu-south-1 (Milan). Per-tenant data-residency labels per ADR-051 (Phase 4).

## Alternatives considered

- **On-prem deployable**: rejected — sales cycle 6×, support cost 4×, AI/observability moat lost.
- **BYOC (customer's AWS)**: rejected — operational nightmare, prevents continuous deployment.
- **Hybrid by default (managed control plane + customer data plane)**: rejected — too complex for the 2026-2028 team size; reconsider Phase 5 per ADR-048.

## References

- Plan §1.5, §1.8; MODUS_OPERANDI §1, §6.1.
- Portfolio CLAUDE.md.
