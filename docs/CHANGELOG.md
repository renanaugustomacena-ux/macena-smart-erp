# Changelog — SmartERP

All notable changes to SmartERP are documented here. The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [2.0.0] — 2026-04-29

### Added
- **Procurement Phase B** (Sprint 14): Goods Receipt + Supplier Invoice + 3-way match.
- **PEC passive-cycle ingester skeleton** (S14.4): `PecMailbox` port + `parseFatturaPa()` over FPA12.
- **Conservazione second vendor** (ADR-016 + ADR-025; S14.5 + S16.4): Aruba primary + InfoCert secondary; `ConservazioneOrchestrator` with tier-aware failover; InfoCert sandbox-mode.
- **Webhooks** (ADR-037; S14.6 + S21.1+S21.2): HMAC SHA-256 signing, transactional outbox, retry, DLQ, REST management.
- **Sales depth** (Sprint 15): Quotation + DDT + ContactActivity + 21 REST endpoints.
- **Sales pipeline + drill-down** (S16.1).
- **Intrastat — INTRA-1bis + INTRA-2bis** (S16.2; AE 88406/2017 + ADM 13799/RU/2018).
- **Membership + Commercialista Portal v1** (S16.3; plan §3.1.6).
- **HR-lite + CCNL** (Sprint 17): Employee + Attendance + LeaveRequest + CCNL reference (Metalmeccanico Industria + Commercio Terziario).
- **Migration runbooks** (ADR-040): M-TS-LYNFA, M-FC-FATTURECLOUD, M-EXCEL, M-PP-MEXAL, M-AR-FATTURAZIONE, M-MS-ACCESS.
- **CQRS read model + 11 projections + 40 dashboards** (Sprint 18; ADR-010 honoured).
- **PWA shell + mobile pages + barcode scanner** (Sprint 19).
- **NIS2 Compliance Pack + Audit Explorer + Vendor-DD templates** (Sprint 20).
- **Integration Hub v1** (Sprint 21) + ADR-035 OpenAPI 3.1 + `@smarterp/sdk` v0.1.0.
- **Enterprise SSO** (Sprint 22; ADR-017): SAML 2.0 + SCIM 2.0 + break-glass admin.
- **Treasury foundation + Intesa PSD2 sandbox** (Sprint 23): BankAccount + BankTransaction with field-level IBAN encryption (AES-256-GCM; ADR-DA07).

### Changed
- AuthService gains `mintTokensForTenantSwitch(userId, tenantId, role)` for the Andrea-pattern tenant switch.
- Conservazione consumers now go through `ConservazioneOrchestrator` (direct registry use reserved for super-admin tools).
- SaaS terminology stripped across MODUS_OPERANDI / PITCH / landing-page — SmartERP is licensed software (perpetual seat licence + annual maintenance), not SaaS.

### Security
- IBAN columns encrypted at rest with AES-256-GCM under `FIELD_LEVEL_ENC_KEY`.
- SAML signature verification pinned to RSA-SHA256.
- SCIM bearer tokens hashed (sha-256) with constant-time compare.

### Performance
- `tests/performance/v2-suite.js` k6 baseline (list P95 < 200 ms; dashboard P95 < 400 ms per v2.0 §20.10).

### E2E
- Playwright scaffolds for procure-to-pay + hire-to-pay golden paths.

---

### Added (Sprint 1 baseline; pre-2.0)
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
