# ADR-040 — Migration from legacy systems via documented "import & verify" runbook per source

- **Status**: Accepted 2026-04-28 (Sprint 17, S17.8)
- **Date**: 2026-04-28
- **Owner**: CTO + Customer Success owner

## Context

The largest customer-acquisition vector for SmartERP is the **escape from a legacy gestionale**. Plan §3.5 + §22 + the Sara / Federico personas (§4.1.2 + §4.1.6) all converge on the same observation: the migration is the buyer's most-feared part of the deal. A migration story that is *documented, repeatable, supported, and reversible* is the difference between closing in 4 weeks and losing in 12.

The Italian SME long tail of source systems is non-trivial:

| System | Vendor / class | Coverage in Verona-Veneto cohort |
|---|---|---|
| TeamSystem Lynfa | TeamSystem on-prem ERP | high (mid-market manifatturiere) |
| Zucchetti Ad Hoc Enterprise | Zucchetti on-prem ERP | high (manifatturiere + commercio) |
| Passepartout Mexal | Passepartout on-prem ERP | medium |
| Danea EasyFatt | Danea SaaS | high (small businesses + studios) |
| Fatture in Cloud | TeamSystem SaaS | very high (sub-10-employee) |
| Aruba Fatturazione Elettronica | Aruba SaaS | medium |
| Generic Excel + paper | Microsoft Excel + filing | high (the smallest tier) |
| Microsoft Access database | Microsoft Access | low (legacy artisan firms) |
| Generic AS400 / DOS legacy | various | low (very-large industrial heritage) |
| Libero SISTEMI | Libero SISTEMI | low |

A single, generic "data import API" cannot serve all of these. Source-side export formats vary (CSV, XML, FatturaPA bundle, native database, screenshot transcription). Source-side data quirks vary (date ambiguity, free-text customer names, partial-tenancy mappings, missing CCNL coding). The risk of an under-specified migration is a customer that signs but never goes live, or a customer that goes live with broken data and churns within 90 days.

The **cost of not owning this** has been measured in the persona research: one customer who churned after 60 days because the migration team declared "your data is wrong" and walked away costs ~€15k in lost annual revenue (licence + maintenance) + the negative reputation amplifier among Verona commercialisti (Andrea network).

## Decision

A **runbook per source system** is the contract for a SmartERP migration. The runbooks live in `docs/migration/<runbook-id>.md`, follow a fixed structure (below), and are versioned per source-system version. Each runbook is owned by an engineer + a customer-success counterpart; both sign off on every revision.

### Runbook structure (mandatory headings)

Every runbook MUST contain these top-level sections in this order:

1. **Source system overview** — name, vendor, version coverage, deployment model (on-prem / SaaS / hybrid), key data tables, known quirks, end-of-life signal if any.
2. **Pre-migration checklist** — scope (modules in / modules out), customer-side roles (data steward, IT contact, commercialista), source-system freeze period, sample-data acquisition.
3. **Data export procedure** — step-by-step instructions for the customer or SmartERP migration engineer to extract data from the source. Includes screenshots paths (under `docs/migration/<runbook-id>/img/`), command-line invocations, vendor-API auth flow, expected output format.
4. **Mapping** — source field → SmartERP field, per entity (Customer, Supplier, Product, Invoice, SupplierInvoice, etc.). Conflicts and lossy mappings are flagged with a `LOSSY` callout.
5. **Validation** — dry-run report contract: what the SmartERP `/api/migration/dry-run` endpoint returns; expected anomalies (e.g., "5% of customers missing partita IVA"); acceptance thresholds.
6. **Cutover-day checklist** — hour-by-hour T-day plan starting at the source-system freeze (typically 06:00 Europe/Rome) through the SmartERP go-live (typically 18:00). Named owners per step.
7. **Rollback procedure** — how to roll back to the source system within 24 hours of cutover. Pre-conditions (the source system MUST remain available read-only for 30 days post-cutover) and the data-equivalence check.
8. **Post-migration validation** — data-integrity checks (count parity, sum parity, sample-customer sign-off); the commercialista's first-month-after sign-off.
9. **Sign-off** — customer-side signed acceptance + commercialista-side signed acceptance + SmartERP migration-engineer sign-off.
10. **Change log** — runbook version history (one row per source-version-bump or runbook revision).

Each runbook ends with a **References** block listing the source-vendor documentation URL, the SmartERP import endpoint(s) used, and any related ADRs.

### Cross-cutting invariants

- Runbooks live under `docs/migration/<runbook-id>.md` (e.g., `docs/migration/M-TS-LYNFA.md`).
- Each runbook has a unique short identifier (`M-TS-LYNFA`, `M-FC-FATTURECLOUD`, `M-EXCEL`, …) cross-referenced from plan §21.1.
- Per-runbook samples (anonymised) live under `docs/migration/<runbook-id>/sample-input/` (gitignored if the customer requested it; otherwise scrubbed of PII).
- Per-runbook cutover scripts live under `backend/scripts/migration/<runbook-id>/` and follow the naming `import-*.ts` / `validate-*.ts`. Scripts MUST be idempotent — re-running with the same input must not duplicate rows; the import endpoints achieve this through tenant-scoped deduplication keys (e.g., `customer.code`, `invoice.fiscalYear+number`).
- Every runbook MUST be exercised against a real anonymised customer dataset before its first production cutover. The proof lives in the runbook's "Validation" section under "First production cutover".
- A runbook ships with a `docs/migration/<runbook-id>/dry-run-report-example.json` showing the expected validator output shape.

### Maintenance discipline

- Each runbook lists `Source-vendor version coverage`. When the source vendor releases a new major version, the runbook is reviewed within one sprint; if the export format has changed, a runbook revision is filed under the change log.
- Runbook drills (R-O04 cadence): every quarter the migration engineer rehearses one runbook in staging against a fresh anonymised dataset; the lessons-learned feed back into the "Known quirks" section.

## Consequences

- Positive:
  - Predictable migration story — the customer sees the runbook before signing.
  - Faster sales cycle — the commercialista can review the mapping section before the customer commits.
  - Reusable per cohort — one engineer-week per quarter maintains the entire runbook portfolio at the v1 cohort scale (~10 source systems).
  - Visible accountability — every runbook has an engineer owner + a customer-success owner.
- Negative:
  - Per-source-version maintenance overhead. Mitigated by quarterly drill cadence and a strict "review on vendor release" trigger.
  - Diverging runbook depth across sources. Mitigated by the fixed structure (above) and a 25-line minimum per section to discourage "stub runbooks".
- Neutral:
  - Some sources will never get a Tier-1 runbook (e.g., bespoke AS400 systems). Those customers go through a one-off manual migration and pay a €X k professional-services line item (per §22 pricing). The runbook for "generic AS400" exists but flags itself as "case-by-case".

## Alternatives considered

- **Single generic CSV import endpoint**: rejected — does not solve the "Sara doesn't know how to export TeamSystem Lynfa" problem; the export procedure itself is half the value.
- **Per-customer one-off migration**: rejected — does not scale; cost-per-customer prohibitive after the first 5 cohorts.
- **Outsource migration to a partner network**: deferred — considered for v3+ when partner-network maturity justifies; v1 keeps migration in-house as a competitive moat.

## References

- Plan §22 — go-to-market; §21 — migration playbook; §31.1 Sprint 17 (S17.5..S17.7) for the first three runbooks.
- Personas Sara (§4.1.2) + Federico (§4.1.6) + Andrea (§4.1.5) — the migration-decision triangle.
- ADR-016 / ADR-025 — Conservazione vendor selection, since legacy invoices in Conservazione at the source vendor stay there per the legal stability requirement and influence the cutover plan.
- ADR-035 (deferred) — OpenAPI 3.1 + SDK gen, since custom migration scripts often need first-class SDK access.
- D.Lgs. 196/2003 (privacy) — anonymisation discipline for shared sample datasets.
- DPCM 3 dicembre 2013 — Conservazione's stability requirement for legacy invoices.
