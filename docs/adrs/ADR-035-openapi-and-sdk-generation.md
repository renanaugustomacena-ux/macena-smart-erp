# ADR-035 — Public API contract via OpenAPI 3.1 + auto-generated SDKs

- **Status**: Accepted 2026-04-29 (Sprint 21, S21.4)
- **Date**: 2026-04-29
- **Owner**: CTO + Integration Hub owner

## Context

Plan §31.1 Sprint 21 ships the integration hub v1: webhook subscriptions, the first connector (Shopify), and the foundation for a partner SDK. Partners — internal IT (Federico), commercialista studios (Andrea), and ISVs — need long-lived programmatic access. Without a stable contract, every integration becomes a bespoke project.

Three forces shape the decision:

- The Italian SME long tail of integrators uses heterogeneous languages (TypeScript, PHP, Python, Java). A single language SDK does not fit.
- The contract surface (≈ 90 REST endpoints across 17 modules at end-of-Sprint-21) is too large for hand-written SDKs to keep in sync.
- The team is small. Maintaining hand-written SDKs across N languages would consume disproportionate engineering capacity.

## Decision

The platform's public contract is an **OpenAPI 3.1** specification, generated from the `@nestjs/swagger` decorators already present on every controller. The spec is published at:

- `GET /api/openapi.json` — runtime, the live spec the running deployment serves.
- `GET /api/openapi.yaml` — same, YAML rendering.
- `docs/openapi/v1.yaml` — checked-in snapshot per release tag (frozen at release; consumers pin to a `/v{N}` path prefix).

SDK generation is automated:

- TypeScript SDK: `@smarterp/sdk` (NPM scope reserved). Generated via `openapi-typescript-codegen` driven from `docs/openapi/v1.yaml`. Published per release tag (semver-aligned with the API contract major version).
- PHP SDK (Sprint 22+ scope): generated via `openapi-generator-cli`.
- Python SDK (Sprint 24+ scope): generated via `openapi-python-client`.

Versioning policy:

- API path prefix `/api/v{major}` (currently `/api/v1`). Major bump on a backwards-incompatible break (per ADR-038 — deferred but the policy is pinned here).
- Minor + patch versions bumped on the spec snapshot file alongside the SDK release tag.
- Deprecated endpoints retain a `Sunset` header (RFC 8594) for at least 6 months.

Authentication:

- The public API uses long-lived per-tenant API keys (separate from the user JWTs). Each key carries a scope set; the key is hashed at rest (sha-256). The current Sprint 21 surface ships the key-management endpoints under `/api/api-keys/*` (S22+ refines RBAC).
- Webhook callers sign with HMAC SHA-256 per ADR-037; no auth header beyond the signature.

Rate limiting:

- Per-tenant default 600 req/min on the public API. Premium tenants negotiate higher limits.
- Hot-spot endpoints (BI exports, large-list endpoints) are individually capped via the `@Throttle` decorator.

The first SDK ships in Sprint 21 (S21.5) — TypeScript only — as the reference implementation; PHP and Python follow on the cadence above.

## Consequences

- Positive:
  - Partners get a stable, type-safe surface in their language of choice.
  - Spec drift is mechanically prevented: the `openapi.json` is always the truth (generated from controllers).
  - Adding a connector is one Nest module + a controller decorator → automatic SDK exposure.
- Negative:
  - The team must maintain `@nestjs/swagger` discipline (every endpoint annotated). Pre-commit linter enforces this in Sprint 22.
  - Generated SDKs evolve mechanically with the spec; partners pin to a major version + a generated client version to avoid surprise rewrites.
- Neutral:
  - Hand-written SDK ergonomics (custom helpers, retry policies, telemetry) are layered on top of the generated client by a thin convenience package.

## Alternatives considered

- **GraphQL**: rejected for v1 — adds a query-planner cost the team cannot maintain at scale + does not match the procedural, RPC-style integration partners expect.
- **gRPC**: rejected — partners' tooling is HTTPS+JSON; gRPC adds friction without a corresponding benefit.
- **Hand-written SDKs**: rejected — see Context.
- **Vendor SDK platform (Stainless / Speakeasy)**: deferred — strong fit, but adds a vendor dependency the v1 budget does not justify. Reconsider at €1M annual revenue.

## References

- Plan §31.1 Sprint 21 (S21.4 — this ADR; S21.5 — first SDK ship).
- ADR-037 — webhook delivery (HMAC SHA-256, retry, DLQ).
- ADR-DA07 — field-level encryption for credentials at rest.
- RFC 8594 — Sunset HTTP header.
- OpenAPI Specification 3.1.0 — `https://spec.openapis.org/oas/v3.1.0`.
- `@nestjs/swagger` documentation.
- Decision-making informed by 2026 industry consensus that auto-generated SDKs from OpenAPI are the cheapest reliable cross-language partner surface for sub-€10M-revenue B2B platforms.
