# Compliance Register — SmartERP

Rollup of all legal, regulatory, and contractual obligations. Each row points to the implementing artefact. This document is reviewed quarterly and whenever a new jurisdiction is onboarded.

| Obligation | Scope | Implementation | Owner |
|-----------|-------|----------------|-------|
| GDPR (Reg. UE 2016/679) | All personal data | `docs/ITALIAN-COMPLIANCE.md §6`, `docs/SECURITY.md`, tenant isolation via `TenantScopeGuard`, argon2id hashing | DPO |
| Codice Privacy D.Lgs. 196/2003 | Italian transposition of GDPR | Same as GDPR | DPO |
| FatturaPA v1.2.2 | B2B/B2G invoices | `backend/src/accounting/fatturapa/fatturapa-adapter.ts`, XSD pinned in `docs/schemas/` | Eng Lead |
| Split-payment art. 17-ter DPR 633/1972 | Fatture a PA | `accounting.service.ts :: acceptInvoice()` + `fatturapa-adapter.ts :: resolveEsigibilitaIVA()` | Eng Lead |
| Reverse charge art. 17 DPR 633/1972 | Intra-EU + specific domestic | Invoice line `ivaNature` enum N6.1–N6.9 + `documentType` TD17/TD18/TD19 | Eng Lead |
| Codice Civile art. 2220 (retention 10y) | All accounting records | Invoice `archivePath`, retention policy in `tenant.settings.retention_policy` | Compliance Officer |
| Codice Civile art. 2424 / 2425 | Bilancio italiano | Piano dei Conti IV Direttiva CEE seeder | Eng Lead |
| DPR 600/1973 | Accertamento tributario | Same retention | Compliance Officer |
| DPCM 3/12/2013 + AgID Linee Guida Conservazione | Conservazione a norma | Integration with InfoCert or Aruba PEC (roadmap T-09) | Compliance Officer |
| NIS2 D.Lgs. 138/2024 | Cybersecurity | `docs/SECURITY.md`; ACN CSIRT reporting runbook | CISO |
| ASVS v4.0.3 L2 | Secure coding | `docs/SECURITY.md §9`; Semgrep ruleset + CI enforcement | CISO |
| WCAG 2.1 AA | Public surfaces | `docs/A11Y.md`; axe-core CI | UX Lead |
| Italian labour law (if payroll module added) | Not in scope for SmartERP; HelpDeskAI / TeamFlow instead | — | — |

---

## 1. Supervisory Authority Contacts

- **Garante Privacy** — Piazza Venezia 11, 00187 Roma — `https://www.garanteprivacy.it` — notification via `https://servizi.gpdp.it/databreach`.
- **ACN / CSIRT Italia** — `https://www.csirt.gov.it`.
- **Agenzia delle Entrate** — `https://www.agenziaentrate.gov.it`.

---

## 2. Data-Processing Record (ROPA) — Summary

| Processing | Purpose | Lawful basis | Data subjects | Categories | Retention |
|-----------|---------|--------------|---------------|------------|-----------|
| Tenant administration | Contract execution | Contract art. 6(1)(b) | Admin/operator users | Name, email, role | Contract + 2y |
| Sales order lifecycle | Contract execution | Contract art. 6(1)(b) | Customer contacts | Name, VAT, address, email | 10 years fiscal |
| Invoice emission | Legal obligation art. 6(1)(c) + DPR 633/1972 | Legal obligation | Customer | Full fiscal identifiers | 10 years |
| Audit log | Security — legitimate interest art. 6(1)(f) | Legit. interest | All users | UserId, tenantId, event, timestamp | 2 years |

Full ROPA export to CSV pending (tracked T-15 in TECHNICAL-DEBT.md).

---

## 3. Sub-processors

| Sub-processor | Service | DPA signed | Data processed |
|---------------|---------|------------|-----------------|
| Amazon Web Services (eu-west-1) | Cloud infrastructure | YES — SCC + DPA | All tenant data at rest + transit |
| Cloudflare | DDoS + CDN | YES — DPA | HTTP metadata only |
| InfoCert (roadmap T-09) | Conservazione a norma | pending | Invoice XML archives |
| Sentry | Error monitoring | YES — DPA | Error stack traces (no PII fields) |
