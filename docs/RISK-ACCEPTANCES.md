# Risk Acceptances — SmartERP

Explicit record of risks the team has evaluated and chosen to accept rather than remediate immediately. Every entry must have an owner, an expiration, and a compensating control.

| # | Risk | Owner | Accepted on | Re-review | Compensating control |
|---|------|-------|-------------|-----------|----------------------|
| R-01 | Helmet CSP is relaxed in development to allow Swagger UI inline scripts | Eng Mgr | 2026-04-17 | 2026-07-17 | CSP strict in production; Swagger disabled in prod. |
| R-02 | `DB_PASSWORD` default in docker-compose is `smarterp_dev_pass`; only used for local dev | Eng Mgr | 2026-04-17 | 2026-07-17 | Production uses KMS-delivered secret; dev compose not exposed externally. |
| R-03 | `JWT_SECRET` default `replace-me-in-production-32-chars-minimum` in `.env.example` | Eng Mgr | 2026-04-17 | 2026-07-17 | Placeholder only; module rejects boot if real secret < 16 chars. |
| R-04 | TypeORM `synchronize: true` in dev environments | Eng Mgr | 2026-04-17 | 2026-10-17 | Prod forces `synchronize: false`; migrations path documented. |
| R-05 | Bcrypt dependency kept alongside argon2 for legacy hash verification | Eng Mgr | 2026-04-17 | 2027-04-17 | Removed once all tenants' password hashes migrated to argon2id (tracked via user.passwordHash prefix audit). |
| R-06 | No MFA yet | CTO | 2026-04-17 | 2026-Q3 | Strong password policy + rate limit. Risk re-evaluated at Q3. |
| R-07 | Stock reservations use ADJUSTMENT movement type rather than a dedicated RESERVATION type | Eng Lead | 2026-04-17 | 2026-10-17 | Audit trail preserved via `referenceNumber` + `notes` field; migration planned T-13. |
| R-08 | FatturaPA XML generated but XSD validation only in E2E, not at write time | Eng Lead | 2026-04-17 | 2026-07-17 | Enums constrain `ivaNature` and `documentType`; integration test path planned T-12. |

---

## Procedure

1. New risks added only with written approval from the listed owner.
2. Each risk has a compensating control; if the control lapses, the risk is reopened as a P-issue.
3. Expired entries (past the re-review date) block the next release until re-validated.
