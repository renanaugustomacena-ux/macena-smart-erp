# M-AR-FATTURAZIONE — Migration runbook: Aruba Fatturazione Elettronica → SmartERP

- **Runbook id**: M-AR-FATTURAZIONE
- **Source vendor**: Aruba S.p.A.
- **Source product**: Fatturazione Elettronica Aruba (SaaS, the "Aruba e-Faturazione" front-end + the "Doc Manager" backend)
- **Source-vendor version coverage**: 2024-2026 SaaS releases.
- **Status**: First-production-cutover-eligible 2026-Q4 (P3 priority per plan §21.1).
- **Engineer owner**: Migration team lead.
- **Customer-success owner**: CS lead Verona.
- **Last reviewed**: 2026-04-29.
- **Plan reference**: §21.1 + ADR-040.

## 1. Source system overview

### 1.1 What it is

Aruba Fatturazione Elettronica is a SaaS focused on FatturaPA emission + reception + Conservazione a Norma (Aruba acts as both the SDI intermediary and the Conservatore — the same vendor on both sides of the chain). Strong distribution in the smallest tier (1-5 employees + studios). Migration appears in the SmartERP cohort when a customer outgrows the e-invoicing-only scope and needs full ERP functionality.

### 1.2 Deployment model

Pure SaaS. Customer logs in at `fatturazioneelettronica.aruba.it`. Data lives in Aruba's cloud; export is via the in-app CSV / FatturaPA bundle export or via the (limited) Aruba API.

### 1.3 Key resources

| Aruba export | Domain | Notes |
|---|---|---|
| `clienti.csv` | Customers | flat CSV; UTF-8. |
| `fornitori.csv` | Suppliers | flat CSV. |
| `articoli.csv` | Products (when the customer used the article catalogue). |
| `fatture-attive.zip` | Bundle of FatturaPA XML envelopes + SDI receipts. |
| `fatture-passive.zip` | Bundle of inbound FatturaPA XML envelopes. |
| `riepilogo-iva.csv` | IVA periodic summary per fiscal year. |

### 1.4 Known quirks

- Aruba's customer-side "Codice Destinatario" is sometimes blank; the importer keeps `0000000` as the default and flags rows for manual review.
- The Aruba bundle includes both the original FatturaPA XML and the per-document SDI receipts (RC, MC, NS, NE, MT, EC); the importer parses the receipts and surfaces the SDI status on the SmartERP `invoices.status` column.
- When a customer's Conservazione is at Aruba (typical), the migration leaves the legacy archive at Aruba per DPCM 3/12/2013 §6 stability requirement; SmartERP routes future versamenti per ADR-016 / ADR-025 (primary = Aruba; secondary = InfoCert at Professionale+).

## 2. Pre-migration checklist

Identical to M-FC-FATTURECLOUD §2 with the Aruba-specific note: confirm whether the customer's Conservazione contract stays at Aruba or migrates (the standard answer is "stays" for the residual retention window).

## 3. Data export procedure

### 3.1 Aruba in-app export

The customer logs in to Aruba Fatturazione, opens "Strumenti → Esportazioni" and generates the 6 files listed in §1.3. The customer ships the bundle via the SmartERP secure-upload portal.

### 3.2 Aruba Doc Manager API (optional)

For Aruba-side automation, the customer-side IT can use the Doc Manager API to script the export. The runbook ships a `pull-aruba.js` utility under `backend/scripts/migration/M-AR-FATTURAZIONE/` that wraps the API calls. Rate-limit-respecting; processes the FatturaPA bundles in chunks.

### 3.3 Validation

```bash
node dist/scripts/migration/M-AR-FATTURAZIONE/validate-export.js \
  --input ./uploads/<ticket>/ \
  --report ./uploads/<ticket>/validation-report.json
```

The validator unzips the FatturaPA bundles + parses each XML envelope + SDI receipt, then reports: duplicate document numbers, mismatches between the CSV summary and the bundle counts, missing IVA Natura on N1..N7 lines.

### 3.4 Staging tenant load

```bash
node dist/scripts/migration/M-AR-FATTURAZIONE/import-aruba.js \
  --tenant <stagingTenantId> \
  --input ./uploads/<ticket>/ \
  --dry-run
```

## 4. Mapping

### 4.1 Customers (`clienti.csv`)

Same shape as M-FC-FATTURECLOUD §4.1 (Aruba's column headers map cleanly onto SmartERP's `customers` columns).

### 4.2 Suppliers (`fornitori.csv`)

Same shape as M-FC-FATTURECLOUD §4.1 + the supplier UUID resolution (M-013 schema).

### 4.3 Products (`articoli.csv`)

Aruba's product catalogue is shallow (most customers don't use it); when present, maps onto `products` per M-FC-FATTURECLOUD §4.2.

### 4.4 Active invoices (`fatture-attive.zip`)

FatturaPA XML envelopes are the source of truth; the importer parses each envelope (re-using the existing `fatturapa-passive-parser.ts` for the inbound side and the active-side renderer for the outbound side) and creates one SmartERP `invoices` row per envelope. SDI receipts → `invoices.status` (`submitted` → `accepted` per RC/MC/NE).

### 4.5 Passive invoices (`fatture-passive.zip`)

FatturaPA XML envelopes parsed via the existing PEC-side parser (Sprint 14 / S14.4); each becomes one SmartERP `supplier_invoices` row. Open AP balances derived from `riepilogo-iva.csv`.

### 4.6 IVA summary (`riepilogo-iva.csv`)

Reconciliation against the per-month IVA-balance projection (S18.2). Discrepancies reported in the dry-run.

### 4.7 Conservazione handover

Legacy archive stays at Aruba for the residual retention window. SmartERP records the per-document `vendorIdAtTimeOfVersamento = 'aruba'` (ADR-016) so future esibizione calls route correctly.

## 5. Validation

### 5.1 Dry-run report contract

Same shape as M-FC-FATTURECLOUD §5.1.

Acceptance: zero `blockers`; anomalies under `2%`.

## 6. Cutover-day checklist

Same shape as M-FC-FATTURECLOUD §6.

## 7. Rollback procedure

The customer's Aruba Fatturazione subscription remains active throughout the migration window. Within 24 h the customer can resume using Aruba directly. After the 24 h window, the customer's plan downgrades to read-only or cancellation per their Aruba contract.

## 8. Post-migration validation

Same shape as M-FC-FATTURECLOUD §8.

## 9. Sign-off

Same shape as M-TS-LYNFA §9.

## 10. Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-29 | Migration team lead | Initial version (Sprint 21, S21.6). |

## References

- Plan §21.1 — migration source priority list.
- ADR-040 — runbook-per-source-system doctrine.
- ADR-016 / ADR-025 — Conservazione adapter (Aruba on both sides of the chain).
- DPCM 3/12/2013 §6 — Conservazione stability requirement.
- Aruba Fatturazione Elettronica documentation (vendor; customer-licensed).
- Aruba Doc Manager API documentation (`docs.arubadocmanager.it`).
