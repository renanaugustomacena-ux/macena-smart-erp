# Operations Cadence — SmartERP

Calendar of recurring operational tasks. Each row has a frequency, owner, and expected duration.

---

## 1. Daily

| Task | Owner | Duration | Notes |
|------|-------|----------|-------|
| Morning health check — `/api/health` for every prod tenant | On-call | 5 min | Grafana dashboard |
| Review error budget (`/metrics` + alerts) | On-call | 10 min | |
| Logical backup Postgres | Cron | — | 03:00 CET |
| SDI invoice queue drain | Cron | — | 02:00 CET + hourly |
| Incident triage (if P1/P2 open) | On-call | ad-hoc | |

---

## 2. Weekly

| Task | Owner | Duration |
|------|-------|----------|
| Trivy image + fs re-scan | Eng Infra | 30 min |
| Dependency audit (`npm audit`) | Eng Infra | 15 min |
| Detect-secrets scan | Eng Infra | 10 min |
| Weekly on-call rota handover | Ops Mgr | 30 min |
| Customer support queue triage | CS Mgr | 60 min |

---

## 3. Monthly

| Task | Owner | Duration |
|------|-------|----------|
| Restore drill (Postgres + Redis) from latest backup into staging | Eng Infra | 2 h |
| SLO review and error-budget retrospective | SRE Lead | 1 h |
| Access review — user list, role assignments | CISO | 2 h |
| Penetration-testing spot-check (OWASP Top 10 for public endpoints) | CISO | 1 d |
| FatturaPA submission statistics review | Compliance Officer | 30 min |
| Review `docs/CHANGELOG.md` drafts and cut a minor release if appropriate | Release Mgr | 1 h |

---

## 4. Quarterly

| Task | Owner | Duration |
|------|-------|----------|
| SLA / uptime report to Enterprise customers | Account Mgmt | 1 d |
| Security self-assessment refresh (`docs/SECURITY-SELF-ASSESSMENT.md`) | CISO | 1 d |
| GDPR DPO review | DPO | 1 d |
| NIS2 ACN reporting cadence check | CISO | 30 min |
| Dependency upgrade sprint (minor + patch only) | Eng Infra | 3 d |
| Review `docs/TECHNICAL-DEBT.md` and `docs/RISK-ACCEPTANCES.md` | Eng Mgr | 2 h |
| Customer advisory-board meeting | PM | 2 h |

---

## 5. Annual

| Task | Owner | Duration |
|------|-------|----------|
| Penetration test (external vendor) | CISO | 2 w |
| Disaster-recovery drill — full failover + restore | Eng Infra | 1 d |
| ISO/IEC 27001 certification review (target) | CISO | 2 w |
| Pricing review (PRICING.md) | CFO | 1 d |
| Strategic roadmap | CEO+CTO | 2 d |
| Primary-source re-verification of ITALIAN-COMPLIANCE.md | Compliance Officer | 2 d |

---

## 6. Ad Hoc

- Italian law change notified by Normattiva: update ITALIAN-COMPLIANCE.md within 30 days.
- Security advisory CVSS ≥ 7.0: emergency patch within 72 hours.
- Customer breach / data incident: GDPR art. 33 72-hour clock.
