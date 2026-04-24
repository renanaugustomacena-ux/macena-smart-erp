# Service Level Objectives — SmartERP

**Product:** Cloud ERP for Italian manufacturing SMEs (target market: Mozzecane/Verona).
**SLO period:** 28 days rolling (calendar month for billing).
**Responsible party:** SmartERP SRE team.
**Change review cadence:** Quarterly.

The SLO list below is contractual (for paid plans Professionale and Enterprise) and informative (for Base). The error-budget policy drives deployment freezes.

---

## 1. User-Facing SLIs and SLOs

| SLI | SLO target | Measurement | Error-budget (28 d) |
|-----|------------|-------------|----------------------|
| API Availability — `/api/health` returns 200 | 99.9% | Uptime monitor external probe every 60 s | 40m 19s |
| Read latency p95 — GET /api/inventory/products | ≤ 250 ms | Prometheus histogram `http_request_duration_seconds` | — |
| Write latency p95 — POST /api/sales/orders | ≤ 500 ms | Same | — |
| FatturaPA generation latency p95 | ≤ 1.5 s | `smarterp_fatturapa_build_duration_seconds` | — |
| Seed script runtime | ≤ 30 s on dev | ad-hoc | — |
| Error rate — 5xx | ≤ 0.1% | `smarterp_http_errors_total` / `smarterp_http_requests_total` | — |
| Auth fail rate (excluding legitimate 401) | ≤ 2% | `smarterp_auth_events_total{outcome=failure}` | — |

---

## 2. Background-Job SLOs

| Job | SLO | Notes |
|-----|-----|-------|
| Invoice → SDI submission (queue age) | p95 ≤ 5 min from `status=queued` to `status=sent` | Sync to SDI once per minute cron |
| Stock-low notification | Fire within 5 min of `quantityOnHand ≤ reorderPoint` | Scheduled query every 5 min |
| Daily backup | Success by 04:00 CET each night | Ops cron |

---

## 3. Error-Budget Policy

- If the 28-day error budget for API availability is consumed > 50% **ongoing** → feature-freeze on backend changes; only bug-fix / incident work merges.
- If consumed > 75% → engineering-wide review; no new deploys without SRE approval.
- If 100% consumed → post-mortem required within 5 business days; reliability work prioritised in the next sprint.

---

## 4. Composite Uptime Target

"SmartERP is up for a tenant" = `backend UP ∧ postgres UP ∧ redis UP`. The compound SLO is 99.85% (budget ~60 min / month); stricter than 99.9% because Postgres and Redis each contribute independently.

---

## 5. Latency Budgets by Endpoint Class

| Class | p50 | p95 | p99 |
|-------|-----|-----|-----|
| Health | 10 ms | 50 ms | 100 ms |
| Read (GET list/detail) | 80 ms | 250 ms | 500 ms |
| Write (POST/PATCH) | 150 ms | 500 ms | 1500 ms |
| Heavy compute (FatturaPA build, inventory valuation) | 300 ms | 1500 ms | 3000 ms |

---

## 6. Capacity Plan

- Day-1 sizing: 3 backend replicas × 1 vCPU/2 GiB, Postgres 4 vCPU/16 GiB, Redis 1 vCPU/1 GiB.
- Threshold to add a replica: `rate(smarterp_http_requests_total[5m]) > 150` req/s sustained.
- Threshold to vertically resize Postgres: `pg_stat_database.blks_read` growth > 10%/month OR sequential scans > 20% of reads.

---

## 7. Incident Severity

| Severity | Definition | Response time | Resolution target |
|----------|------------|---------------|-------------------|
| P1 | Total outage OR tenant isolation breach OR active data loss | 30 min | 2 h |
| P2 | Degraded but functional; one module unavailable | 2 h | 8 h |
| P3 | Feature defect, non-blocking | Next business day | Next sprint |

---

## 8. Annual Review Items

- Re-benchmark latency p95 against tenant count (linear-fit check).
- Validate error-budget burn rate formulae against actual monthly incidents.
- Review the list of background jobs that have grown in importance (e.g., new ESG export may warrant its own SLO).
