# Runbook — SmartERP Production Operations

**Audience:** on-call / SRE / platform engineers.
**SLA target:** P1 (tenant completely down) — 30 min response, 2 h resolution target.
**P2** (degraded, not total outage) — 2 h response, 8 h target. **P3** (feature issue) — next business day.

---

## 1. Quick Reference

| Item | Value |
|------|-------|
| Backend port | 3001 |
| Frontend port | 3000 |
| Postgres port | 5432 |
| Redis port | 6379 |
| Prometheus `/metrics` | http://backend:3001/metrics |
| Health probe | http://backend:3001/api/health |
| Live/Ready probes | http://backend:3001/api/health/{live,ready} |
| Log location | stdout JSON (fluent-bit → Loki) |
| Uptime monitor | (external — project-specific) |
| Incident chat | `#smarterp-oncall` Slack (not active in dev) |

---

## 2. Startup & Shutdown

### 2.1 Local bring-up

```
cd ~/Documents/SmartERP
docker compose up --build
```

Services become healthy when `/api/health` returns `status: ok` and both dependencies are `up`. On first boot this can take 60-90 s because Postgres initialises its schema via TypeORM `synchronize: true` (dev only).

### 2.2 Controlled shutdown

```
docker compose down
```

For full reset (wipes DB volume):
```
docker compose down -v
```

### 2.3 Seeding the demo tenant

```
docker compose exec backend npm run seed
```

This creates `Fonderia Mozzecane SRL` with 10 products, 2 warehouses, 5 customers, 5 suppliers, 20 stock movements, 3 production orders, 5 sales orders, 3 invoices, and 50 journal entries. Idempotent; rerun safe.

To fully reset the demo tenant and reseed:
```
docker compose exec backend npm run seed:reset
```

---

## 3. Standard Incident Playbooks

### 3.1 `/api/health` returns 503 `status: down`

1. Check `dependencies` object in the response body.
2. **Postgres down:**
   - `docker compose ps` — is `db` UP?
   - `docker compose logs db --tail 200` — look for `FATAL`, `out of memory`, `could not fsync`.
   - `docker compose exec db pg_isready` — boolean.
   - If disk full: `docker system df`; prune. If data volume corrupt: restore from last snapshot (WAL archive target is `s3://smarterp-backups/postgres/`).
3. **Redis down:**
   - `docker compose logs redis --tail 100`.
   - `docker compose exec redis redis-cli -a $REDIS_PASSWORD ping` → expect `PONG`.
   - If OOM: increase `maxmemory` or prune LRU keys (Redis cache; acceptable loss).
4. If both deps UP but health still `degraded`: check backend log for stack traces — bug; escalate to engineering rota.

### 3.2 Elevated 5xx (look at `smarterp_http_errors_total`)

1. Hit `/metrics` and filter `smarterp_http_errors_total` by path/status.
2. Correlate with `docker compose logs backend --tail 500 | jq 'select(.level=="error")'`.
3. If DB-connection errors: Postgres pool saturation — check `pg_stat_activity` for blocked queries; adjust `DB_POOL_MAX`.
4. If auth 401 spike: token rotation bug or DDoS on `/api/auth/login` — tighten Throttler per-IP limit.
5. Roll back by `docker compose up --build backend` on previous image tag: `docker tag ghcr.io/smarterp/backend:<prev> ghcr.io/smarterp/backend:current && docker compose up -d backend`.

### 3.3 FatturaPA submission failure (SDI scarti)

1. Check `invoices` table WHERE `status = 'rejected'`.
2. The `notes` field records the SDI error code. Common:
   - `00001` invalid destinatario — check `customerSdiCode` or `pecEmail`.
   - `00200-00499` XML schema invalid — run `xmllint --schema docs/schemas/Schema_del_file_xml_FatturaPA_v1.2.2.xsd <file>`.
   - `00411` data in past. Fix invoice `invoiceDate`.
3. Correct the invoice and re-queue: `PATCH /api/accounting/invoices/{id}/requeue`.
4. If the error is systemic (all tenants): pause the SDI queue worker, notify engineering, keep invoices in DRAFT.

### 3.4 Tenant isolation violation alert

**Trigger**: log line matching `Tenant scope violation`.
1. Identify attacker: `tenantId` in the log prefix is the attacker tenant; target `tenantId` is the one accessed.
2. Freeze the attacker tenant: `PATCH /api/tenants/{id}` with `status: 'suspended'`.
3. Rotate the attacker tenant's JWT secret (tenant-level secret not global).
4. Forensic: dump `users` + `auth_events` table for that tenant. Export to incident case.
5. Notify DPO — this is a potential art. 33 GDPR breach; 72-hour clock starts.

### 3.5 Stock negative (insufficient-stock BadRequest persists)

1. Likely cause: ghost reservations from a crashed transaction.
2. Reconcile: query `stock_levels` where `quantityReserved > quantityOnHand`; match against open sales orders.
3. `UPDATE stock_levels SET quantityReserved = 0 WHERE tenantId=$1 AND productId=$2 AND warehouseId=$3;` after confirming no live reservation.
4. Open ticket to investigate the crash path.

---

## 4. Backup & Restore

- **Postgres logical dump** — `docker compose exec -T db pg_dump -U smarterp smarterp | gzip > backup-$(date +%F).sql.gz` — daily via cron.
- **Retention** — 30 days rolling + monthly kept for 7 years (fiscal 10-year compliant if coupled with document archive; conservazione a norma handled via InfoCert — see `docs/INTEGRATIONS.md`).
- **Restore drill** — monthly: `gunzip < backup.sql.gz | docker compose exec -T db psql -U smarterp smarterp_restore_test`.

---

## 5. Security Rotations

- **JWT_SECRET / JWT_REFRESH_SECRET** — rotate every 90 days. Procedure: add new key to KMS; deploy with `JWT_SECRET_NEXT` set; flip after 24h; delete old.
- **DB_PASSWORD** — rotate every 180 days, concurrent with TLS cert renewal.
- **Admin user emergency lockout** — `UPDATE users SET isActive=false, refreshTokenHash=NULL WHERE email=$1;`
- **Detect-secrets scan** — weekly in CI (`.pre-commit-config.yaml`).

---

## 6. Observability

- `/metrics` scraped every 15 s by Prometheus.
- **Alert rules** (recording rules in `infra/prometheus/alerts.yaml` — template):
  - `HighErrorRate`: `rate(smarterp_http_errors_total[5m]) > 5`.
  - `PostgresDown`: `probe_success{job="smarterp-health",target="postgres"} == 0 for 2m`.
  - `RedisDown`: similar.
  - `AuthBruteForce`: `rate(smarterp_auth_events_total{outcome="failure"}[5m]) > 20`.
  - `TenantScopeViolation`: any occurrence triggers P1.
- **Logs** — structured JSON. Field conventions:
  - `event` — top-level action (`auth.login`, `auth.refresh`, `inventory.move`, `invoice.queue`).
  - `outcome` — `success` | `failure` | `replay_detected`.
  - `tenantId` — always included on authenticated requests.
  - `userId` — always included on authenticated requests.

---

## 7. Capacity & Scaling

- **Vertical first**: backend node 2 vCPU / 4 GiB comfortably handles 50 tenants @ 10 TPS each.
- **Horizontal**: JWT-only stateless backend; scale horizontally by running multiple `backend` replicas behind the ingress. Redis and Postgres single-instance managed service (RDS/Cloud SQL).
- **Load test command** (dev): `hey -z 60s -c 50 -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/inventory/products`.

---

## 8. Contact & Escalation

- Primary on-call: PagerDuty schedule `smarterp-primary`.
- Secondary: `smarterp-secondary`.
- Engineering manager: pagerduty `smarterp-eng-mgr`.
- DPO (GDPR breach): `dpo@smarterp.test`.
- External SDI support: Agenzia delle Entrate Fatture e Corrispettivi helpdesk 800 299 940.
