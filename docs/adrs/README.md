# Architecture Decision Records (ADRs)

This directory holds the canonical ADRs for SmartERP. Format: Tyree-Akerman.

Each ADR is immutable once accepted; supersession explicit (the new ADR references the superseded one; the old one is updated only to add `Status: Superseded by ADR-NNN`).

## Catalogue

| ID | Title | Status | Sprint |
|---|---|---|---|
| ADR-001 | Multi-tenant cloud as the deployment posture | Accepted 2026-04-28 | n/a |
| ADR-002 | Modular monolith first; microservices past €10M ARR / 30 engineers | Accepted 2026-04-28 | n/a |
| ADR-003 | NestJS 10 + TypeScript 5 + Node 20 backend | Accepted 2026-04-28 | n/a |
| ADR-004 | PostgreSQL 16 (Aurora in prod) as the system of record | Accepted 2026-04-28 | n/a |
| ADR-005 | Next.js 14 App Router + React 18 + Tailwind for the frontend | Accepted 2026-04-28 | n/a |
| ADR-006 | Italian as the source language for product copy | Accepted 2026-04-28 | n/a |
| ADR-007 | JWT (HS256 dev / RS256 prod) with rotating refresh | Accepted 2026-04-28 | n/a |
| ADR-008..ADR-060 | (proposed; full set in plan §8 + §35) | Proposed | per sprint |

## Authoring template

See `_template.md` (per plan §29.11).

## Cadence

- Per architectural decision: a new ADR (per plan rule R-P01).
- Monthly review meeting: last Friday of the month.
- ADR drift (ADR vs deployed code disagreement) flagged by quarterly audit.
