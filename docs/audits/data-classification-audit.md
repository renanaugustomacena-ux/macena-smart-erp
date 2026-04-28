# Data classification — entity column audit

> **Sprint 1 — Story S1.3.** Per plan §10.7 + §11.5: tag every entity column
> with one of the four `DataClassification` levels (`public` / `internal` /
> `confidential` / `restricted`). Foundation for ADR-DA07 field-level
> encryption, Pino-redaction-list config, and GDPR ROPA art. 30 export.

**Audit date**: 2026-04-28.
**Auditor**: autonomous-agent (Sprint 1).
**Scope**: every `*.entity.ts` and inline `@Entity` class under
`backend/src/`.

## Coverage status

| Aggregate | File | Status |
|---|---|---|
| **User** (auth) | `src/auth/auth.service.ts` | **Tagged this iteration** — 7 columns annotated. |
| **Tenant** | `src/tenants/tenant.entity.ts` | **Tagged this iteration** — 11 columns annotated. |
| **Customer** | `src/sales/sales.entity.ts` | **Tagged this iteration** — 13 columns annotated. |
| **SalesOrder** | `src/sales/sales.entity.ts` | Pending — Sprint 2 (S2.x). |
| **Product** | `src/inventory/inventory.entity.ts` | Pending — Sprint 2 (S2.x). |
| **Warehouse** | `src/inventory/inventory.entity.ts` | Pending — Sprint 2 (S2.x). |
| **StockLevel** | `src/inventory/inventory.entity.ts` | Pending — Sprint 2 (S2.x). |
| **StockMovement** | `src/inventory/inventory.entity.ts` | Pending — Sprint 2 (S2.x). |
| **ProductionOrder** | `src/production/production-order.entity.ts` | Pending — Sprint 2 (S2.x). |
| **WorkOrder** | `src/production/work-order.entity.ts` | Pending — Sprint 2 (S2.x). |
| **ChartOfAccount** | `src/accounting/accounting.entity.ts` | Pending — Sprint 2 (S2.x). |
| **JournalEntry** | `src/accounting/accounting.entity.ts` | Pending — Sprint 2 (S2.x). |
| **Invoice** | `src/accounting/accounting.entity.ts` | Pending — Sprint 2 (S2.x). |
| **AuditLogEntry** | `src/audit/audit-log.entity.ts` | Pending — Sprint 2 (S2.x). |

The "tag every column" sweep across all aggregates is queued for Sprint 2
slot S2.x (catch-up). Sprint 1 closes the high-priority security-relevant
entities (those that hold secrets, PII, or fiscal identifiers).

## Tagged columns this iteration

### User (`src/auth/auth.service.ts`)

| Column | Level | Rationale |
|---|---|---|
| `firstName`, `lastName` | confidential | PII (GDPR Art. 4 §1) — name, identifying data. |
| `email` | confidential | PII; used as login id; subject of RFC 7807 / GDPR DSAR exports. |
| `passwordHash` | restricted | Argon2id-encoded; never logged; never returned by any endpoint; never serialised to LLM prompts. |
| `companyName` | confidential | Tenant-identifying business string. |
| `phone` | confidential | PII (contact). |
| `partitaIva` | confidential | Italian fiscal identifier. |
| `refreshTokenHash` | restricted | Token-equivalent; SHA-256 hash; bearer-grade if leaked. |

### Tenant (`src/tenants/tenant.entity.ts`)

| Column | Level | Rationale |
|---|---|---|
| `name` | confidential | Tenant identifier; visible to authenticated users only. |
| `vatNumber`, `fiscalCode`, `sdiDestinationCode`, `pecEmail` | confidential | Italian fiscal identifiers; invoice-issuance scope. |
| `billingAddress`, `billingCity`, `billingPostalCode`, `billingProvince` | confidential | Billing PII. |
| `billingCountry` | public | Two-letter country code; not identifying. |
| `settings` (JSONB) | restricted | May contain SDI credentials, PSD2 consent metadata, AI cost caps, conservazione provider keys per ADR-016. Field-level encryption rotation candidate per ADR-DA07. |

### Customer (`src/sales/sales.entity.ts`)

| Column | Level | Rationale |
|---|---|---|
| `code` | confidential | Tenant-internal customer code. |
| `name` | confidential | Counterparty PII. |
| `customerType` | confidential | Routing decision (PA / business / individual / foreign) — visible internally only. |
| `vatNumber`, `fiscalCode`, `sdiDestinationCode`, `pecEmail` | confidential | Italian fiscal identifiers. |
| `email`, `phone` | confidential | Contact PII. |
| `address`, `city`, `postalCode`, `province` | confidential | Counterparty PII. |
| `country` | public | Two-letter country code. |

## Levels in production use

- **public** (3 columns): country codes — non-identifying enums.
- **internal** (0 columns this iteration; reserved for reference data: chart-of-account templates, country master, currency master).
- **confidential** (28 columns this iteration): the bulk of PII + fiscal identifiers + counterparty contact data.
- **restricted** (3 columns this iteration): `passwordHash`, `refreshTokenHash`, `tenants.settings`. These are the field-level-encryption candidates per ADR-DA07 (Sprint 2+ implementation).

## Downstream uses (the foundation)

The decorator metadata is consumed by:

1. **Field-level encryption** (ADR-DA07; Sprint 2+). At write time, the
   ORM subscriber checks `getDataClassification(entity, columnName)`; if
   the value is `restricted`, AES-256-GCM-encrypt with a per-tenant data
   key wrapped by the AWS KMS CMK.

2. **Structured-log redaction** (Pino redact-list builder; Sprint 2). At
   bootstrap, walk every entity class and add every `restricted`-tagged
   property path to the Pino redact list (currently maintained manually
   per plan §11.6).

3. **GDPR ROPA art. 30 export** (Sprint 4+). Auto-derive "categorie di
   dati personali" per processing from the set of `confidential` and
   `restricted` columns touched by each saga.

4. **OpenAPI generator** (Sprint 6+). Surface
   `x-data-classification: <level>` on every generated schema property,
   for partner-SDK consumers.

5. **GDPR DSAR export** (Sprint 12+). Filter the export to the
   `confidential` / `restricted` columns of records whose user/customer
   PK matches the data-subject id.

## CI guard (queued for Sprint 2 catch-up)

A scan-every-entity script — `audit:data-classification` — that lists
unannotated columns will land alongside the catch-up sweep. For Sprint 1,
the audit lives in this document; the decorator implementation +
high-priority entity tagging is the deliverable.

## Tests

- `backend/src/common/data-classification.decorator.spec.ts` — 5 tests:
  records classification, returns undefined for unannotated, lists
  classified properties from a class / instance, no cross-class collision.

## Next-iteration note

When new entities or columns land:

1. Default classification: `confidential` for tenant-scoped business
   data; `restricted` for anything secret-like (key, hash, token, IBAN,
   credentials JSON).
2. Add `@DataClassification(level)` next to `@Column(...)`.
3. Update this audit document.
4. (Sprint 2+) re-run `npm run audit:data-classification`.
