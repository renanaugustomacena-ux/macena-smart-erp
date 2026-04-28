# M-TS-LYNFA — Migration runbook: TeamSystem Lynfa → SmartERP

- **Runbook id**: M-TS-LYNFA
- **Source vendor**: TeamSystem S.p.A.
- **Source product**: Lynfa Azienda (and the Lynfa cassette suite)
- **Source-vendor version coverage**: Lynfa 2024.x and 2025.x. Pre-2024 deployments use a separate runbook tail (see §1.5).
- **Status**: First-production-cutover-eligible 2026-Q3.
- **Engineer owner**: Migration team lead.
- **Customer-success owner**: CS lead Verona.
- **Last reviewed**: 2026-04-28.
- **Plan reference**: §21.1 + ADR-040.

## 1. Source system overview

### 1.1 What Lynfa is

TeamSystem Lynfa is an on-premise (Windows / SQL Server) ERP designed for Italian SMEs in manufacturing, distribution, and services. Customer base in Veneto and Lombardia is concentrated; in the SmartERP buyer cohort it is the most common source system after Excel.

### 1.2 Deployment model

- Server-side: Windows Server (2019/2022) + SQL Server 2019/2022 Standard.
- Client-side: Lynfa client installed on Windows desktops; some customers also run the Lynfa Web interface.
- Data-storage: SQL Server database `LynfaDB_<cliente>` per installation.
- Backup: customer-managed, typically a nightly `.bak` file on a NAS or rotated to tape.

### 1.3 Key tables (Lynfa schema)

| Lynfa table | Domain | Notes |
|---|---|---|
| `ANAGRAFICHE` | Customers + suppliers (single table; discriminator column `TIPO_ANAGR`). | Often contains stale rows. |
| `ARTICOLI` | Products / Articoli | Includes UM, codice EAN, inventory category. |
| `MOVIMENTI_MAGAZZINO` | Stock movements | Per-warehouse, per-article. |
| `DOCUMENTI` | Sales orders, DDTs, invoices (head). | Discriminator column `TIPO_DOCUMENTO`. |
| `RIGHE_DOCUMENTO` | Document lines. | One row per article/quantity. |
| `IVA` | IVA codes + Natura mapping. | Lynfa's mapping does not always match AdE TD codes. |
| `PIANO_CONTI` | Chart of accounts. | Usually customer-customised; deviates from IV Direttiva CEE template. |
| `DIPENDENTI` | Employees (when payroll module present). | HR-lite scope. |
| `PRESENZE` | Daily presence records. | When payroll module present. |

### 1.4 Known quirks

- `IVA.NATURA` codes are sometimes cleared on rows older than 5 years.
- `ANAGRAFICHE.PARTITAIVA` is occasionally stored without leading zeros; the migration normalises to 11-character zero-padded.
- `DOCUMENTI.NUMERO_DOC` resets per fiscal year but the customer's data steward sometimes uses a single rolling counter for internal documents — the import script handles both with a per-fiscal-year unique key fallback.
- Codice destinatario SDI is sometimes stored in the customer's free-text `NOTE` column rather than a dedicated field; the runbook flags these for manual review.
- Lynfa's "Conto Lavorazione" DDTs use causale `99` (vendor-specific) which maps to SmartERP `causaleTrasporto = conto_lavorazione`.

### 1.5 Pre-2024 Lynfa versions

Deployments running Lynfa 2022 or earlier are covered by an **extended export procedure** under §3.5: the customer's Lynfa support contract is required to obtain the export utility, and the customer engages SmartERP migration on a time-and-materials line item.

## 2. Pre-migration checklist

| Step | Owner | Evidence |
|---|---|---|
| Module scope agreed (sales / purchase / inventory / accounting / HR-lite) | CS owner | signed scope sheet |
| Source freeze window agreed (typical: T-day 06:00 - T+1d 18:00) | Customer IT | calendar invite |
| Customer data steward identified | Customer IT | named in scope sheet |
| Commercialista (Andrea-equivalent) introduced | CS owner | introduction email |
| Sample dataset received (anonymised, 1-month slice) | Customer IT | `samples/<runbook-id>/<ticket>.zip` |
| Mapping signed (Customers + Products + Invoices) | Customer + Engineer | mapping sheet v1 |
| Conservazione plan agreed (legacy invoices stay at the source's Conservatore for the residual retention window) | Engineer | ADR-016 reference |

## 3. Data export procedure

### 3.1 Direct SQL Server export (Lynfa 2024.x and 2025.x)

The customer's IT runs the SQL extraction script we ship under `backend/scripts/migration/M-TS-LYNFA/export-lynfa.sql`. The script produces eight CSVs in UTF-8:

```
lynfa_anagrafiche.csv
lynfa_articoli.csv
lynfa_movimenti_magazzino.csv
lynfa_documenti.csv
lynfa_righe_documento.csv
lynfa_iva.csv
lynfa_piano_conti.csv
lynfa_dipendenti.csv      (only if HR-lite module is in scope)
```

Steps:

1. The customer connects to the Lynfa SQL Server instance with a read-only login.
2. The customer runs `sqlcmd -S <server> -U <readonly_user> -d <LynfaDB> -i export-lynfa.sql -o export-summary.txt`.
3. Output CSVs land in the working directory; the customer ships them to SmartERP via the secure-upload portal.

### 3.2 FatturaPA legacy bundle (parallel)

The customer also exports the Conservazione bundle for the last 5 fiscal years from their existing Conservatore (typically TeamSystem Conservazione or Aruba). This bundle is **not imported into SmartERP** — it stays at the original Conservatore for the residual retention window per DPCM 3/12/2013 §6 stability. We surface read-only URLs in the SmartERP UI through the ConservazioneRegistry (ADR-016) so an audit-time esibizione succeeds against the original vendor.

### 3.3 Validation of the export

The migration engineer runs `backend/scripts/migration/M-TS-LYNFA/validate-export.ts` against the uploaded CSVs:

```bash
node dist/scripts/migration/M-TS-LYNFA/validate-export.js \
  --input ./uploads/<ticket>/ \
  --report ./uploads/<ticket>/validation-report.json
```

The report flags:
- rows with missing mandatory fields,
- character-encoding anomalies (Lynfa sometimes emits ANSI rather than UTF-8),
- partita IVA + codice fiscale validity (checksum),
- IVA-code rows whose Natura column is inconsistent with the line type.

### 3.4 Staging tenant load

The migration engineer creates a staging tenant in `staging.smarterp.it`, then runs:

```bash
node dist/scripts/migration/M-TS-LYNFA/import-lynfa.js \
  --tenant <stagingTenantId> \
  --input ./uploads/<ticket>/ \
  --dry-run
```

The dry-run produces a structured report (see §5).

### 3.5 Pre-2024 Lynfa fallback

For Lynfa 2022 and earlier, the customer engages TeamSystem support to run the **legacy export utility** (Lynfa-side menu `Strumenti → Esportazione dati`). The utility produces an XML bundle the migration engineer transforms with `backend/scripts/migration/M-TS-LYNFA/legacy-xml-to-csv.ts` before resuming at §3.3.

## 4. Mapping

### 4.1 Customer (`ANAGRAFICHE` where `TIPO_ANAGR='C'`)

| Lynfa column | SmartERP `customers` field | Notes |
|---|---|---|
| `CODICE` | `code` | unique per tenant; preserved 1:1. |
| `RAG_SOC` | `name` | uppercased and trimmed. |
| `PARTITAIVA` | `vatNumber` | zero-padded to 11 chars; LOSSY only when source-side blank. |
| `CODFISC` | `fiscalCode` | as-is. |
| `INDIRIZZO` / `CAP` / `CITTA` / `PROV` / `NAZIONE` | `address`, `postalCode`, `city`, `province`, `country` | as-is; `country` defaults to `IT` when blank. |
| `EMAIL_PEC` | `pecEmail` | as-is. |
| `EMAIL` | `email` | as-is. |
| `TELEFONO` | `phone` | as-is. |
| `COD_DEST_SDI` | `sdiDestinationCode` | LOSSY: when blank, defaults to `0000000` and writes a flag in `notes` for manual review. |
| `COND_PAGAMENTO_GG` | `paymentTermsDays` | as-is. |
| `IVA_DEFAULT_PCT` | `defaultIvaRate` | as-is. |

### 4.2 Supplier (`ANAGRAFICHE` where `TIPO_ANAGR='F'`)

Maps to the SmartERP `suppliers` master-data fact (UUID-only in M-013 schema; full anagrafica deferred to procurement Phase B). The migration creates the supplier UUID and stores the legacy code in `notes.legacyLynfaCode` for backward reference.

### 4.3 Product (`ARTICOLI`)

| Lynfa column | SmartERP `products` field | Notes |
|---|---|---|
| `CODICE_ART` | `sku` | unique per tenant. |
| `DESCRIZIONE` | `description` | trimmed. |
| `UM` | `unitOfMeasure` | enum-mapped (`pz` / `kg` / `m` / `l` / `h`). |
| `CATEGORIA` | `categoryCode` | as-is. |
| `EAN` | `barcode` | as-is. |
| `IVA_PCT` | `defaultIvaRate` | as-is. |
| `NC8` | `intrastatNc8` | when present. |
| `MASSA_NETTA` | `netMassKg` | when present. |
| `PAESE_ORIGINE` | `countryOfOrigin` | when present. |

### 4.4 Sales documents (`DOCUMENTI` where `TIPO_DOCUMENTO IN ('OC','DDT','FT')`)

- `OC` → `sales_orders`
- `DDT` → `ddts`
- `FT` (active invoice) → `invoices` with `documentType = TD01`

The mapping preserves `NUMERO_DOC` + `ANNO` as `(number, fiscalYear)` and the `RIGHE_DOCUMENTO` rows become the per-document line items. **LOSSY**: any line where `IVA_CODICE` references a Lynfa-only IVA code without a clean AdE-Natura mapping is flagged in the dry-run report; the customer's commercialista signs off the manual remap before cutover.

### 4.5 Inventory (`MOVIMENTI_MAGAZZINO`)

Stock movements from the cutover-day-1 opening balance forward are imported. Historical movements > 5 years are **dropped** (the source remains read-only available; M-TS-LYNFA does not pull the full history into SmartERP to keep the cutover-day cost-bounded).

### 4.6 Chart of accounts (`PIANO_CONTI`)

Lynfa's customised Piano dei Conti is **mapped onto** the SmartERP IV Direttiva CEE seed — the migration engineer + the commercialista agree the per-customer overlay before cutover. **LOSSY** when the source uses non-IV-CEE codes; the mapping is preserved in `chart_of_accounts.legacyMappingNotes`.

### 4.7 HR-lite (`DIPENDENTI` + `PRESENZE`)

Maps onto the SmartERP HR-lite entities (see plan §31.1 Sprint 17 / S17.1..S17.3): `Employee`, `Attendance`. CCNL inferred from the `TIPO_CCNL` column where present; otherwise the migration engineer sets it during the staging-tenant load.

### 4.8 Open AR / AP

Open invoices and supplier-invoice balances at cutover-eve are loaded into SmartERP as **opening balances** (a prima-nota row per partner with the residual amount). The legacy invoice itself remains visible in the Conservazione registry for audit.

## 5. Validation

### 5.1 Dry-run report contract

`POST /api/migration/dry-run` (M-TS-LYNFA mode) returns:

```jsonc
{
  "runbookId": "M-TS-LYNFA",
  "stagingTenantId": "<uuid>",
  "summary": {
    "customersImported":  120,
    "customersSkipped":   2,
    "productsImported":   480,
    "productsSkipped":    11,
    "salesOrdersImported": 320,
    "ddtsImported":       290,
    "invoicesImported":   280,
    "stockOpeningRows":   480,
    "openARRows":         15,
    "openAPRows":         9
  },
  "anomalies": [
    { "kind": "missing_partita_iva",  "rowCount": 2 },
    { "kind": "missing_codice_destinatario", "rowCount": 8 },
    { "kind": "iva_natura_mismatch",  "rowCount": 5 },
    { "kind": "non_iv_cee_account",   "rowCount": 3 }
  ],
  "blockers": []
}
```

Acceptance: zero `blockers`; anomalies under `5%` of the row count of their parent table.

### 5.2 Sample-customer sign-off

The customer reviews 5 randomly-sampled customers + 5 sales documents in the staging tenant and confirms the imported values. The commercialista reviews 5 invoices for IVA-natura correctness.

## 6. Cutover-day checklist

```
T-30d: scope + sample uploaded + mapping v1 signed
T-14d: trial migration into staging tenant; commercialista review
T-7d : cutover-day rehearsal in staging; rollback rehearsed
T-1d : final source export; review

T-day Europe/Rome:
  06:00 — Source freeze (customer IT; no new data in Lynfa)
  07:00 — Final export from Lynfa per §3.1
  08:00 — Engineer uploads CSVs; runs validate-export.ts
  09:00 — Engineer runs import-lynfa.ts against the production tenant
  10:00 — Customer-side spot check on 10 sampled documents
  11:00 — Commercialista spot check on IVA + prima-nota
  12:00 — Lunch (no migrations)
  13:00 — Open AR/AP + opening balances loaded
  14:00 — Stock opening reconciled with the customer's data steward
  15:00 — Engineer runs post-migration validation report
  16:00 — Customer-side go / no-go
  17:00 — If GO: SmartERP turns on for the customer's users; Lynfa stays read-only
  17:30 — Customer-success closes the cutover ticket; sign-off PDFs collected
  18:00 — Cutover complete
```

A no-go at 16:00 triggers the rollback procedure (§7).

## 7. Rollback procedure

Within 24 hours of cutover, the customer can roll back to Lynfa:

1. SmartERP team de-activates the customer's tenant (`tenant.status = 'cancelled'`); the Conservazione vendor is informed not to start archiving new versamenti for the tenant.
2. The customer's Lynfa instance is unfrozen by the customer's IT.
3. Any data entered in SmartERP between cutover and rollback is exported into a CSV and handed to the customer's IT for re-entry into Lynfa (manual; no automated re-import).
4. SmartERP team writes a rollback post-mortem (root cause + lesson learned).

The 24-hour window is hard. After 24h the rollback path requires the more expensive "T+30 reverse migration" — not part of this runbook.

## 8. Post-migration validation

T+1 day: data-integrity report (count parity per entity table; sum parity for invoice totals).

T+7 days: customer's data steward signs the count + sum parity report (PDF stored under `signoff/<ticket>/T+7d.pdf`).

T+30 days: commercialista signs the first IVA liquidation against SmartERP data (PDF stored under `signoff/<ticket>/T+30d-iva.pdf`).

## 9. Sign-off

Customer + commercialista + SmartERP engineer signatures are stored in the customer's CRM record. A copy of the runbook PDF (this file rendered with the customer's specifics filled in) is attached.

## 10. Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-28 | Migration team lead | Initial version (Sprint 17, S17.5). Covers Lynfa 2024.x + 2025.x; pre-2024 fallback flagged. |

## References

- Plan §21.1 — migration source priority list.
- ADR-040 — runbook-per-source doctrine.
- ADR-016 — Conservazione adapter (legacy invoices stay at the source vendor).
- DPCM 3/12/2013 §6 — Conservazione stability.
- TeamSystem Lynfa documentation (vendor-side; customer-licensed).
