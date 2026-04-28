# ADR-019 — Carrier integration via per-vendor adapter behind a common port

- **Status**: Accepted 2026-04-28 (Sprint 13)
- **Date**: 2026-04-28
- **Owner**: CTO + Warehouse-team owner

## Context

Italian SMEs ship through a fragmented carrier landscape:
- **BRT (Bartolini)** — dominant in northern Italy; `srv.brt.it` SOAP/REST APIs.
- **GLS Italy** — peer to BRT; HTTPS/JSON API; OAuth-token based.
- **BRT** = legacy abbreviation for the company branded as "Bartolini" historically.
- **SDA** — Poste Italiane subsidiary; legacy SOAP + newer REST.
- **Poste Italiane** — universal-service carrier; cross-border flows.
- **DHL Italy** / **UPS Italia** / **FedEx Italia** — for cross-border + premium.

Each carrier has its own auth, rate-limit posture, label format (PDF / ZPL / EPL), tracking semantics, COD handling, insurance schema, and quote format. The per-tenant Italian SME typically uses 1-2 carriers; the platform must support all of them and let tenants switch carriers without code changes.

Plan §9.10 (Warehouse + Logistics) and plan §31.1 Sprint 13 require a CarrierAdapter port plus per-vendor adapters. v2.0 ships Bartolini + GLS; BRT + SDA in v2.1; DHL on Enterprise demand.

## Decision

A single `CarrierAdapter` port in `backend/src/warehouse/carriers/carrier.adapter.ts` with five methods:

```ts
interface CarrierAdapter {
  readonly carrierId: string;                            // 'bartolini' | 'gls' | ...
  quote(request: ShipmentQuoteRequest): Promise<ShipmentQuoteResponse>;
  createShipment(request: CreateShipmentRequest): Promise<CreateShipmentResponse>;
  fetchLabel(carrierShipmentId: string): Promise<Buffer>;     // PDF
  track(trackingNumber: string): Promise<TrackingStatus>;
  cancelShipment(carrierShipmentId: string): Promise<void>;
}
```

Per-vendor implementations live in `backend/src/warehouse/carriers/<vendor>.adapter.ts`. Each:

- Holds per-tenant credentials in `tenant.settings.carriers.<vendor>` (encrypted per ADR-DA07).
- Goes through the central `HttpClientService` wrapper (per ADR-032 / R-A09) — timeouts, retries, circuit breaker.
- Maps the canonical SmartERP shipment payload into the vendor's schema and back.
- Surfaces vendor-specific errors as `application/problem+json` per ADR-011, with the canonical `type`-URI prefix `https://smarterp.it/errors/carriers/<vendor>/<errorCode>`.

Per-tenant carrier preferences are persisted as `tenant.settings.carriers.default` plus per-shipment override.

A `CarrierRegistry` (NestJS provider) maps carrierId → adapter at boot. New carriers register by adding an adapter file and one line in the registry; no other module touches the registry.

Sprint 13 ships:
- The port + the registry + the Bartolini adapter SKELETON (no live API calls yet — `quote` / `createShipment` / `fetchLabel` / `track` / `cancelShipment` throw `NotImplementedException` with a documented next-step).

Sprint 19 (per plan §31.1) adds the live Bartolini integration plus GLS. Sprint 21 adds BRT + SDA. DHL on Enterprise demand.

## Consequences

- Positive:
  - Uniform shipping UX across carriers (label, tracking, cancel are one method each).
  - Easy to add carriers (one file).
  - Per-tenant choice without code branching.
  - Per-tenant API-key segregation matches the credential-rotation model.
  - Observability: per-call metrics labelled by `carrier_id` for SLO breakdown.
- Negative:
  - Per-carrier API-key management (one secret per tenant per carrier).
  - Per-carrier quirks (rate limits, label formats); requires per-vendor maintenance.
  - Vendor-API drift forces per-adapter fixups.
- Neutral:
  - The `CarrierAdapter` interface intentionally hides per-vendor concepts (booking-id format, COD handling, insurance) behind a common payload. Tenants needing vendor-specific features go through an extension hook (`carrier.<vendor>.metadata`).

## Alternatives considered

- **Aggregator (Shippo, EasyPost, Sendcloud)**: rejected for v2-v3. Pros: one API, less per-vendor maintenance. Cons: extra cost layer; weaker direct-issue resolution; some Italian carriers (Bartolini specifically) are second-class on these aggregators. Reconsider at €3M ARR if direct maintenance burden exceeds the aggregator margin.
- **Per-tenant custom carrier code**: rejected — would not scale across a tenant base.

## References

- Plan §9.10 (Warehouse + Logistics).
- Plan §31.1 Sprint 13 (S13.4 carrier skeleton); §31.2 Sprint 19 (live integration).
- ADR-032 (HttpClientService wrapper).
- ADR-011 (RFC 7807 ProblemDetails).
- ADR-DA07 (field-level encryption for carrier credentials).
