# ADR-002 — Modular monolith first; microservices only past €10M annual revenue or 30 engineers

- **Status**: Accepted 2026-04-28
- **Date**: 2026-04-28
- **Owner**: CTO

## Context

A startup with 3 founders and 8 engineers cannot afford the operational tax of microservices: per-service CI/CD, per-service observability, per-service deployment, distributed-tracing complexity, eventual-consistency bugs across service boundaries, and the network of mTLS / service-mesh / per-service secret management. The team needs to ship features fast.

At the same time, the long-term architecture must not paint us into a corner: when we hit a scale wall on a specific bounded context (e.g., the FatturaPA pipeline becomes the bottleneck), we want the option to extract that context to a microservice without rewriting the system.

The library's `12-SOFTWARE-ENGINEERING-EXTRA/02_Architecture_Design` reference (and Kamil Grzybek's `modular-monolith-with-ddd` open-source reference) demonstrate the pattern: strict bounded-context isolation inside one deployable; explicit module boundaries; in-process event bus for sync subscribers; Outbox pattern (per ADR-008) for cross-process subscribers.

## Decision

SmartERP is a NestJS modular monolith with strict bounded-context isolation:

- One container per replica; horizontal scaling via Kubernetes HPA.
- Per-bounded-context NestJS module subtree (per plan §6.2).
- Cross-module communication via in-process event bus (sync) and Outbox (async); no direct cross-module entity import (enforced by custom ESLint rule per R-A02).
- One CI/CD pipeline; one deployment unit; one observability stack.
- Worker pool deployed as a separate replica of the same container image (different entrypoint).

Microservices reconsidered only when one or more of:
- Total annual revenue exceeds €10M, OR
- Engineering team exceeds 30 engineers, OR
- A specific bounded context has measurable scale needs that the monolith cannot serve (e.g., AI-copilot inference requires a separate worker fleet at >100 concurrent sessions).

When any trigger fires, the *first* extraction is per-context, ADR-driven, with a 6-month coexistence window.

## Consequences

- Positive:
  - Low operational complexity; one CI/CD; one observability stack.
  - Fast feature shipping (no cross-service contract dance).
  - Easy local development; full system runs on `docker compose up`.
  - Bounded-context strictness gives us the future-extraction option without paying the operational tax now.
- Negative:
  - A single bad commit can affect the whole platform (mitigated by feature flags per ADR-014 + canary deploys per §17.3).
  - Horizontal scaling is per-monolith-pod (acceptable until Stage 4 per plan §7.9).
  - Memory footprint of the monolith grows as modules accumulate (mitigated by per-module lazy-loading where applicable).
- Neutral:
  - Future-extraction effort proportional to how strictly we enforce the lint rules now.

## Alternatives considered

- **Microservices from day 1**: rejected — operational tax kills startup velocity. The 2026 industry consensus (per Kamil Grzybek, per LIB-12:02_Architecture_Design) is that microservices are the wrong default for sub-€10M-revenue product startups.
- **Monolith without bounded contexts**: rejected — leads to a tangled god-object in 18 months; future-extraction becomes impossible without a rewrite.
- **Mini-services from day 1 (a handful, e.g., backend + worker + scheduler)**: partially adopted — the worker pool is a separate deployment of the same image with a different entrypoint, and the OTel collector + the observability stack are separate deployments by necessity.

## References

- Plan §2.4, §6.2, §6.7, §7, §7.9.
- Kamil Grzybek, `modular-monolith-with-ddd` GitHub reference.
- LIB-12:02_Architecture_Design.
- MODUS_OPERANDI.md §4.1.
