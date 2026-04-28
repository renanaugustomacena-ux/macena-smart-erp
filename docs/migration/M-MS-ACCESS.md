# M-MS-ACCESS — Migration runbook: Microsoft Access database → SmartERP

- **Runbook id**: M-MS-ACCESS
- **Source vendor**: Microsoft (Access component of Microsoft 365 / Office)
- **Source product**: Access 2016+ `.accdb` databases (custom-built per-customer)
- **Source-vendor version coverage**: Access 2016, 2019, 2021, Microsoft 365.
- **Status**: First-production-cutover-eligible 2027-Q1 (P3 priority per plan §21.1).
- **Engineer owner**: Migration team lead.
- **Customer-success owner**: CS lead Verona.
- **Last reviewed**: 2026-04-29.
- **Plan reference**: §21.1 + ADR-040.

## 1. Source system overview

### 1.1 What it is

Microsoft Access is the long-tail substrate beneath ~5% of Italian artisan / very-small manufacturing firms (sub-€500k revenue) — typically a custom-built per-customer database designed in the 2000s by a now-retired employee or a local consultant. Schema is unique per customer; the migration is mostly a discovery exercise (mapping the customer's bespoke schema to SmartERP's domain) plus a one-shot data extraction.

### 1.2 Deployment model

- Single `.accdb` (or `.mdb`) file on a Windows network share. No server.
- Multi-user concurrency through Access's record-locking; not safe past ~5 simultaneous users.

### 1.3 Key resources

The customer's Access database is **bespoke**. The runbook ships a discovery checklist that the migration engineer walks through with the customer's data steward. Common patterns:

- A `Clienti` table.
- A `Fornitori` table.
- A `Prodotti` (or `Articoli` or `Listino`) table.
- A `Fatture` table (sometimes split active / passive).
- A `Magazzino` movements table (often missing).
- Per-customer reports (Access Reports) that are NOT migrated — the customer rebuilds them in SmartERP's BI module (Sprint 18 surface).

### 1.4 Known quirks

- Access Memo fields: > 64 KB text, sometimes contain HTML. The importer extracts plain text + warns on non-UTF-8 content.
- Access OLE Object fields (typically embedded images / scanned PDFs): NOT migrated; the migration engineer + customer agree where to relocate the documents (typically the SmartERP `documents` module).
- Date columns: Access stores in OLE Date format (double-precision); the importer converts to ISO 8601.
- Currency columns: Access stores in 4-decimal-place fixed-point. Converted to `cents` (R-D04) with a post-import reconciliation report.
- Access Lookup columns: encoded via foreign keys into name-only Access tables. Resolution map agreed during discovery.

## 2. Pre-migration checklist

| Step | Owner | Evidence |
|---|---|---|
| Module scope agreed | CS owner | signed scope sheet |
| Discovery session: customer walks the engineer through the database schema (1-2h Zoom) | Customer + Engineer | discovery transcript + schema diagram |
| Source freeze window agreed (typical T-day 06:00 to T+1d 18:00) | Customer IT | calendar invite |
| Customer data steward identified | Customer IT | named in scope sheet |
| Sample dataset received (anonymised; `.accdb` minus PII) | Customer IT | `samples/<runbook-id>/<ticket>.accdb` |
| Mapping signed (per-customer; bespoke) | Customer + Engineer | mapping sheet v1 |

## 3. Data export procedure

### 3.1 ODBC bridge

The customer's IT installs the Microsoft Access ODBC driver (already shipped with Microsoft 365). The migration engineer connects from a Windows / Linux jump-host (via Mono / mdbtools on Linux, or Access on Windows) and runs the discovery + extraction script:

```bash
# Linux fallback (mdbtools):
mdb-tables sample.accdb
mdb-export sample.accdb Clienti > clienti.csv
mdb-export sample.accdb Fornitori > fornitori.csv
mdb-export sample.accdb Prodotti > prodotti.csv
mdb-export sample.accdb Fatture > fatture.csv
mdb-export sample.accdb Magazzino > magazzino.csv
```

For per-customer customised table names, the runbook ships a `.json` mapping file that the extraction script reads:

```json
{
  "tables": {
    "Clienti": { "smarterpTarget": "customers" },
    "Fornitori": { "smarterpTarget": "suppliers" },
    "Listino": { "smarterpTarget": "products" },
    "Documenti_Vendita": { "smarterpTarget": "invoices" }
  }
}
```

### 3.2 OLE-Object extraction

Customer-side scripted extraction from Access into a per-row `.zip` of attachments, ingested into SmartERP's `documents` module (out of scope for v1 — typically a follow-up sprint after the cutover).

### 3.3 Validation

```bash
node dist/scripts/migration/M-MS-ACCESS/validate-export.js \
  --input ./uploads/<ticket>/ \
  --mapping ./uploads/<ticket>/mapping.json \
  --report ./uploads/<ticket>/validation-report.json
```

## 4. Mapping

Bespoke per customer. The runbook documents the **discovery template**:

- For each Access table → SmartERP target entity.
- For each Access column → SmartERP column + transform rule (cents conversion, ISO date conversion, lookup resolution).
- For each Access lookup → resolution table (Access table → SmartERP enum).

## 5. Validation

### 5.1 Dry-run report contract

Same shape as the other runbooks. Acceptance: zero `blockers`; anomalies under `5%` (Access data is typically less clean than CSV exports from modern systems).

## 6. Cutover-day checklist

```
T-30d: discovery + sample uploaded + bespoke mapping signed
T-14d: trial migration into staging tenant; commercialista review
T-7d : cutover-day rehearsal in staging; rollback rehearsed
T-1d : final source export; review

T-day Europe/Rome:
  06:00 — Source freeze (customer IT; Access read-only)
  07:00 — Final export from Access per §3.1
  08:00 — Engineer runs validate-export.js
  09:00 — Engineer runs import-mdb.js against the production tenant
  10:00 — Customer-side spot check on 10 sampled documents
  11:00 — Commercialista spot check on IVA + Piano dei Conti overlay
  13:00 — Stock opening + Apertura saldi loaded
  14:00 — Engineer runs post-migration validation report
  15:00 — Customer-side go / no-go
  16:00 — If GO: SmartERP turns on; Access stays read-only
  17:00 — Customer-success closes the cutover ticket
```

## 7. Rollback procedure

The Access `.accdb` is by definition still on the customer's network share. Rollback within 24 h: customer reverts to Access; any data entered in SmartERP since cutover is exported as CSV and the customer decides whether to re-enter it manually into Access (typically not — the migration is one-way).

## 8. Post-migration validation

Same shape as M-EXCEL §8 + extra: at T+30 the customer + commercialista sign off the first IVA liquidation against SmartERP data.

## 9. Sign-off

Same shape as M-TS-LYNFA §9.

## 10. Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-29 | Migration team lead | Initial version (Sprint 23, S23.5). |

## References

- Plan §21.1 — migration source priority list.
- ADR-040 — runbook-per-source-system doctrine.
- mdbtools project (`https://github.com/mdbtools/mdbtools`) — Linux extraction toolkit.
- Microsoft Access Database Engine documentation.
