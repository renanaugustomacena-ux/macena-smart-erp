# ADR-003 — NestJS 10 + TypeScript 5 + Node 20 as the backend stack

- **Status**: Accepted 2026-04-28 (inherited from initial scaffold; ratified)
- **Date**: 2026-04-28
- **Owner**: CTO

## Context

The existing scaffold (HEAD `7188d79`) ships NestJS 10 + TypeScript 5 + Node 20. The team's expertise is TypeScript-first; the hiring pool in Verona/Milan is heavy on Node/TypeScript; NestJS provides the structure (modules, controllers, services, guards, interceptors, pipes) that aligns with the DDD + bounded-context architecture (per ADR-002 + plan §6).

## Decision

NestJS 10 with TypeScript 5 strict mode. Node 20 LTS. Express adapter (Fastify reconsidered if a measured need appears).

## Consequences

- Positive:
  - Structured, opinionated framework that aligns to DDD.
  - Strong TypeScript types via `class-validator` + decorators.
  - OpenAPI 3.1 generation via `@nestjs/swagger`.
  - Pino integration (`nestjs-pino`).
  - Passport.js for auth (`@nestjs/passport`).
  - BullMQ via `@nestjs/bullmq`.
  - Familiar to the engineering pool we hire from.
- Negative:
  - Framework lock — switching is expensive but not impossible (the modular structure is portable).
- Neutral:
  - NestJS performance is "good enough" for our SLOs; if a hot path needs more, drop to native Node or extract to Go (rare; not in v1-v4).

## Alternatives considered

- **Plain Express + manual DI**: rejected — re-invents what NestJS provides at the cost of consistency.
- **Fastify with TypeBox**: rejected — smaller ecosystem; less Italian-developer familiarity. Reconsidered for hot paths if a measured perf need appears.
- **Nest with Fastify adapter**: under reconsideration in v3 if a perf bottleneck appears (single-line config flip; documented as a per-app option).
- **tRPC**: rejected — couples backend types to frontend types tightly, complicates the public API surface (we want REST + OpenAPI per ADR-035).

## References

- Plan §2.4, §7, §15.
- Existing `backend/package.json`.
- MODUS_OPERANDI §4.2.
