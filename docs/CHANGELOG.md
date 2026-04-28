# Changelog — SmartERP

All notable changes to SmartERP are documented here. The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [4.0.0] — 2026-04-29

### Added
- Marketplace foundations + 7 launch partners (Sprints 37-38; ADR-045 deferred): packages catalogue, per-tenant installations, ISO 9001 / FP scheduling / Odette EDI / OPC-UA / Shopify / WooCommerce / Amazon Vendor Central seed.
- Active-passive multi-region (Sprints 39-40; ADR-041): eu-south-1 primary + eu-west-1 hot standby; documented failover runbook + quarterly DR drill cadence.
- DE / ES / FR fiscal feasibility study (Sprint 41) — DE prioritised first (Sprint 52 target).
- OpenAPI v1 snapshot + SDK quarterly release cycle (Sprint 42; ADR-035).
- IOSS validator + foreign-currency converter (Sprint 43).
- Tenant-sharding prep: ADR-042 codifying the Stage 5a/5b path (Sprint 44).
- ESG Scope 1+2 + PDF report (Sprint 45) — ESRS E1 + Italian 2024 emission factors.
- Mobile-native decision: continue PWA through v5 (Sprint 46; ADR-044 supersedes ADR-026).
- Q2 2026 DR drill v6 + pentest v8 report (Sprint 47).

### Changed
- Conservazione orchestrator + InfoCert sandbox-mode continue from v3.

### Notes
- 200 customers target (S48.5) is the GTM milestone closing v4.
- Sprint window 14-48 spans the 24-month roadmap from plan §31.

## [3.0.0] — 2026-04-29

### Added
- AI Copilot foundation (Sprint 25; ADR-015): pinned `claude-sonnet-4-6`, prompt caching, ToolRegistry + 10 Sara cockpit tools, per-tenant per-day token cap, eval harness Q1-Q5.
- RAG over audit + master-data (Sprint 26): `rag_chunks` + ingestion + PII redactor + tenant-scoped retrieval (substring fallback; pgvector ANN deferred).
- Production Copilot tools + sidebar UI + opt-in flow + eval Q6-Q15 (Sprint 27).
- Demand forecasting + reorder suggestions (Sprint 28).
- Greedy production scheduler + CP-SAT sidecar adapter (Sprint 29; CP-SAT live deferred).
- Z-score anomaly detection + static-rule compliance reasoner (Sprint 30).
- UniCredit + BPER PSD2 sandbox adapters + SEPA pain.001.001.09 builder (Sprint 31).
- Cash 30/60/90-day forecast + auto-reconciler heuristic (Sprint 32).
- Multi-company Phase A: `companies` table + per-entity surface (Sprint 33).
- Multi-company Phase B: per-Company + tenant rollup consolidation (Sprint 34).
- SOC 2 Type II audit-prep control matrix (Sprint 35).

### Changed
- The Copilot UI lands behind an explicit per-tenant opt-in toggle.
- Conservazione consumers route through ConservazioneOrchestrator (continued from v2.0).

### Security
- IBAN AES-256-GCM at rest (continued from v2.0).
- SAML signature pinning + SCIM bearer-token sha-256 hashing (continued from v2.0).

### Notes
- Industry-benchmarking opt-in (S36) wires into the existing BI projection layer; rollout is gated by per-tenant consent + the Compliance dashboard surface.
- 6 new ADRs land in v3 (017, 015, 025, 035, 040 — most explicitly written; 010 + 016 + 037 + 019 + DA07 + 011 cross-referenced).


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
