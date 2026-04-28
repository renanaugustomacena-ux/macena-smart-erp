# Internationalisation seeds — DE / ES / FR fiscal feasibility

> Plan §31.3 Sprint 41. Owner: CTO + Compliance + GTM. Last reviewed: 2026-04-29.

This document is the feasibility study for the next three target geographies after Italy. Decision input for ADR-047 (deferred). v1 status: **planning only** — no code changes.

## 1. Germany (DE)

| Topic | Status / requirement |
|---|---|
| E-invoice protocol | XRechnung (UN/CEFACT CII or UBL XML); B2G mandatory since 2020; B2B mandatory phased-in 2025-2028. |
| Fiscal accounting | GoBD (Grundsätze ordnungsmäßiger Buchführung) — audit-trail discipline ≈ Italian Conservazione + journal-entry immutability. |
| VAT regime | UStG; standard rate 19%, reduced 7%. Reverse-charge on construction + intra-EU. |
| Tax authority | ELSTER online portal; XRechnung submission via Peppol BIS Billing 3.0. |
| ID surface | USt-IdNr (DE + 9 digits) + Steuernummer per Bundesland. |
| Effort | High — XRechnung schema is wider than FatturaPA; new XML adapter + Peppol AS4 transport. |
| Verdict | Feasible. Target: Sprint 52 (v5). |

## 2. Spain (ES)

| Topic | Status / requirement |
|---|---|
| E-invoice protocol | Veri*factu (Real Decreto 1007/2023) — mandatory phase-in 2025-2026. Facturae XML (B2G) + SII (Suministro Inmediato de Información) for IVA real-time reporting. |
| Fiscal accounting | Plan General de Contabilidad (PGC). |
| VAT regime | IVA standard 21%, reduced 10%, super-reduced 4%. |
| Tax authority | AEAT — same SII real-time submission cadence as Italy's quarterly LIPE but more frequent. |
| ID surface | NIF (B + 8 digits for empresas) + IBAN España format. |
| Effort | Medium-high — Veri*factu hash-chain requirement + SII real-time submission + Facturae XML. |
| Verdict | Feasible. Target: Sprint 56. |

## 3. France (FR)

| Topic | Status / requirement |
|---|---|
| E-invoice protocol | Factur-X (PDF/A-3 hybrid with embedded UN/CEFACT CII XML) + Chorus Pro for B2G; B2B mandatory phase-in 2026-2027 (per Loi de finances 2024). |
| Fiscal accounting | Plan Comptable Général (PCG). |
| VAT regime | TVA standard 20%, intermédiaire 10%, réduit 5.5%, particulier 2.1%. |
| Tax authority | DGFiP — Factur-X submission via the future PPF (Portail Public de Facturation) or one of the certified PDP (Plateformes de Dématérialisation Partenaires). |
| ID surface | SIRET (14 digits) + numéro TVA intracommunautaire. |
| Effort | Medium — Factur-X is a clean PDF/A-3 hybrid; PPF integration is the heavy item. |
| Verdict | Feasible. Target: Sprint 60. |

## 4. Cross-cutting work needed before any single geography lands

- ADR-047 — internationalisation prioritisation (deferred; this doc feeds it).
- Localisation infrastructure: per-tenant locale on the User row (already supported via Tenant.settings.locale); UI string-extraction pass.
- Fiscal-rule-engine refactor: today the IVA matrix lives in `iva-regimes.ts` (Italy-specific). v4-target work moves it to a per-country plugin — Italy stays the reference impl + each new country ships a parallel plugin.
- Currency surface: SmartERP entities are EUR-only via R-D04 + Money cents. Foreign-currency invoicing lands in Sprint 43 + acts as the Trojan-horse work for non-EUR countries (UK / CH if ever).
- Document-store schema: add a per-country `documentVariant` column on invoices so the FatturaPA XSD pinning can branch.

## 5. Recommendation

Pursue **DE first** (Sprint 52 target): largest neighbour market, mature XRechnung specification, the Italian customer base already shipped goods into Germany so the demand signal is highest.

ES and FR follow on a 6-month cadence (Sprint 56 + Sprint 60). Each lands with: a country-specific FatturaPA-equivalent adapter, a tax-authority-portal connector, a localisation pass, and a country-specific compliance pack mirroring the Sprint 20 NIS2 PDF generator.

## References

- Plan §31.3 Sprint 41 — this feasibility study.
- ADR-047 — internationalisation prioritisation (deferred).
- ADR-006 — Italian source of truth (the reference implementation that the country plugins parallel).
- DE: Bundesgesetzblatt I 2024 nr. xxxx Wachstumschancengesetz; XRechnung CIUS; Peppol BIS Billing 3.0.
- ES: Real Decreto 1007/2023 (Veri*factu); Orden HFP/417/2017 (SII).
- FR: Loi 2023-1322 de finances pour 2024 (e-invoice obligation); Factur-X 1.07.2.
