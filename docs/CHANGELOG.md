# Changelog — SmartERP

All notable changes to SmartERP are documented here. The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Mission II consolidation (2026-04-17): JwtStrategy, TenantScopeGuard, RolesGuard, argon2id password hashing with bcrypt legacy support, refresh-token rotation with replay detection, inventory reservation/release/ship, BOM expansion on production start, double-entry journal auto-post on invoice accept, FatturaPA v1.2.2 adapter with TD01/TD04/TD17/TD18/TD19/TD24/TD26 coverage, class-validator DTOs on every controller, Prometheus `/metrics` endpoint with `smarterp_build_info` and HTTP counters, seed script `npm run seed` for Fonderia Mozzecane SRL demo tenant.
- Documentation: ITALIAN-COMPLIANCE.md (IVA regime matrix, Piano dei Conti IV Direttiva CEE crosswalk, FatturaPA XSD pinning), RUNBOOK.md, SLO.md, SECURITY.md, A11Y.md.

### Changed
- Health endpoint returns canonical G2 body shape with `dependencies.postgres` and `dependencies.redis` probe results; legacy `uptime` and `timestamp` aliases retained for backward compatibility.
- Helmet CSP is now strict in production and lenient in development (to accommodate Swagger UI).

### Security
- Replaced bcrypt-only password hashing with argon2id (@node-rs/argon2, pure-Rust N-API binding). Legacy bcrypt hashes still verified and transparently re-hashed on successful login.
- `JWT_SECRET` ≥ 16 chars enforced at boot; refuses to start otherwise.

### Fixed
- E2E test aligned to new health-response schema.

---

## [1.0.0] — 2026-04-16

### Added
- First cut of the domain: auth, tenants, inventory, production, sales, accounting modules.
- MODUS_OPERANDI.md (13,303 words), ARCHITECTURE.md, API.md.
- Italian landing page with Verona manufacturing SME positioning.
- Docker compose stack (backend, frontend, postgres, redis) with health-checks.
- CI and CD GitHub Actions workflows.

---

## Compliance Drift Log

| Date | Item | Source | Notes |
|------|------|--------|-------|
| — | — | — | — |
