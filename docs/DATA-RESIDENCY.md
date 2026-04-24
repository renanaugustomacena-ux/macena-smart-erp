# Data Residency — SmartERP

Summary of where SmartERP data lives, and the legal basis for any cross-border transfer.

---

## 1. Primary Region

- **All production data**: AWS `eu-west-1` (Ireland) OR `eu-south-1` (Milano) per tenant plan.
- **Base plan**: eu-west-1 shared.
- **Professionale plan**: choice between eu-west-1 and eu-south-1.
- **Enterprise plan**: dedicated region (including eu-south-1 Milano or on-premises deployment).

---

## 2. Storage Classes

| Data | Storage | Encryption |
|------|---------|------------|
| Postgres data (transactional) | RDS encrypted with KMS customer-managed key | AES-256 at rest |
| Redis cache | ElastiCache (in-memory; no disk persistence for cache store) | in-transit TLS |
| Invoice XML | S3 `smarterp-invoices-<tenantId>` with SSE-KMS + Object Lock | AES-256 at rest |
| Backups | S3 Glacier Deep Archive | AES-256 at rest |
| Audit logs | CloudWatch + S3 archived after 90 days | AES-256 |

---

## 3. Cross-Border Transfer

Default: **no transfer outside EU**. Exceptions:
- **Sentry** — error aggregation in EU region (eu-central-1) under DPA.
- **Stripe** (if enabled) — payment processing may route to US under SCC + Adequacy bridge; opt-in per tenant.
- **Cloudflare** — transit/DDoS only; no PII stored; standard DPA.

Any new sub-processor that processes data outside EU requires GDPR art. 46 SCCs + written customer notice 30 days in advance.

---

## 4. Data Subject Rights (GDPR art. 15-22)

Tenants self-serve via admin UI:
- **Access (art. 15)**: export tenant data as CSV + JSON archive.
- **Rectification (art. 16)**: edit via UI; audit trail preserved.
- **Erasure (art. 17)**: right-to-be-forgotten complicated by Codice Civile art. 2220 10-year retention for fiscal data. Approach: pseudonymise non-fiscal fields; retain fiscal skeleton.
- **Portability (art. 20)**: export includes full entity JSON + FatturaPA XML archive for structured interoperability.
- **Objection (art. 21)**: marketing unsubscribe one-click; fiscal processing cannot be objected to (legal obligation basis).

---

## 5. Deletion

- **Tenant cancels subscription**: data retained 30 days for export, then pseudonymised (non-fiscal), then fiscal skeleton retained for 10 years, then full erasure.
- **User removed from tenant**: user record disabled (`isActive=false`) + refresh tokens revoked; audit references retained for 2 years per compliance log retention.

---

## 6. Subpoena / Law Enforcement

- Italy: request must come from Autorità Giudiziaria via Procura della Repubblica, or from Agenzia delle Entrate within legal-compliant frame.
- Non-Italian law-enforcement requests are refused by default; require customer notification under GDPR art. 48.
- Transparency report published annually — number of requests received, served, refused.
