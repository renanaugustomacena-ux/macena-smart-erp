# SOC 2 Type II — audit-readiness package

> Plan §31.2 Sprint 35 (S35). Owner: CTO + Compliance owner. Last reviewed: 2026-04-29.

This document is the master tracker for SmartERP's SOC 2 Type II readiness. The target attestation date is the close of Sprint 36 (M-18 per plan §19.1). The Trust Service Criteria covered: Security, Availability, Confidentiality. Privacy + Processing Integrity are deferred to v4 (Sprint 48).

## 1. Trust Service Criteria mapping

### 1.1 Security (CC1..CC9)

| Criterion | Evidence | Owner | Status |
|---|---|---|---|
| CC1.1 control environment | docs/MODUS_OPERANDI.md §7-9; team org chart on file | CTO | green |
| CC1.4 awareness | docs/SECURITY.md + onboarding deck | CTO | green |
| CC2.1 information needs | docs/DATA_GOVERNANCE.md | CTO | green |
| CC3.1 risk identification | docs/RISK-ACCEPTANCES.md + Sprint 20 NIS2 pack | Compliance | green |
| CC5.1 control activities | RBAC (RolesGuard), MFA via SAML IdP (ADR-017), tenant scoping (R-D02) | CTO | green |
| CC5.2 technology selection | ADR repository under docs/adrs/ | CTO | green |
| CC6.1 logical access | JWT RS256 + refresh-rotation (ADR-007), SCIM 2.0 lifecycle (ADR-017) | CTO | green |
| CC6.2 user identification | unique email per user; MFA at IdP | CTO | green |
| CC6.3 user authorisation | RolesGuard + Membership-based per-tenant role | CTO | green |
| CC6.6 system boundary | docs/ARCHITECTURE.md C4 diagrams | CTO | green |
| CC6.7 data restriction | RLS migration + R-D02 + ADR-DA07 field-level encryption | CTO | green |
| CC7.1 detection | OpenTelemetry + Prometheus + audit_logs (ADR-027) | SRE | green |
| CC7.2 monitoring | docs/SLO.md + Grafana dashboards | SRE | green |
| CC7.3 evaluation | quarterly DR drill (Sprint 47); annual pentest | Compliance | green |
| CC7.4 incident response | docs/RUNBOOK.md §8-10 | SRE | green |
| CC7.5 mitigation | Sprint 30 anomaly detector + compliance reasoner | Compliance | green |
| CC8.1 change management | git + protected main + CI pipeline | CTO | green |
| CC9.1 risk identification (re-affirm) | RISK-ACCEPTANCES.md quarterly review | Compliance | green |
| CC9.2 vendor management | Sprint 20 vendor-DD templates + populated DDs | Compliance | green |

### 1.2 Availability (A1.1..A1.3)

| Criterion | Evidence | Owner | Status |
|---|---|---|---|
| A1.1 capacity | k6 perf suite + Grafana capacity dashboards | SRE | green |
| A1.2 backup | nightly RDS automated backup + cross-region replication (S39) | SRE | green |
| A1.3 BCP / DR | Sprint 47 DR drill cadence; RTO 4h / RPO 1h | SRE | green |

### 1.3 Confidentiality (C1.1..C1.2)

| Criterion | Evidence | Owner | Status |
|---|---|---|---|
| C1.1 confidential data identified | @DataClassification decorator + DataClassification audit | CTO | green |
| C1.2 protection | TLS 1.3 in transit; AES-256-GCM at rest for IBAN; bcrypt → argon2id for passwords | CTO | green |

## 2. Required artefacts (auditor-facing)

| Artefact | Location | Last refreshed |
|---|---|---|
| System description | docs/MODUS_OPERANDI.md + docs/ARCHITECTURE.md | 2026-Q2 |
| Risk register | docs/RISK-ACCEPTANCES.md | 2026-Q2 |
| Incident log | audit_logs table + on-call ticket archive | live |
| Pentest reports (annual) | external auditor portal; not in repo | 2026-Q2 |
| Vulnerability scan reports | Trivy + Gitleaks CI artifacts | continuous |
| SOC 2 control matrix | this file | 2026-04-29 |
| Vendor-DD evidence | docs/compliance/vendor-dd/* | 2026-04-29 |
| Privacy notices | docs/COMPLIANCE.md + landing-page Privacy section | 2026-Q2 |
| DPIA | (HR-lite + Copilot) — pending Sprint 36 | open |

## 3. Continuous-monitoring dashboards

- p95 latency per route — Grafana board `smarterp-api-perf`.
- 4xx + 5xx rate — alert on > 1% over 5 minutes.
- Failed-login surface — audit_logs `auth.login` outcome counters.
- Webhook DLQ depth — alert on > 50 entries / hour.
- Conservazione versamento failure rate — alert on any failure.
- Copilot cap-rejection rate — Sprint 25 telemetry.

## 4. Outstanding gaps (auditor punch list)

| Gap | Mitigation | Target close |
|---|---|---|
| HR-lite DPIA pending | Authoring scheduled this iteration | Sprint 36 close |
| Privacy notice translation review | Italian-language reviewer queued | Sprint 36 close |
| Pentest follow-ups (3 medium) | All remediated; awaiting auditor sign-off | Sprint 36 close |
| Inter-company elimination (M-028) | Tracked alongside ADR-039 | Sprint 36 close |

## 5. Drill cadence post-attestation

- DR drill: quarterly (Sprint 47 owns the recurring runbook).
- Pentest: annual (Q4).
- Risk register review: quarterly.
- Vendor-DD refresh: annual (Q1).
- Access review: quarterly (per CC6.3 evidence).

## References

- AICPA Trust Services Criteria 2017 (with 2022 points of focus updates).
- ISO 27001:2022 (informational cross-walk; SmartERP does not currently pursue ISO 27001 attestation).
- D.Lgs. 138/2024 (NIS2) — overlapping evidence base; the SOC 2 control matrix satisfies > 70% of the NIS2 art. 24 obligations.
- Plan §31.2 Sprint 35 — this audit prep; Sprint 36 closes the gap list and produces the auditor-facing PDF.
