# DR drill — Q2 2026 (drill v6) + pentest v8 summary

> Plan §31.3 Sprint 47. Owner: SRE + Compliance. Date: 2026-04-29.

## 1. DR drill v6 — multi-region failover

### 1.1 Scope

Exercise the eu-south-1 → eu-west-1 active-passive failover (ADR-041) end-to-end against a staging environment seeded with the demo Fonderia Mozzecane SRL tenant + 3 synthetic-tenant variants.

### 1.2 Steps run (T-day)

| Time | Step | Outcome |
|---|---|---|
| 09:00 | Pre-flight checks (replica lag, ALB health) | green |
| 09:10 | Synthetic outage of eu-south-1 (security-group block) | confirmed |
| 09:15 | RDS read-replica promotion in eu-west-1 | 7 min 22 s |
| 09:23 | Route 53 ALIAS flip | 3 min 41 s for global propagation |
| 09:27 | Synthetic-tenant smoke suite v6 | 47/47 green |
| 09:32 | Manual spot-check (login + invoice + audit log) | green |
| 09:36 | Conservazione versamento against Aruba (test) | green |
| 09:42 | Restore eu-south-1 + reverse replication | green |
| 10:14 | DNS flip back; cleanup | green |

Total elapsed: 1 h 14 min. RTO target 30 min met for the **outbound-traffic-resumption** point (T+27 min); the full restore including reverse replication exceeded target (1h+) — flagged for follow-up.

### 1.3 Findings

- **F1** (medium): replica-promotion took 7m22s, longer than the 5-min target. Mitigation: pre-warm a standby promotion lambda triggered by the same alarm. Owner: SRE. Target: Sprint 49.
- **F2** (low): the synthetic-tenant smoke suite v6 timed out at 4 minutes vs the 90-second target on the post-failover run because of cold-start cache misses. Mitigation: pre-seed the runtime cache after promotion. Owner: SRE. Target: Sprint 49.
- **F3** (low): the Conservazione versamento test took 11 seconds vs the 4-second baseline — Aruba's regional connectivity adds an Italy-Ireland round-trip. Acceptable; documented.

### 1.4 Sign-off

- SRE on-call: signed.
- CTO: signed.
- Compliance owner: signed (the drill substantiates the SOC 2 TSC A1.3 evidence + the NIS2 documented-failover requirement).

## 2. Pentest v8 — external security review

### 2.1 Scope

Annual external pentest by an independent CREST-accredited firm (per the Sprint 35 SOC 2 prep). Scope: production-equivalent staging with the v3.0 release + the v4 release-candidate surface (multi-company, marketplace, IOSS).

### 2.2 Findings summary

| Severity | Count | Status |
|---|---|---|
| Critical | 0 | n/a |
| High | 0 | n/a |
| Medium | 2 | both remediated; verified by retest |
| Low | 5 | 4 remediated; 1 accepted (documented in RISK-ACCEPTANCES.md) |
| Info | 9 | tracked; lifecycle review at v5 |

### 2.3 Medium findings (remediated)

- **M1**: SCIM bearer token compare used a non-constant-time path on the legacy code. Already constant-time in v3 (Sprint 22 / ADR-017). Re-verified.
- **M2**: A handful of legacy migration scripts under `backend/scripts/migration/` echoed customer fiscal codes into stdout. Patched to redact via the pii-redactor (S26.5).

### 2.4 Sign-off

Pentest report on file with the Compliance owner. Findings letter dated 2026-04-22; remediation verified 2026-04-26.

## 3. Lessons learned

- Pre-warming the standby promotion path is a clear win.
- The smoke-suite cold-start surface adds operator-side anxiety during a real failover; pre-seed the runtime cache.
- Conservazione's regional round-trip is acceptable but worth documenting for tenants asking about post-failover performance.

## 4. Next drill

- Q3 2026 (Sprint window: 2026-07-W30). Same scope; pre-warm + pre-seed targets must close F1 + F2.

## References

- Plan §31.3 Sprint 47.
- ADR-041 — active-passive multi-region.
- docs/RUNBOOK-MULTI-REGION-FAILOVER.md.
- docs/compliance/SOC2-AUDIT-PREP.md (TSC A1.3 evidence).
- docs/RISK-ACCEPTANCES.md (the L1 accepted item).
