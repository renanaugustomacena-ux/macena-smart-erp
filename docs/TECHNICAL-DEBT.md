# Technical Debt Register — SmartERP

Tracked items below are acknowledged shortfalls. Each has a severity and a pre-scheduled review date. When an item is closed, it moves to `docs/CHANGELOG.md` under the relevant version.

| ID | Item | Severity | Since | Review by |
|----|------|----------|-------|-----------|
| T-01 | TypeORM `synchronize: true` in dev only; migrations folder empty | medium | 2026-04-17 | 2026-Q3 |
| T-02 | Jest coverage ratchet not set in CI | low | 2026-04-17 | 2026-Q3 |
| T-03 | Metrics uses hand-rolled Prometheus exposition; migrate to `prom-client` when scraper needs histograms | low | 2026-04-17 | 2026-Q4 |
| T-04 | Per-endpoint rate-limit (login 5/min) not applied; only global Throttler | medium | 2026-04-17 | 2026-Q2 |
| T-05 | Swagger available in dev only; blocked in prod. No public API portal yet. | low | 2026-04-17 | 2026-Q4 |
| T-06 | No account-lockout on N failed logins; only rate limit | medium | 2026-04-17 | 2026-Q2 |
| T-07 | MFA (TOTP) not supported | high | 2026-04-17 | 2026-Q3 |
| T-08 | LIPE (Liquidazione Periodica IVA Elettronica) auto-transmission to AdE | medium | 2026-04-17 | 2026-Q3 |
| T-09 | Conservazione a norma (InfoCert / Aruba PEC) integration | medium | 2026-04-17 | 2026-Q2 |
| T-10 | Invoice PDF generation (PDF/UA-1) | low | 2026-04-17 | 2026-Q3 |
| T-11 | TD20-TD28 FatturaPA document types not emitted | low | 2026-04-17 | 2026-Q4 |
| T-12 | FatturaPA XSD runtime validation in E2E (xmllint --schema) | medium | 2026-04-17 | 2026-Q2 |
| T-13 | Stock reservation uses ADJUSTMENT stock-movement type; should have dedicated RESERVATION/RELEASE types | low | 2026-04-17 | 2026-Q3 |
| T-14 | DB-level CHECK constraint `totalDebit = totalCredit` on journal_entries | low | 2026-04-17 | 2026-Q4 |
| T-15 | GDPR ROPA (Registro Trattamenti) not exported to CSV | low | 2026-04-17 | 2026-Q4 |
| T-16 | Sales-order lines denormalised into JSONB; promote to child table when line-volume exceeds 100k/month | low | 2026-04-17 | 2026-Q4 |
| T-17 | Frontend (Next.js) dashboard has skeleton pages only; domain forms unimplemented | high | 2026-04-17 | 2026-Q2 |
| T-18 | Backup/restore automation (WAL archive + S3 object-lock) | medium | 2026-04-17 | 2026-Q2 |
| T-19 | No automated schema-migration on boot in prod; manual run required | low | 2026-04-17 | 2026-Q3 |
| T-20 | `cache-manager-redis-store` v3 is pinned; upgrade path to v4 (new init API) | low | 2026-04-17 | 2026-Q4 |
