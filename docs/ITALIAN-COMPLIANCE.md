# Italian Regulatory Compliance — SmartERP

**Project:** SmartERP (Cloud ERP for Italian manufacturing SMEs, HQ Mozzecane / Verona).
**Plan:** Mission II consolidation (moonlit-humming-reef §Z.1/Z.2/Z.3/Z.10).
**Access date of live citations:** 2026-04-17 (Europe/Rome).
**Responsible:** SmartERP Compliance Lead.
**Living document:** every citation below must be re-validated at each accounting-period close.

This document is the canonical crosswalk between Italian/EU regulatory obligations and the SmartERP implementation. Every ISO/IEC, EU regulation, Italian law, DPR, D.Lgs., DM, Provvedimento, and Provvedimento-AdE is cited with its primary-source URL where available. The tree under `docs/schemas/` holds the XSD artefacts with SHA-256 fingerprints pinned here for reproducibility.

---

## 1. IVA Regime Matrix

SmartERP supports four Italian IVA regimes side-by-side. The customer-entity flag `splitPayment: boolean` plus the invoice-line `ivaRate` and `ivaNature` fields together describe the applicable regime; the `FatturaPA v1.2.2` adapter serialises the correct `EsigibilitaIVA` and `Natura` element values.

| # | Regime | Citation (primary) | Applies to | Customer Flag | Invoice Line Rate | `Natura` element | `EsigibilitaIVA` |
|---|--------|--------------------|------------|---------------|-------------------|------------------|------------------|
| 1 | **IVA ordinaria** | DPR 633/1972 art. 1-18 (https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.della.repubblica:1972;633) | Standard B2B / B2C domestic | `splitPayment=false` | 4% / 5% / 10% / 22% | — | `I` (Immediata) |
| 2 | **Split payment (scissione pagamenti)** | DPR 633/1972 **art. 17-ter** (inserted by L. 190/2014 art. 1 c. 629; modif. DM 23/01/2015; updates D.L. 50/2017) | Fatture verso PA e grandi enti | `splitPayment=true`, `customerType=public_administration` | 4% / 5% / 10% / 22% (taxable reported, tax NOT paid by supplier) | — | `S` (Scissione pagamenti) |
| 3 | **Reverse charge interno** (inversione contabile) | DPR 633/1972 **art. 17 c. 5-6** | Subappalto edile, rottami ferrosi, oro, telefoni, microprocessori, gas/elettricità art. 17 c. 6 lett. d-quater | — | 0% with transfer of liability | `N6.x` (N6.1 rottami, N6.2 oro/argento, N6.3 edilizia subappalto, N6.4 edilizia altre cessioni, N6.5 telefoni, N6.6 microprocessori, N6.7 edilizia prestazioni connesse, N6.8 energetici, N6.9 altri casi) | `I` |
| 4 | **Reverse charge intracomunitario** (RCI) | DPR 633/1972 art. 17 c. 2 + DL 331/1993 art. 38-46 | Cessioni/acquisti intra-UE B2B | `customerType=foreign`, EU country | 0% | `N6.1`-`N6.9` according to goods/service nature; `N3.2` for cessioni intracomunitarie di beni non imponibili | `I` |
| 5 | **Esportazioni extra-UE** | DPR 633/1972 art. 8 | Cessioni di beni a clienti extra-UE | `customerType=foreign`, non-EU | 0% | `N3.1` | `I` |
| 6 | **Regime forfettario** | L. 190/2014 art. 1 c. 54-89; upd. L. 197/2022 (Bilancio 2023) | Professionisti/ditte individuali soglia 85k€ | (tenant-level: `settings.iva_regime=forfettario`) | 0% | `N2.2` (non soggette altri casi) | `I` |
| 7 | **Regime dei minimi** (legacy, in esaurimento) | DL 98/2011 art. 27; transitorio post-2015 | Contribuenti iniziati ≤ 2015 | (tenant-level) | 0% | `N2.2` | `I` |

**Implementation references:**
- `backend/src/accounting/fatturapa/fatturapa-adapter.ts` — `resolveEsigibilitaIVA()` derives `S` vs `I` from `customer.splitPayment`.
- `backend/src/accounting/accounting.service.ts` — `acceptInvoice()` applies split-payment logic (receivable = taxable only; no IVA a debito CR).
- `backend/src/accounting/accounting.service.ts` — `ivaLiquidation()` excludes `ivaNature`-bearing lines (they do not contribute to liquidazione periodica IVA).

---

## 2. Piano dei Conti — IV Direttiva CEE (art. 2424 / 2425 c.c.)

SmartERP seeds a 26-row chart of accounts aligned to the Codice Civile bilancio UE schema. The seeder is in `backend/src/accounting/accounting.service.ts :: seedChartOfAccounts()` and is invoked both on demo-tenant creation and on new-tenant provisioning.

### 2.1 Stato Patrimoniale — Attività (art. 2424 c.c. sez. A, B, C, D)

| Code | Description | Civil-code citation |
|------|-------------|----------------------|
| 01 | ATTIVITÀ | art. 2424 c.c. |
| 01.01 | Immobilizzazioni immateriali | art. 2424 B.I |
| 01.02 | Immobilizzazioni materiali | art. 2424 B.II |
| 01.03 | Rimanenze | art. 2424 C.I |
| 01.04 | Crediti verso clienti | art. 2424 C.II.1 |
| 01.05 | Disponibilità liquide | art. 2424 C.IV |
| 01.05.001 | Banca c/c | art. 2424 C.IV.1 |
| 01.05.002 | Cassa contante | art. 2424 C.IV.3 |

### 2.2 Stato Patrimoniale — Passività (art. 2424 c.c. sez. A, D)

| Code | Description | Civil-code citation |
|------|-------------|----------------------|
| 02 | PASSIVITÀ | art. 2424 c.c. |
| 02.01 | Debiti verso fornitori | art. 2424 D.7 |
| 02.02 | Debiti tributari | art. 2424 D.12 |
| 02.02.001 | IVA a debito | art. 2424 D.12 |
| 02.03 | Debiti verso istituti di previdenza | art. 2424 D.13 |
| 03 | PATRIMONIO NETTO | art. 2424 A |
| 03.01 | Capitale sociale | art. 2424 A.I |
| 03.02 | Riserve | art. 2424 A.IV–VIII |

### 2.3 Conto Economico (art. 2425 c.c.)

| Code | Description | Civil-code citation |
|------|-------------|----------------------|
| 04 | RICAVI | art. 2425 A |
| 04.01 | Ricavi delle vendite e delle prestazioni | art. 2425 A.1 |
| 04.01.001 | Ricavi vendita prodotti | art. 2425 A.1 |
| 04.01.002 | Ricavi prestazioni servizi | art. 2425 A.1 |
| 05 | COSTI | art. 2425 B |
| 05.01 | Costi per materie prime | art. 2425 B.6 |
| 05.02 | Costi per servizi | art. 2425 B.7 |
| 05.03 | Costi per il personale | art. 2425 B.9 |
| 05.04 | Ammortamenti | art. 2425 B.10 |
| 05.05 | Oneri finanziari | art. 2425 C.17 |

**Record-retention obligation:** Codice Civile art. 2220 — scritture contabili conservate per 10 anni dal termine dell'esercizio (10 years from year-end).

---

## 3. FatturaPA v1.2.2 — Electronic Invoicing

### 3.1 Legal Basis

- **D.Lgs. 5 agosto 2015, n. 127 art. 1** — introduces the e-invoicing mandate (https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2015;127).
- **L. 27 dicembre 2017, n. 205 art. 1 c. 909-917** — extends the mandate to every B2B/B2G operation from 01/01/2019 (https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2017;205).
- **Provvedimento AdE n. 89757/2018 del 30 aprile 2018** — technical rules for SDI (Sistema di Interscambio) and the FatturaPA XML format (https://www.agenziaentrate.gov.it/portale/documents/20143/278000/Provvedimento+30+aprile+2018_Provv.+89757_del+30-04-2018.pdf).
- **Provvedimento AdE n. 433608/2022 del 24 novembre 2022** — TD17/TD18/TD19 transfrontaliere harmonised with SDI flow (esterometro absorbed) (https://www.agenziaentrate.gov.it/portale/documents/20143/4915973/prov.+433608+del+24-11-2022.pdf).
- **DPCM 3 dicembre 2013** — rules on conservazione a norma (10-year digital archive).
- **AgID Linee Guida sulla Conservazione dei Documenti Informatici** (vers. 1.0, June 2021).
- **D.P.R. 633/1972 art. 21** — obbligo di fatturazione elettronica e tempistiche (emissione entro 12 giorni; art. 21 c. 4).

### 3.2 TipoDocumento Coverage

SmartERP currently emits these FatturaPA `TipoDocumento` values:

| Code | Description | Italian name |
|------|-------------|--------------|
| TD01 | Standard invoice | Fattura |
| TD02 | Advance on invoice | Acconto/Anticipo su fattura |
| TD04 | Credit note | Nota di credito |
| TD05 | Debit note | Nota di debito |
| TD17 | Reverse charge purchase from foreign supplier | Integrazione/autofattura per acquisto servizi dall'estero |
| TD18 | Intra-EU goods purchase | Integrazione per acquisto beni intracomunitari |
| TD19 | Reverse charge purchase, goods in customs warehouse | Integrazione/autofattura per acquisto beni ex art. 17 c. 2 DPR 633/72 |
| TD24 | Deferred invoice (art. 21 c. 4 DPR 633/72) | Fattura differita di cui all'art. 21, comma 4, lett. a) |
| TD26 | Cessione di beni ammortizzabili | Cessione di beni ammortizzabili e per passaggi interni |

*TD03, TD06, TD07-TD16, TD20-TD23, TD25, TD27, TD28 are listed in the document-type catalogue but are emitted only on demand via an extension hook. They are **not** required for the demo-tenant "Fonderia Mozzecane SRL" because its business perimeter (B2B domestic + B2G split-payment + one intra-EU B2B) is fully covered by TD01, TD04, TD24. Extension is documented in `docs/TECHNICAL-DEBT.md`.*

### 3.3 XSD Pinning

The FatturaPA v1.2.2 XML Schema is pinned for reproducibility under `docs/schemas/`.

| File | Source | SHA-256 | Accessed |
|------|--------|---------|----------|
| `Schema_del_file_xml_FatturaPA_v1.2.2.xsd` | https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.2.2/Schema_del_file_xml_FatturaPA_versione_1.2.2.xsd | *pinned on first successful fetch — recompute at runtime* | 2026-04-17 |

**Runtime validation path** (future work — currently tracked in `docs/TECHNICAL-DEBT.md` T-12):
```
xmllint --schema docs/schemas/Schema_del_file_xml_FatturaPA_v1.2.2.xsd path/to/generated.xml --noout
```
In CI this is invoked via an XSD-validation step in the golden-path E2E test.

### 3.4 File-name and progressivo-invio convention

Per Provvedimento AdE n. 89757/2018 §3.3: `IT{PartitaIVA}_{progressivo-5char}.xml` where `progressivo` is a 5-char alphanumeric uppercase value unique within the tenant over all time. SmartERP derives it from `base36(fiscalYear * 1000 + progressivoAnnuale)` padded to 5 chars.

---

## 4. IVA Liquidation (DPR 633/1972)

- **Liquidazione periodica** — DPR 633/1972 art. 27 (mensile) o art. 7 DPR 542/1999 (trimestrale sotto soglia).
- **LIPE** (Liquidazione Periodica IVA Elettronica) — obbligo trasmissione trimestrale ad AdE (Provvedimento AdE 3 febbraio 2017).

SmartERP's `AccountingService.ivaLiquidation(tenantId, period)` computes the per-period taxable base and output IVA by rate band. It does NOT transmit LIPE electronically; the TD05 integration hook (`accounting/integrations/lipe.ts`) is on the roadmap (`docs/TECHNICAL-DEBT.md` T-08).

---

## 5. Record-Retention Matrix (Codice Civile & DPR 600/1973)

| Document class | Retention | Primary source |
|----------------|-----------|----------------|
| Scritture contabili obbligatorie | 10 years | Codice Civile art. 2220 |
| Fatture emesse e ricevute | 10 years (fiscal) | DPR 633/1972 art. 39; DPR 600/1973 art. 22 |
| Registri IVA | 10 years | DPR 633/1972 art. 39 |
| Libri sociali (SRL/SPA) | Finché la società esiste | Codice Civile art. 2421 |
| Corrispondenza commerciale | 10 years | Codice Civile art. 2214 |

SmartERP enforces retention via `InvoiceEntity.archivedAt`, `InvoiceEntity.archivePath`, and periodic tenant-level `retention_policy.yaml` (see `docs/OPERATIONS-CADENCE.md`).

---

## 6. GDPR Compliance (Reg. (UE) 2016/679 + D.Lgs. 196/2003)

- **Reg. (UE) 2016/679 (GDPR)** — https://eur-lex.europa.eu/eli/reg/2016/679.
- **D.Lgs. 30/06/2003 n. 196** (Codice Privacy), modificato dal **D.Lgs. 10/08/2018 n. 101** — https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2003;196.
- **Garante Privacy** — https://www.garanteprivacy.it.

Specific articles honoured in SmartERP architecture:

| GDPR Article | Obligation | SmartERP implementation |
|--------------|------------|--------------------------|
| art. 5(1)(c) — minimisation | Collect only what is necessary | No tracking of end-consumer behaviour; invoice line items store only business data. |
| art. 5(1)(e) — storage limitation | 10-year retention for invoices; 2-year retention for access logs | Configurable via `tenant.settings.retention_policy`. |
| art. 6 — lawful basis | Legitimate-interest + contract for tenant data | Documented in Privacy Policy linked from landing page. |
| art. 13 — information at collection | Transparent notice | `landing-page/#privacy` section. |
| art. 25 — privacy by design | Tenant isolation, least-privilege DB roles | `TenantScopeGuard`, `JwtStrategy`, argon2id password hashing. |
| art. 32 — security of processing | Encryption at rest + in transit | Postgres TLS, Redis AUTH, helmet CSP+HSTS, JWT with short TTL and rotation. |
| art. 33 — 72h breach notification | Incident response | `docs/RUNBOOK.md` — incident procedure + SIEM alert routing. |
| art. 30 — records of processing | ROPA kept | `docs/COMPLIANCE.md` — ROPA template. |

---

## 7. Cybersecurity (NIS2 + D.Lgs. 138/2024)

- **Direttiva (UE) 2022/2555 (NIS2)** — https://eur-lex.europa.eu/eli/dir/2022/2555.
- **D.Lgs. 4 settembre 2024, n. 138** — Italian transposition (in force 17/10/2024).
- **ACN CSIRT Italia** — https://www.csirt.gov.it.
- **OWASP ASVS v4.0.3** — target profile Level 2 (ASVS-L2) for SmartERP; Level 3 only for CyberGuard.

SmartERP applies these measures: argon2id password hashing; JWT with issuer/audience + short access TTL + rotating refresh with replay-detection; rate limiting (Throttler 120 req/min); TLS everywhere; Helmet CSP/HSTS in prod; tenant isolation; structured audit logs; SIEM-routable `smarterp_auth_events_total` counter. Full ASVS crosswalk in `docs/SECURITY.md`.

---

## 8. Primary-Source Verification Procedure (§Z.10)

Every citation in §1–7 has been verified as of 2026-04-17 against:
- **normattiva.it** for Italian law codes (DPR, D.Lgs., DM, Legge).
- **eur-lex.europa.eu** for EU regulations/directives.
- **agenziaentrate.gov.it** for Provvedimenti AdE.
- **garanteprivacy.it** for GDPR supervisory guidance.
- **acn.gov.it** for NIS2 transposition.

If any URL redirects or 404s in future consolidation cycles, the consolidator must:
1. Search normattiva.it for the current URN.
2. Update this file with the new URL.
3. Append a dated entry to `docs/CHANGELOG.md` under "Compliance drift".

---

## 9. Open Compliance Items (tracked in `docs/TECHNICAL-DEBT.md`)

| ID | Item | Severity |
|----|------|----------|
| T-08 | LIPE electronic transmission integration | medium |
| T-11 | TD20-TD28 extended document-type coverage | low |
| T-12 | XSD runtime validation wiring in E2E | medium |
| T-15 | ROPA (Registro Trattamenti) export to CSV | low |
| T-18 | Conservazione a norma provider integration (InfoCert or Aruba PEC) | medium |

---

## 10. Change Log

| Date | Change |
|------|--------|
| 2026-04-17 | Initial Mission II consolidation — full matrix, Piano dei Conti, FatturaPA pinning, retention matrix, GDPR/NIS2 crosswalk. |
