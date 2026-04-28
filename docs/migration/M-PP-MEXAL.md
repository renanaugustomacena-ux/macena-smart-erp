# M-PP-MEXAL — Migration runbook: Passepartout Mexal → SmartERP

- **Runbook id**: M-PP-MEXAL
- **Source vendor**: Passepartout S.p.A.
- **Source product**: Mexal (and the Mexal HUB cloud add-on)
- **Source-vendor version coverage**: Mexal 2024, 2025, 2026 release lines.
- **Status**: First-production-cutover-eligible 2026-Q4 (per plan §21.1 priority P2).
- **Engineer owner**: Migration team lead.
- **Customer-success owner**: CS lead Verona.
- **Last reviewed**: 2026-04-29.
- **Plan reference**: §21.1 + ADR-040.

## 1. Source system overview

### 1.1 What Mexal is

Passepartout Mexal is one of the three dominant on-premise gestionali in the Italian commercialista channel (alongside TeamSystem Lynfa and Zucchetti Ad Hoc). Strong distribution among studi commercialisti — every cohort of Verona/Veneto manifatturiere ICPs we onboard has at least one customer who runs Mexal because their commercialista does. The data model is rich (full Italian fiscal logic native) but the vendor's export tooling is intentionally minimal — extracting bulk data goes through the ASCII-export module (`ESPORTAZIONE TESTO` from the Mexal CLI menu) or via the per-licence Mexal HUB API.

### 1.2 Deployment model

- Server-side: Windows Server (rare) / Linux + Sprix runtime (most installations) backed by the Passepartout Database Manager.
- Client-side: Mexal client (Win32) + Mexal Web (browser thin client, 2023+).
- Mexal HUB (cloud add-on, opt-in): mirrors a subset of the on-prem data into the Passepartout cloud and exposes a REST API for partners.

### 1.3 Key Mexal entities

| Mexal label | Domain | Notes |
|---|---|---|
| `RUBRICA CLIENTI E FORNITORI` | Customers + suppliers (single rubrica) | discriminator on tipo. |
| `ANAGRAFICA ARTICOLI` | Articoli / Products | UM, codice EAN, lotto/seriale flag. |
| `MAGAZZINO MOVIMENTI` | Stock movements | per-magazzino, per-articolo. |
| `DOCUMENTI ESTERI` (DE) / `DOCUMENTI EMESSI` (DI) | Sales / purchase documents | discriminated by tipo (FT, NC, OC, BC, DDT). |
| `RIGHE DI DOCUMENTO` | Document lines | one row per articolo + qta. |
| `IVA` | IVA codes | Mexal's IVA → SmartERP Natura mapping is mostly clean. |
| `PIANO CONTI` | Chart of accounts | usually customised per studio. |
| `DIPENDENTI` | Employees (when payroll module present) | Passepartout's payroll module is widely paired. |

### 1.4 Known quirks

- Mexal stores partita IVA without country prefix (`IT` is implicit). The migration zero-pads to 11 chars and prefixes `IT` only when used in INTRA-1bis exports.
- DDT causale is a 2-digit code from a fixed dictionary; the importer ships a code → SmartERP `causaleTrasporto` map.
- Mexal Sprix prints CSV with a non-standard delimiter `|@|` to disambiguate fields containing semicolons; the importer auto-detects.
- Mexal HUB API rate limit is 50 req/min/licence; the puller paces.
- For multi-azienda installations, each "azienda Mexal" must be exported separately and mapped onto a SmartERP tenant or a tenant + multi-company sub-entity (decided at scope-sign-off).

## 2. Pre-migration checklist

| Step | Owner | Evidence |
|---|---|---|
| Module scope agreed (sales / purchase / inventory / accounting / HR-lite) | CS owner | signed scope sheet |
| Source freeze window agreed (typical T-day 06:00 to T+1d 18:00) | Customer IT | calendar invite |
| Customer data steward identified | Customer IT | named in scope sheet |
| Commercialista (Andrea-equivalent) introduced | CS owner | introduction email |
| Sample dataset received (anonymised, 1-month slice via Sprix or HUB) | Customer IT | `samples/<runbook-id>/<ticket>.zip` |
| Mexal HUB licence verified (if API path chosen) | Customer IT + Engineer | HUB credentials test ping |
| Mapping signed (Customers + Products + Invoices + Piano Conti) | Customer + Engineer | mapping sheet v1 |
| Conservazione plan agreed (legacy invoices stay at the source's Conservatore) | Engineer | ADR-016 reference |

## 3. Data export procedure

### 3.1 Sprix-based ASCII export (default path)

The customer's IT runs the Sprix script `backend/scripts/migration/M-PP-MEXAL/export-mexal.sx` from the Mexal CLI under the customer's azienda. Output: 8 pipe-delimited text files in UTF-8:

```
mexal_rubrica.txt
mexal_articoli.txt
mexal_movimenti.txt
mexal_documenti.txt
mexal_righe_documento.txt
mexal_iva.txt
mexal_piano_conti.txt
mexal_dipendenti.txt   (only if HR-lite in scope)
```

The Sprix script ships with the runbook and is reviewed quarterly against the latest Mexal release.

### 3.2 Mexal HUB REST export (opt-in path)

For customers with Mexal HUB licences, the engineer runs:

```bash
node dist/scripts/migration/M-PP-MEXAL/pull-hub.js \
  --token <env:MEXAL_HUB_TOKEN> \
  --licence <licence-key> \
  --azienda <codice-azienda> \
  --output ./uploads/<ticket>/
```

The puller respects the 50 req/min rate limit and emits the same 8 files as the Sprix path so the downstream pipeline is identical.

### 3.3 Validation

```bash
node dist/scripts/migration/M-PP-MEXAL/validate-export.js \
  --input ./uploads/<ticket>/ \
  --report ./uploads/<ticket>/validation-report.json
```

The validator checks: pipe-delimiter consistency, partita IVA + codice fiscale checksums, IVA-code mapping completeness (every Mexal IVA code must resolve to a known AdE Natura when applicable), DDT causale-code mapping completeness.

### 3.4 Staging tenant load

```bash
node dist/scripts/migration/M-PP-MEXAL/import-mexal.js \
  --tenant <stagingTenantId> \
  --input ./uploads/<ticket>/ \
  --dry-run
```

Produces the dry-run report (§5).

## 4. Mapping

### 4.1 Customers (`mexal_rubrica.txt` where tipo='C')

Identical structure to M-TS-LYNFA §4.1 customer mapping. The Mexal-specific differences:

- Mexal uses a 6-digit numeric code (`COD_RUBR`); SmartERP preserves it as `customers.code` zero-padded to the same width (`000123`).
- Mexal's `LOC_BANCA_PRIN` (banca principale) is mapped onto `customers.notes.legacyMexalBankCode` for reference; the migration does not propagate it into SmartERP's Treasury (Sprint 23 scope).

### 4.2 Suppliers (`mexal_rubrica.txt` where tipo='F')

Same shape as M-TS-LYNFA §4.2.

### 4.3 Products (`mexal_articoli.txt`)

Mexal stores a finer-grained UM enum (24 codes) than SmartERP's default 8-code set; the importer ships a translation table covering the most common codes (`PZ`, `KG`, `MT`, `LT`, `H`, `CONF`, `BOX`, `ROT`). Out-of-table codes default to `pz` and emit a warning in the dry-run report for manual review.

### 4.4 Sales documents (`mexal_documenti.txt`)

| Mexal `TIPO_DOC` | SmartERP target |
|---|---|
| `OC` (ordine cliente) | `sales_orders` |
| `BC` (bolla di consegna ↔ DDT) | `ddts` |
| `DDT` (DDT) | `ddts` |
| `FT` (fattura attiva) | `invoices` (TD01) |
| `NC` (nota di credito) | `invoices` (TD04) |
| `RF` (ricevuta fiscale) | `invoices` (TD24/TD27 per AdE table) — flagged in dry-run for commercialista review |

Lines from `mexal_righe_documento.txt` map onto the per-document line items. Mexal's `IVA_CODICE` → AdE Natura mapping ships in `backend/scripts/migration/M-PP-MEXAL/iva-mapping.json` (38 entries; reviewed quarterly).

### 4.5 Purchase documents

Mexal's purchase side (`DI` = documento interno passivo) maps onto SmartERP `supplier_invoices` (TD16/TD17/TD18 per regime). Same Sprix delimiter quirk applies.

### 4.6 Inventory (`mexal_movimenti.txt`)

Stock movements from cutover-eve forward are imported as opening balance + per-movement rows. Historical movements > 5 years are dropped (same policy as M-TS-LYNFA §4.5).

### 4.7 Chart of accounts (`mexal_piano_conti.txt`)

Mexal's Piano dei Conti is more granular than the SmartERP IV Direttiva CEE seed — typically 4-5 levels deep vs. the seed's 3. The migration engineer + commercialista agree on a per-customer overlay before cutover; LOSSY mappings are preserved in `chart_of_accounts.legacyMappingNotes`.

### 4.8 HR-lite (`mexal_dipendenti.txt`)

Maps onto the SmartERP HR-lite entities (Sprint 17 scope). CCNL inferred from `TIPO_CCNL` (when present) or set during the staging load.

### 4.9 Open AR / AP

Same handling as M-TS-LYNFA §4.8 — opening balances per partner.

## 5. Validation

### 5.1 Dry-run report contract

Same shape as M-TS-LYNFA §5.1 with `runbookId = "M-PP-MEXAL"`.

Acceptance: zero `blockers`; anomalies under `5%` of the row count of their parent table. The Piano dei Conti remap is the most common anomaly source — the commercialista signs off the overlay before cutover.

### 5.2 Sample-customer sign-off

Same as M-TS-LYNFA §5.2.

## 6. Cutover-day checklist

```
T-30d: scope + sample uploaded + mapping v1 signed
T-14d: trial migration into staging tenant; commercialista review
T-7d : cutover-day rehearsal in staging; rollback rehearsed
T-1d : final source export; review

T-day Europe/Rome:
  06:00 — Source freeze (customer IT; no new data in Mexal)
  07:00 — Final export from Mexal per §3.1 (Sprix) or §3.2 (HUB)
  08:00 — Engineer uploads files + runs validate-export.js
  09:00 — Engineer runs import-mexal.js against the production tenant
  10:00 — Customer-side spot check on 10 sampled documents
  11:00 — Commercialista spot check on IVA + Piano dei Conti overlay
  12:00 — Lunch
  13:00 — Open AR/AP + opening balances loaded
  14:00 — Stock opening reconciled with the customer's data steward
  15:00 — Engineer runs post-migration validation report
  16:00 — Customer-side go / no-go
  17:00 — If GO: SmartERP turns on; Mexal stays read-only for the residual retention window
  17:30 — Customer-success closes the cutover ticket; sign-off PDFs collected
  18:00 — Cutover complete
```

A no-go at 16:00 triggers the rollback procedure.

## 7. Rollback procedure

Same shape as M-TS-LYNFA §7. The 24-hour window applies; after that, the migration is considered complete and rollback requires the more expensive "T+30 reverse migration".

## 8. Post-migration validation

Same shape as M-TS-LYNFA §8.

## 9. Sign-off

Customer + commercialista + SmartERP engineer signatures stored in the customer's CRM record. A copy of this runbook PDF (rendered with the customer's specifics filled in) is attached.

## 10. Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-29 | Migration team lead | Initial version (Sprint 19, S19.6). Covers Mexal 2024/2025/2026; both Sprix and HUB export paths supported. |

## References

- Plan §21.1 — migration source priority list.
- ADR-040 — runbook-per-source-system doctrine.
- ADR-016 — Conservazione adapter (legacy invoices stay at the source vendor).
- Passepartout Mexal documentation (vendor-licensed; customer access required).
- Passepartout HUB API spec (`hub.passepartout.cloud/docs`).
- DPCM 3/12/2013 §6 — Conservazione stability requirement (relevant for the residual retention window post-cutover).
