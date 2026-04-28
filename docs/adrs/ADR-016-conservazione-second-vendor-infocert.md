# ADR-016 — Conservazione a norma: per-vendor adapter (Aruba primary, InfoCert backup)

- **Status**: Accepted 2026-04-28 (Sprint 14)
- **Date**: 2026-04-28
- **Owner**: CTO + Compliance-team owner

## Context

Italian "conservazione sostitutiva" / "conservazione a norma" of FatturaPA invoices and other tax-relevant electronic documents is a legal obligation under:

- **CAD** — D.Lgs. 7 marzo 2005 n. 82 (Codice dell'Amministrazione Digitale), artt. 43-44.
- **DPCM 3 dicembre 2013** — "Regole tecniche in materia di sistema di conservazione" (the canonical rulebook for the per-document hash chain, the manifest, the closing-the-package process).
- **Linee guida AgID** sulla formazione, gestione e conservazione dei documenti informatici (last revision applicable through 2026; superseded portions are explicitly tracked in `docs/ITALIAN-COMPLIANCE.md`).
- **D.Lgs. 127/2015** + **Provv. AdE 89757/2018** — pin FatturaPA invoices to a 10-year retention window in a "sistema di conservazione" presso un Conservatore Accreditato AgID.

The list of "Conservatori Accreditati AgID" is published at `https://www.agid.gov.it/it/piattaforme/conservazione/elenco-conservatori-accreditati`. Tenants must keep the original electronic FatturaPA file (the SDI XML signed envelope), the SDI receipts (RC, MC, NS, NE, MT, EC), and the per-invoice metadata (codice fiscale, partita IVA, data fattura, importo) for ten years. The Conservatore is the legal counterparty that issues the "rapporto di versamento" and the "pacchetto di archiviazione" — the proofs the tenant shows in a tax audit.

The platform must support **at least two accredited Conservatori** so that the platform itself is not a single point of failure for a regulatory obligation:

- **Aruba S.p.A.** — `aruba-pec-conservazione`, the largest Italian Conservatore by volume; consumer-grade entry point + Enterprise tier.
- **InfoCert S.p.A.** — `infocert-conservazione`, the second-largest; widely used by professional firms and law firms.

Tenants must be able to switch Conservatore without code changes and without losing previously archived documents (which legally remain at the original Conservatore for the residual retention window).

Plan §9.6 (Procurement Phase B) and plan §31.1 Sprint 14 (S14.5) require the second-vendor InfoCert skeleton to land alongside the Aruba primary so the abstraction is exercised by two implementations, not just one.

## Decision

A single `ConservazioneAdapter` port in `backend/src/conservazione/conservazione.adapter.ts` with the minimum set of operations the legal regime requires:

```ts
interface ConservazioneAdapter {
  readonly vendorId: ConservazioneVendorId;             // 'aruba' | 'infocert'
  send(request: VersamentoRequest): Promise<VersamentoReceipt>;
  fetchReceipt(versamentoId: string): Promise<VersamentoReceipt>;
  exhibit(versamentoId: string): Promise<EsibizionePackage>;
  search(query: ConservazioneSearchQuery): Promise<ConservazioneIndexEntry[]>;
}
```

Per-vendor implementations live in `backend/src/conservazione/<vendor>.adapter.ts`. Each:

- Holds per-tenant credentials in `tenant.settings.conservazione.<vendor>` (encrypted per ADR-DA07).
- Goes through the central `HttpClientService` wrapper (per ADR-032 / R-A09) — timeouts, retries, circuit-breaker.
- Maps the canonical SmartERP "versamento" payload (FatturaPA XML + SDI receipts + index metadata) into the vendor's schema and back.
- Surfaces vendor-specific errors as `application/problem+json` per ADR-011, with the canonical `type`-URI prefix `https://smarterp.it/errors/conservazione/<vendor>/<errorCode>`.
- Returns a `VersamentoReceipt` containing the vendor-side `versamentoId`, the SHA-256 of the archived bundle, the timestamp of acknowledgment, and the `rapportoDiVersamentoUrl` (a vendor-served URL for a signed PDF receipt the tenant can present in an audit).

A `ConservazioneRegistry` (NestJS provider) maps `vendorId` → adapter at boot. Adding a new Conservatore is a one-file change: implement `<vendor>.adapter.ts`, add a constructor injection, append to the internal Map. Other modules query through `get()` only.

Per-tenant Conservatore preference is persisted as `tenant.settings.conservazione.default` plus per-document override (rare; usually constant per fiscal year per the DPCM 3/12/2013 §6 stability requirement).

Sprint 14 ships:
- The port + the registry.
- An **Aruba** adapter SKELETON (sketches the upstream `https://wsdoccons.arubapec.it/` SOAP envelope; throws `NotImplementedException` with a Sunset note pointing to plan §31.1 Sprint 11 follow-up where the live adapter lands).
- An **InfoCert** adapter SKELETON (sketches the upstream `https://services.infocert.it/conservazione` REST envelope; same shape).

Sprint 22 (per plan §31.2) wires the live Aruba implementation. Sprint 23 wires the live InfoCert implementation.

## Consequences

- Positive:
  - Two-vendor failover satisfies the legal "no single point of failure" intent for a 10-year obligation.
  - Per-tenant choice without code branching.
  - Per-tenant API-key segregation matches the credential-rotation model.
  - Observability: per-call metrics labelled by `vendor_id` for SLO breakdown.
  - Adding a third Conservatore (e.g., **Namirial**) at Enterprise demand is one-file work.
- Negative:
  - Per-vendor API-key management (one secret bundle per tenant per vendor).
  - Per-vendor quirks (SOAP vs REST; Aruba enforces a `<DichiarazioneVersamento>` envelope wrapper that InfoCert collapses into a request header); requires per-vendor maintenance.
  - When a tenant switches Conservatore, the residual retention window stays at the original Conservatore (legal constraint, not a platform constraint); the platform must persist a `vendorIdAtTimeOfVersamento` per-document so future "esibizione" calls route to the right vendor.
- Neutral:
  - The `ConservazioneAdapter` port intentionally hides per-vendor concepts (SOAP envelope shape, multi-part body for Aruba, JWT-bearer auth for InfoCert) behind a common payload. Tenants needing vendor-specific features go through an extension hook (`conservazione.<vendor>.metadata`).

## Alternatives considered

- **Single-vendor (Aruba only)**: rejected — fails the legal "no single point of failure" intent for a 10-year obligation; plus a price-leverage problem at renewal.
- **Build conservazione in-house**: rejected — the platform would have to enrol with AgID as Conservatore Accreditato itself (multi-year process; ISO 14721 OAIS conformance audit; €100k+ annual maintenance). Not viable until €10M ARR.
- **Aggregator (e.g., Trust Provider front-end)**: rejected — extra cost layer; weaker direct-issue resolution; the two largest Italian Conservatori are already first-class via direct integration.

## References

- Plan §9.6 (Procurement Phase B → SI archiving handoff to Conservazione).
- Plan §31.1 Sprint 14 (S14.5 second-vendor skeleton); §31.2 Sprint 22-23 (live integrations).
- D.Lgs. 7 marzo 2005 n. 82 (CAD) artt. 43-44.
- DPCM 3 dicembre 2013 — "Regole tecniche in materia di sistema di conservazione".
- Linee guida AgID sulla formazione, gestione e conservazione dei documenti informatici.
- Provv. AdE 89757/2018.
- Elenco Conservatori Accreditati AgID: `https://www.agid.gov.it/it/piattaforme/conservazione/elenco-conservatori-accreditati`.
- ADR-032 (HttpClientService wrapper).
- ADR-011 (RFC 7807 ProblemDetails).
- ADR-DA07 (field-level encryption for vendor credentials).
- ADR-019 (Carrier per-vendor adapter — same architectural pattern; this ADR mirrors it for the Conservazione domain).
