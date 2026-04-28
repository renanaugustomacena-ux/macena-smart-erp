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
| S1.1 | Apply ESLint rule `@smarterp/no-untenanted-query` | pending | autonomous-agent | — |
| S1.2 | Migration M-001: tenantId index audit + fix | pending | autonomous-agent | — |
| S1.3 | DataClassification decorator audit | pending | autonomous-agent | — |
| S1.4 | Argon2id transparent rehash (T-19) | partial — code present (auth.service.ts:242), import broken in password.util.ts (`@node-rs/argon2` API drift) | autonomous-agent | — |
| S1.5 | Per-IP throttle on `/auth/login` (T-06) + lockout backlog (T-07) | completed — verified by `auth.service.lockout.spec.ts` (7 tests green); throttle in `auth.controller.ts:38,57` + `app.module.ts` named "auth" throttler (5/min) | autonomous-agent | (this iteration) |
| S1.6 | ADRs 001-007 fully written under `docs/adrs/` | completed | autonomous-agent | aafdb0d |
| S1.7 | ProblemDetailsFilter test coverage | completed — `problem-details.filter.spec.ts` (22 tests green) covering status mapping, body extraction, correlation propagation, instance/type composition, 5xx logging | autonomous-agent | (this iteration) |
| S1.8 | Sprint demo: cross-tenant rejected at 4 layers (E2E test) | pending | autonomous-agent | — |

## Pre-existing test failures (out of S1.5/S1.7 scope; queued for next iteration)

- `src/common/password.util.spec.ts` — fails to compile. `password.util.ts:18` imports `argon2id` from `@node-rs/argon2` but that name is not exported by the installed version. Likely API drift; needs migration to `Algorithm.Argon2id`. Belongs to S1.4 (Argon2id rehash) follow-up.
- `src/accounting/fatturapa/fatturapa-adapter.spec.ts` — 1 assertion fails ("produces FPA12 format for PA with split payment"). Pre-existing data drift; belongs to a fatturapa-adapter sprint slot (Sprint 11+).

## Loop log (per-iteration)

- 2026-04-28 i01: plan completed (15077 lines, 747K); concatenated to `/home/renan/.claude/plans/smarterp-product-doctrine-and-build-plan.md`. Tasks 1-5 closed.
- 2026-04-28 i02: scaffolding pass — created `docs/adrs/` directory; created this `sprint-status.md`; authored baseline ADRs 001-007 (Tyree-Akerman format); two local commits (8259bf3 SaaS-strip; aafdb0d ADR scaffold). Pushed `7188d79..aafdb0d` to origin/main.
- 2026-04-28 i03: S1.5 + S1.7 confirmation pass. (a) Verified S1.5 already implemented in code (auth.controller `@Throttle({auth:{...}})`, auth.service MAX_FAILED_ATTEMPTS=5 / LOCKOUT_MINUTES=15, HTTP 423 on retry during lock window). (b) Wrote `problem-details.filter.spec.ts` (22 tests green) and `auth.service.lockout.spec.ts` (7 tests green; `verifyPassword` mocked); 29 new tests overall. (c) Two minimal source fixes to make TypeScript strict-mode happy: `auth.service.ts` User.refreshTokenHash → `string | null` (matches `@Column({nullable:true})`), and `HttpStatus.LOCKED` → literal `423` (RFC 4918 §11.3; the enum doesn't define LOCKED in `@nestjs/common` v10). No behaviour change.
- 2026-04-28 i04 (next): catch up S1.4 — fix `password.util.ts` import to use `Algorithm.Argon2id` from current `@node-rs/argon2` API; revive `password.util.spec.ts`. Then S1.1 (ESLint rule), S1.2 (index audit), S1.3 (DataClassification audit), S1.8 (cross-tenant E2E demo).

## Loop budget + halt awareness

- Halt on: user prompt; sprint completion; hard error (CI broken >2 iterations); per-day cost cap.
- Per-iteration logging: appended to this file's `Loop log` section.
