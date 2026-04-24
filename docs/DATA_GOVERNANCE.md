# SmartERP — Data Governance

**Owner:** Data Protection Officer (DPO) — dpo@smarterp.it
**Last review:** 2026-04-18
**Next review:** 2026-10-18 (6-month cadence)
**Supersedes:** DATA-RESIDENCY.md (residency material merged into §7).

This document closes gap A-01 from the GAPS audit. It satisfies v2.0
plan Section 15 by enumerating classification levels, a personal-data
inventory, the data-flow diagram, recovery-point / recovery-time
objectives, the erasure SOP, and the portability contract.

## 1. Scope

SmartERP is a multi-tenant SaaS ERP for Italian manufacturing SMEs.
Each tenant represents one customer organisation; tenants are isolated
both at the application layer (TenantScopeGuard, every query carries
tenantId) and at the Postgres layer (Row Level Security policies
enabled by migration `EnableRowLevelSecurity1713436900000`).

The controller of personal data processed in SmartERP is the tenant
organisation; SmartERP Srl (the vendor) acts as a data processor under
EU General Data Protection Regulation (GDPR) Art. 28 and Italian
D.Lgs. 196/2003 as amended by D.Lgs. 101/2018. A written Data
Processing Agreement (DPA) is annexed to every tenant contract.

## 2. Data Classification

| Level | Examples in SmartERP | Handling |
|---|---|---|
| Public | Landing page copy, OpenAPI spec, marketing PDFs | No restrictions. |
| Internal | Chart-of-accounts templates, country-level aggregate metrics | Authenticated users of any tenant. |
| Confidential | Product catalogues, sales orders, production plans, invoices, customer anagraphics | Tenant-scoped. Access only via JWT with matching tenantId. |
| Restricted | Payment IBANs, SDI credentials, user password hashes, audit-log bodies | Field-level AES-256-GCM encryption; KMS-sourced keys; access logged. |

Classification propagates through columns via the `@DataClassification()`
decorator (implemented opportunistically on payment-related fields;
formal classification of every column is scheduled for Q2 2026).

## 3. Personal-Data Inventory

| Dataset | Categories | Legal basis (GDPR Art. 6) | Retention |
|---|---|---|---|
| Users (SmartERP operators) | name, email, phone, password hash, role, session metadata | Contract (b) | Active + 24 months (deactivated accounts purged) |
| Customers (anagrafica cliente) | name, billing address, VAT number, fiscal code, PEC, SDI code | Contract (b) | 10 years (Codice Civile art. 2220) |
| Suppliers | name, billing address, VAT number, bank IBAN | Contract (b) | 10 years |
| Invoices | header + lines including customer anagraphics, amounts | Legal obligation (c) — DPR 633/1972 | 10 years (WORM on object storage) |
| Payroll-adjacent stubs | employee name, tax code, IBAN | Contract (b) — ONLY if tenant enables | 10 years after employment ends |
| Audit log | userId, tenantId, IP address, path, diff | Legitimate interest (f) — security | 18 months hot; 7 years cold archive |

Biometric data, health data, and other Art. 9 special categories are
out of scope; SmartERP is not designed to hold them. If a tenant
attempts to enter them in a free-text field, the ingestion warning
banner cautions against doing so; detection heuristics are a Q3 2026
roadmap item.

## 4. Data-Flow Diagram

```
      Tenant user browser ── HTTPS/TLS 1.3 ──▶ CloudFront + WAFv2
                                                    │
                                                    ▼
                                        Next.js app.smarterp.it  (EU)
                                                    │ HTTPS/JWT
                                                    ▼
                                        NestJS api.smarterp.it   (EU)
                       ┌──────────── RBAC ──────────┼───────────────┐
                       │                            │               │
                   PostgreSQL 16             Redis 7          BullMQ (Redis)
                    RLS + TDE                                 payroll, eod,
                                                              report, invoice-sdi
                                                                    │
                                                                    ▼
                                                       SDI intermediary
                                                     (FatturaFlow/DocFisco)
                                                                    │
                                                                    ▼
                                                       S3 Object-Lock WORM
                                                   (Conservazione a Norma)
```

- **Ingress:** TLSv1.2+ (prefer 1.3), HSTS 2y preload, CSP strict.
- **Intra-cluster:** mTLS via service mesh (Istio / Linkerd — roadmap
  Q3 2026; today plain text on the private VPC).
- **Egress to SDI intermediary:** HTTPS with mutual TLS where the
  provider supports it; API-key-in-header for Aruba DocFisco.
- **Storage at rest:** Postgres AES-256 via RDS, Redis AES-256 via
  ElastiCache; S3 AES-256-GCM with KMS CMK rotation every 365 days.
- **Field-level encryption:** Payment IBANs and SDI API keys carry an
  extra AES-256-GCM layer using a KMS-derived data key per tenant.

## 5. RPO / RTO

| Tier | RPO (data-loss tolerance) | RTO (recovery time) |
|---|---|---|
| Tier 1 — Business-critical (Postgres primary, Redis sessions) | 5 minutes | 1 hour |
| Tier 2 — Application containers (stateless backend + frontend) | n/a | 15 minutes |
| Tier 3 — Archival (FatturaPA WORM archive) | 24 hours | 4 hours |

Postgres: point-in-time recovery enabled; WAL shipping to a second AZ
every 60 seconds. Snapshots every 6 hours; daily cross-region replica
in `eu-west-1`. Monthly DR drills ("Game-day" runbook in RUNBOOK.md).

## 6. Erasure Standard Operating Procedure (GDPR Art. 17)

A "right-to-be-forgotten" request is fulfilled within 30 days.

1. Legal / DPO verifies the request authenticity and scope.
2. Support opens a ticket in the internal tracker tagged `gdpr-erasure`.
3. The `gdpr:erase` CLI (scheduled Q2 2026) runs against the tenant
   database connection with RLS bypass role, removes the user row,
   pseudonymises the `audit_logs.userId` fields (replacing with the
   SHA-256 of the user's UUID + a salt kept in KMS), and nulls the
   `customerId`/`supplierId` PII columns.
4. Invoices are NOT deleted — they are a fiscal obligation (10-year
   retention under DPR 633/1972). Customer name on past invoices is
   replaced with "Soggetto cancellato GDPR" and VAT number is retained
   as required by tax law.
5. Confirmation letter is issued to the data subject.

The erasure job also removes the row from the hot archive and schedules
cold-storage deletion after the 7-year audit-log retention expires.

## 7. Data Portability and Residency (merged from DATA-RESIDENCY.md)

- **Primary region:** AWS `eu-south-1` (Milan).
- **DR region:** AWS `eu-west-1` (Dublin).
- **No data leaves the EU** for any business flow. The SDI submission
  stays within Italy (endpoints `sdi.fatturapa.gov.it` via the
  intermediary). Exception: npm registry, GitHub Actions, and GHCR
  are US-hosted — but these are CI / build-time only and do not carry
  tenant payload data.
- **Portability (GDPR Art. 20):** export endpoints `/api/v1/export/customers`,
  `/api/v1/export/invoices`, `/api/v1/export/stock` return JSON + CSV.
  The Zucchetti / TeamSystem "Studio" format export is shipped via
  the operator CLI `npm run export:studio` and complies with the
  commercialista hand-off checklist in RUNBOOK.md.

## 8. Vendor / Sub-processor Register

| Sub-processor | Purpose | Data processed | Region |
|---|---|---|---|
| AWS (Ireland & Italy) | Compute, storage, networking | All tenant data | eu-south-1 / eu-west-1 |
| CloudFlare | DNS, edge caching for landing page | IP logs only | EU edge |
| SDI intermediary (per contract) | FatturaPA submission | Invoice XML | IT |
| Sentry | Error tracking (opt-in) | Stack traces, tenant id | EU |
| GitHub | Source, CI/CD | Source code, no tenant data | US |

A change to this register triggers a 30-day prior notice to tenants.

## 9. Incident Response Summary

See `docs/RUNBOOK.md §Incident Response` for the operational playbook.
Mandatory GDPR 72-hour breach notification is the DPO's responsibility;
the on-call engineer is responsible for initial containment within
15 minutes of paging.

## 10. Review Cadence

- DPO reviews this document every 6 months.
- Any change to the sub-processor register, the DPA, or a material
  change in data-flow triggers an out-of-cycle review.
- Tenants receive a change-log summary in the monthly status email.
