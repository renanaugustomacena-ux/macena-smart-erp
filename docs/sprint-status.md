# Sprint Status

> **Authoritative.** Updated per autonomous-loop iteration.
> Plan reference: `/home/renan/.claude/plans/smarterp-product-doctrine-and-build-plan.md` v1.0.0 (2026-04-28).

## Current sprint

- **Sprint number**: 1
- **Sprint window**: 2026-W18 to 2026-W19 (May 2026)
- **Status**: in_progress
- **Sprint demo subject**: cross-tenant attack rejected at all four layers (JWT, TenantScopeGuard, service-layer, RLS).

## Stories

| ID | Subject | Status | Owner | PR |
|---|---|---|---|---|
| S1.0 | Scaffold sprint-status + ADR baseline (ADR-001..ADR-007) | completed | autonomous-agent | aafdb0d |
| S1.1 | Apply ESLint rule `no-untenanted-query` | completed — `eslint-rules/no-untenanted-query.js` (AST-based; method regex covers find*/update*/delete*/softDelete/softRemove/count*/recover/exists/increment/decrement/remove on `*Repo|*Repository` receivers; deep-scans args for tenantId/tenant_id; falls back to scanning the enclosing function body to handle the where-built-in-a-variable pattern). Wired via `--rulesdir eslint-rules` in the `lint`/`lint:check` scripts and `.eslintrc.cjs` (rule level: `warn`; off for spec/seed/migrations). RuleTester self-test in `eslint-rules/no-untenanted-query.test.js` (12 valid + 5 invalid cases, all pass). 9 legitimate cross-tenant exemptions annotated in source (auth.service.ts × 7, tenants.service.ts × 2). Codebase clean of rule violations. | autonomous-agent | (this iteration) |
| S1.2 | Migration M-001: tenantId index audit + fix | pending | autonomous-agent | — |
| S1.3 | DataClassification decorator audit | pending | autonomous-agent | — |
| S1.4 | Argon2id transparent rehash (T-19) | completed — fixed `@node-rs/argon2` import (`argon2id` → `Algorithm.Argon2id`); extended `password.util.spec.ts` to 8 tests (2 legacy detection + 6 real Argon2id round-trip: hash format, verify true/false, empty/malformed inputs, salting). Argon2id transparent-rehash on legacy bcrypt verify already in `auth.service.ts:242`. | autonomous-agent | (this iteration) |
| S1.5 | Per-IP throttle on `/auth/login` (T-06) + lockout backlog (T-07) | completed — verified by `auth.service.lockout.spec.ts` (7 tests green); throttle in `auth.controller.ts:38,57` + `app.module.ts` named "auth" throttler (5/min) | autonomous-agent | (this iteration) |
| S1.6 | ADRs 001-007 fully written under `docs/adrs/` | completed | autonomous-agent | aafdb0d |
| S1.7 | ProblemDetailsFilter test coverage | completed — `problem-details.filter.spec.ts` (22 tests green) covering status mapping, body extraction, correlation propagation, instance/type composition, 5xx logging | autonomous-agent | (this iteration) |
| S1.8 | Sprint demo: cross-tenant rejected at 4 layers (E2E test) | pending | autonomous-agent | — |

## Pre-existing test failures still queued

- `src/accounting/fatturapa/fatturapa-adapter.spec.ts` — 1 assertion fails ("produces FPA12 format for PA with split payment"). Belongs to a fatturapa-adapter sprint slot (Sprint 11+).

(`src/common/password.util.spec.ts` resolved this iteration — see S1.4.)

## Test totals

- Full suite: 6 of 7 suites pass; 59 of 60 tests pass.
- The remaining 1 failing test is the pre-existing FatturaPA-adapter assertion above.

## Loop log (per-iteration)

- 2026-04-28 i01: plan completed (15077 lines, 747K); concatenated to `/home/renan/.claude/plans/smarterp-product-doctrine-and-build-plan.md`. Tasks 1-5 closed.
- 2026-04-28 i02: scaffolding pass — created `docs/adrs/` directory; created this `sprint-status.md`; authored baseline ADRs 001-007 (Tyree-Akerman format); two local commits (8259bf3 SaaS-strip; aafdb0d ADR scaffold). Pushed `7188d79..aafdb0d` to origin/main.
- 2026-04-28 i03: S1.5 + S1.7 confirmation pass. (a) Verified S1.5 already implemented in code (auth.controller `@Throttle({auth:{...}})`, auth.service MAX_FAILED_ATTEMPTS=5 / LOCKOUT_MINUTES=15, HTTP 423 on retry during lock window). (b) Wrote `problem-details.filter.spec.ts` (22 tests green) and `auth.service.lockout.spec.ts` (7 tests green; `verifyPassword` mocked); 29 new tests overall. (c) Two minimal source fixes to make TypeScript strict-mode happy: `auth.service.ts` User.refreshTokenHash → `string | null` (matches `@Column({nullable:true})`), and `HttpStatus.LOCKED` → literal `423` (RFC 4918 §11.3; the enum doesn't define LOCKED in `@nestjs/common` v10). No behaviour change.
- 2026-04-28 i04: S1.4 done — fixed `password.util.ts` import to `Algorithm.Argon2id`; extended `password.util.spec.ts` from 2 to 8 tests (real Argon2id round-trip: hash format match, verify true/false, empty/malformed inputs, salting). Full suite up to 59/60.
- 2026-04-28 i05: S1.1 done — wrote custom ESLint rule `no-untenanted-query` (R-D02 enforcement). Created `.eslintrc.cjs` (NestJS baseline + the rule), `eslint-rules/no-untenanted-query.js` (AST walker), `eslint-rules/no-untenanted-query.test.js` (RuleTester 17/17 pass). Updated `package.json` scripts: `lint`, `lint:check`, `lint:rule-test`. Annotated 9 legitimate cross-tenant exemptions across auth.service.ts + tenants.service.ts with `// eslint-disable-next-line no-untenanted-query` and a one-line justifying comment per the rule's escape design. Codebase clean of rule violations (7 unrelated unused-var warnings remain — pre-existing, separate scope).
- 2026-04-28 i06 (next): S1.2 (migration M-001 tenantId-index audit + fix any deviation), S1.3 (DataClassification decorator audit), S1.8 (cross-tenant E2E demo).

## Loop budget + halt awareness

- Halt on: user prompt; sprint completion; hard error (CI broken >2 iterations); per-day cost cap.
- Per-iteration logging: appended to this file's `Loop log` section.
