# SDK quarterly release cycle

> Plan §31.3 Sprint 42 (S42). ADR-035. Owner: Integration Hub owner.

## Cadence

| Quarter | Date | OpenAPI snapshot | TypeScript SDK | PHP SDK | Python SDK |
|---|---|---|---|---|---|
| Q2 2026 | 2026-04-29 | `docs/openapi/v1.yaml` v1.0.0 | `@smarterp/sdk` 0.1.0 | n/a | n/a |
| Q3 2026 | 2026-07-31 | v1.1.0 (Phase 4 endpoints) | 0.2.0 | 0.1.0 | n/a |
| Q4 2026 | 2026-10-31 | v1.2.0 | 0.3.0 | 0.2.0 | 0.1.0 |
| Q1 2027 | 2027-01-31 | v1.3.0 | 1.0.0 (GA) | 1.0.0 (GA) | 0.2.0 |
| Q2 2027 | 2027-04-30 | v1.4.0 | 1.1.0 | 1.1.0 | 1.0.0 (GA) |

## Per-cycle steps

1. **T-21d** — engineering branches the release: bump `info.version` in `docs/openapi/v1.yaml`, run `freeze-openapi.ts` to dump the full live JSON, hand-curate the YAML diff.
2. **T-14d** — partners receive the diff via the partner mailing list + a public changelog under `sdk/CHANGELOG.md`.
3. **T-7d** — TypeScript SDK regenerated via `cd sdk/typescript && npm run regen`; `tsc -p` clean; SDK release-candidate published as `@smarterp/sdk@${tag}-rc.1` to npm.
4. **T-3d** — PHP + Python SDKs regenerated (per the SDK matrix above).
5. **T-day** — final SDKs published; release notes posted; partners notified.
6. **T+30d** — adoption telemetry reviewed (per-SDK request volume); deprecation warnings added to any endpoint marked as such.

## Deprecation policy

Per ADR-035: Sunset header (RFC 8594) on deprecated endpoints for ≥ 6 months. Endpoint removal aligned with major-version bumps (`/api/v{N+1}` cutover).

## Quarterly checklist

- [ ] CI green on `npm run test` + `npm run e2e:smoke`.
- [ ] `docs/openapi/v1.yaml` round-trips through `openapi-generator-cli validate`.
- [ ] No security-relevant change without a security-reviewer agent pass.
- [ ] Partner advisory email drafted + approved by GTM owner.

## References

- ADR-035 — OpenAPI 3.1 + SDK generation.
- RFC 8594 — Sunset HTTP header.
- npm + Packagist + PyPI publish workflows under `infra/cicd/sdk-release.yml` (deferred — handed to the integration hub owner).
