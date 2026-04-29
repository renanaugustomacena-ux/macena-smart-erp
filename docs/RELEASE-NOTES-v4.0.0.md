# SmartERP v4.0.0 — Release notes

> Tag: `v4.0.0`. Date: 2026-04-29. Plan: §31.3 Sprint 48 closes the 24-month roadmap.

## Highlights

- **Marketplace** is live with 7 launch partners (ISO 9001, FP scheduling, Odette EDI, OPC-UA, Shopify, WooCommerce, Amazon Vendor Central).
- **Multi-region** (active-passive): eu-south-1 primary + eu-west-1 hot standby; quarterly DR drill cadence; SOC 2 TSC A1.3 evidence flowing.
- **Internationalisation prep**: DE/ES/FR feasibility study + IOSS + foreign-currency conversion.
- **OpenAPI 3.1 snapshot + SDK quarterly cycle**: v1.0.0 frozen in `docs/openapi/v1.yaml`; `@smarterp/sdk` published.
- **ESG Scope 1+2** + PDF report aligned with ESRS E1.
- **Tenant-sharding prep** (ADR-042) — schema-per-tenant migration path documented; v1-v4 stays single-cluster, the v5 sharding lift is a flip-the-switch operation.
- **Pentest v8**: 0 critical, 0 high; medium findings remediated.

## Cumulative roadmap delivered

Plan §31 covers Sprints 13-48. v1.0 (Sprint 12) covered the foundation. v2.0 (Sprint 24) added Procurement Phase B + Sales depth + AI Copilot foundation + RAG + production scheduling + treasury + multi-company + SOC 2 prep. v3.0 (Sprint 36) added the AI Copilot persona sets + scheduling + anomaly + cash forecast + auto-reconciler + Phase B consolidation + SOC 2 audit-prep matrix. **v4.0 (this release)** adds marketplace, multi-region, internationalisation prep, OpenAPI/SDK cycle, IOSS, tenant-sharding prep, ESG, mobile-native decision, DR drill v6 + pentest v8.

## Migration notes

- M-029 (marketplace) + the `marketplace_packages` + `marketplace_installations` tables land with the v4 deployment. Backfill is none (the catalogue is empty until the seed runs).
- ESG service has zero schema impact (compute-only).

## Known issues

- None. Every carry-forward item has been closed: the legacy `fatturapa-adapter.spec.ts` assertion (PA `CodiceDestinatario` 6-char regex) is fixed; all 13 pre-existing `tsc --noEmit` errors are resolved; all 9 lint warnings are cleaned. Backend test suite at 413/413 green; lint and types fully clean.

## Operational

- DR drill cadence: quarterly (per Sprint 47 runbook).
- SDK release cadence: quarterly (per `sdk/RELEASE-CYCLE.md`).
- SOC 2 Type II attestation cycle: ongoing (per `docs/compliance/SOC2-AUDIT-PREP.md`).

## Sign-off

- Engineering: CTO.
- Compliance: Compliance owner.
- GTM: GTM owner.

## Up next (post-v4)

- DR-drill F1/F2 follow-ups (pre-warm promotion lambda + pre-seed
  runtime cache after region failover) — operational / SRE work
  outside the application repo; tracked in
  `docs/operations/DR-DRILL-Q2-2026.md` §1.3 with Sprint 49 owner
  + target. The post-failover smoke suite + the warm-cache helper
  ship alongside the next DR drill (Q3 2026).
- Sprint 50+: tenant-sharding Stage 5a tooling (per ADR-042).
- Sprint 52: DE roll-out (per `docs/INTERNATIONALISATION-SEEDS.md`).
- Sprint 56: ES roll-out.
- Sprint 60: FR roll-out.
