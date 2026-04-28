# ADR-025 — Conservazione "two-vendor" requirement at Professionale+ tier; single-vendor at Base

- **Status**: Accepted 2026-04-28 (Sprint 16, S16.4)
- **Date**: 2026-04-28
- **Owner**: CTO + Compliance-team owner
- **Supersedes / extends**: ADR-016 (per-vendor adapter port + registry).

## Context

ADR-016 established the `ConservazioneAdapter` port and shipped two skeleton implementations (Aruba, InfoCert) so a tenant can route conservazione versamenti to either Conservatore Accreditato AgID. ADR-016 deliberately stops at *capability*: it does not pin *when* a tenant must use one vendor versus two.

Operating cost makes that decision non-trivial:

- Aruba PEC Conservazione lists ~€0.05/document at SmartERP volume tiers (2026 commercial terms; renegotiable at €1M ARR).
- InfoCert Conservazione lists ~€0.07/document at the same tier.
- Namirial (third Conservatore, deferred to Enterprise demand) lists ~€0.06/document.

For a typical Base-tier customer (≤ 1 200 invoices/year, mostly TD01 fatture attive) dual-vendor adds ~€60-80/year of pure replication cost and twice the credential-management surface, against a low marginal failure-mitigation value: Aruba's regulatory uptime is 99.9%+ (AgID-published), and an Aruba outage with conservation-receipt impact has not occurred in the last six fiscal years. Doubling the cost to insure against a 0.001% scenario fails the value test for the segment that buys the Base tier (small artisan firms / studios with < 10 seats).

For Professionale+ tier (typical 5 000 - 30 000 invoices/year), the math flips:

- The 10-year regulatory window means an outage at the wrong moment can leave the tenant unable to produce the "rapporto di versamento" during a tax audit.
- Commercialisti and larger SMEs increasingly negotiate dual-vendor as part of their internal continuity policy (NIS2 D.Lgs. 138/2024 art. 25 — "supply-chain risk management" — applies indirectly: the conservazione is part of the financial-records pipeline).
- The marginal cost (~€350-€2 100/year for the typical Professionale customer) is small relative to tier price (€199/seat/month).

The platform's commercial tiers are encoded on `tenants.plan` (`base`, `professionale`, `enterprise`). The Conservazione adapter and registry are tier-agnostic; the policy layer above them is not yet defined.

## Decision

Conservazione vendor selection is **tier-aware**, with the following invariants:

1. **Base tier** provisions exactly one Conservatore. Default is Aruba (largest by volume, lowest unit cost). Tenants may choose InfoCert at provisioning. **No secondary vendor is permitted** at this tier; the configuration validator rejects an attempt to set `tenant.settings.conservazione.secondary` for a Base tenant.

2. **Professionale tier** requires a primary and supports a secondary. Default primary is Aruba; default secondary is InfoCert. Tenants may invert (primary = InfoCert, secondary = Aruba) for niche reasons (existing relationship, study-firm preference). The platform writes every versamento to the primary; the secondary is used as **failover** when the primary returns a 5xx / timeout after the centralised retry policy (ADR-032) is exhausted.

3. **Enterprise tier** behaves identically to Professionale by default but unlocks Namirial as an additional vendor (`tenant.settings.conservazione.tertiary`) on opt-in. The orchestrator round-robins primary → secondary → tertiary on cascading failure.

The tier-aware logic lives in a thin **`ConservazioneOrchestrator`** service that wraps the existing `ConservazioneRegistry` (ADR-016). The orchestrator:

- Reads `tenant.plan` + `tenant.settings.conservazione.{primary,secondary,tertiary}` at the start of a versamento.
- Validates the configuration against the per-tier policy (rejects illegal combinations with an RFC 7807 `application/problem+json` 422).
- Calls `primary.send(...)`. On success, persists the receipt and returns.
- On *transient* primary failure (5xx, timeout, network error — narrow allowlist), calls `secondary.send(...)` if the tier permits a secondary. The receipt records `vendorId = secondary.vendorId` and `failoverFrom = primary.vendorId`.
- On *permanent* primary failure (4xx — invalid metadata, expired credentials), the orchestrator does **not** failover. The error surfaces immediately so the tenant fixes the input rather than burning a second-vendor versamento.
- Emits an OpenTelemetry span `conservazione.versamento` with `vendor_id`, `failover_used`, `tier` attributes for SLO tracking.

The orchestrator is invoked from every site that previously called the registry directly (Accounting `archiveInvoice`, Procurement `archiveSupplierInvoice`). Direct registry use becomes a code-review-only path (super-admin tools, the seeder, the conservazione admin CLI).

InfoCert adapter goes **live in sandbox mode** in Sprint 16 (S16.4): the adapter reads `tenant.settings.conservazione.infocert.mode = 'sandbox' | 'production'`. In sandbox mode the adapter returns a deterministic synthetic receipt (no upstream network call) so end-to-end tests, demo tenants, and the failover path can be exercised without burning a real InfoCert quota. In production mode the adapter still throws `NotImplementedException` until the Sprint 23 live wiring lands; this preserves the ADR-016 schedule while letting the orchestrator + tier policy ship now.

## Consequences

- Positive:
  - Cost-aligned with tier value: Base tenants are not over-charged for an over-engineered failover; Professionale+ tenants get the redundancy they need.
  - The tier policy is one validator and one orchestrator decision, not scattered branching across consumers.
  - Failover use is observable via a single OTEL span attribute (`failover_used = true | false`), so the cost / activation rate of the secondary vendor is measurable per-tenant.
  - InfoCert sandbox mode unblocks contract testing of the failover path before the Sprint 23 production wiring.
- Negative:
  - Two configuration paths to maintain (Base vs Professionale+).
  - Tenants that downgrade from Professionale to Base must explicitly clear the secondary configuration; the validator rejects the downgrade until the operator does so. A downgrade-flow runbook is required (RUNBOOK §8).
  - Sandbox-mode receipts are visually indistinguishable from production receipts in the UI absent a small "(sandbox)" badge — added in S16.4 alongside the orchestrator.
- Neutral:
  - The orchestrator does **not** re-attempt versamenti at the secondary if the primary later recovers. The tenant reasons about a single canonical conservation root per fiscal year per DPCM 3/12/2013 §6 ("stabilità della conservazione"); double-archiving the same document at two vendors is intentionally avoided.

## Alternatives considered

- **Always dual-vendor (uniform across tiers)**: rejected — see context; doubles the cost for a segment whose value model does not justify it.
- **Always single-vendor (uniform across tiers)**: rejected — defeats the legal "no single point of failure" intent at scale; not negotiable for Enterprise customers.
- **Per-document vendor selection (round-robin across all tenants)**: rejected — violates DPCM 3/12/2013 §6 "stabilità" expectation; auditors expect a single canonical root per fiscal year.

## References

- ADR-016 — `ConservazioneAdapter` port + `ConservazioneRegistry`.
- ADR-032 — Internal HTTP client wrapper (timeout / retry / circuit-breaker policy used to decide when "transient" failover triggers).
- ADR-011 — RFC 7807 ProblemDetails (the 422 surface for invalid tier configurations).
- ADR-DA07 — field-level encryption for vendor credentials.
- DPCM 3 dicembre 2013 — "Regole tecniche in materia di sistema di conservazione" §6 (stabilità).
- D.Lgs. 138/2024 (NIS2 attuazione) art. 25 — supply-chain risk management.
- Plan §31.1 Sprint 16 (S16.4 — this ADR + InfoCert sandbox-mode); §31.2 Sprint 22 (Aruba live); Sprint 23 (InfoCert live).
- ITALIAN-COMPLIANCE.md §3.3 (Conservazione a Norma).
