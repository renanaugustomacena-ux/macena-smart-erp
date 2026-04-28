# ADR-015 — AI Copilot architecture: pinned model, prompt caching, tool-use, per-tenant cost cap

- **Status**: Accepted 2026-04-29 (Sprint 25, S25.6)
- **Date**: 2026-04-29
- **Owner**: CTO + AI/ML owner

## Context

Plan §1.6 + §9.17 + §13 require an AI Copilot on every meaningful screen — not as a marketing feature, but as a productivity multiplier for Sara, Marco, Luca, Giulia, and Andrea. Three forces shape the architecture:

- The Copilot must speak Italian fluently and reason about Italian fiscal logic (FatturaPA, IVA regimes, CCNL). Translation-style models fail on this; we need a frontier model.
- Cost discipline is non-negotiable: a runaway tool loop on a single tenant cannot drain the engineering budget. Cost-cap enforcement happens before every model call.
- Determinism + auditability: every Copilot turn lands in the audit log; every tool call is server-side + tenant-scoped + visible in the audit explorer (Sprint 20 surface).

## Decision

The platform's AI layer is built around four anchors:

1. **Pinned model id** — `claude-sonnet-4-6`. No bare aliases; every shipped call site references the constant `AnthropicClient.MODEL_ID`. Model upgrades flow through a superseding ADR + a one-iteration eval-harness re-run before the constant flips.

2. **Prompt caching by default** — the system prompt + the tool definitions are tagged `cache_control: { type: 'ephemeral' }` per Anthropic's caching protocol. Cache hit-rate is tracked in the per-tenant per-day counter (`copilot_cost_counters.cacheReadTokens`).

3. **Tool use over free-text generation** — every operational query goes through a tool, not through the model's free response. v1 ships 10 Sara-cockpit tools (`list_invoices`, `find_supplier_invoice`, `summarise_iva`, `list_customers`, `top_customers`, `top_suppliers`, `intrastat_status`, `monthly_sales`, `monthly_purchases`, `cash_snapshot`). Tools are tenant-scoped + read-only in v1. Marco / Luca / Giulia / Andrea persona sets land in Sprint 27.

4. **Per-tenant per-day token cap** — `tenant.settings.aiCopilot.dailyTokenCap` overrides the per-tier default. `assertWithinCap` runs before every Copilot call; over-cap requests return RFC 7807 403 with the cap reached. Default caps:

   | Tier | Daily token cap |
   |---|---|
   | Base | 50 000 |
   | Professionale | 250 000 |
   | Enterprise | 1 000 000 |

5. **Synthetic-response default** — without `ANTHROPIC_API_KEY` + `ENABLE_ANTHROPIC_LIVE=true` the client returns deterministic synthetic responses. Production wiring lands in Sprint 27 alongside the per-screen Copilot sidebar; until then the orchestrator + tool-call flow is exercisable end-to-end without burning real tokens.

6. **Eval harness from day one** — `CopilotEvalHarness` runs a fixed set of golden questions against the Copilot and grades each turn against a tool-call expectation predicate. Sprint 25 ships Q1-Q5 (Sara). Sprint 26 + Sprint 27 grow the suite to Q15.

7. **Audit + telemetry** — every Copilot turn writes an audit-log entry with action `ai-copilot.ask`, the persona, the tool calls, the input/output token counts. The cost-cap rejections also write an audit entry so the Compliance dashboard surfaces them.

## Consequences

- Positive:
  - Copilot quality is anchored on a frontier Italian-fluent model.
  - Cost is bounded per-tenant — the engineering budget cannot be drained by a runaway tool loop on a single tenant.
  - Synthetic-response default makes the Copilot UI demoable without an API key, and the production wiring is gated by an explicit env flag.
  - Tool-use design makes every Copilot answer cite the source data (the tool result), eliminating the fabrication risk that pure free-text Copilots ship with.
- Negative:
  - Tool definitions need to be maintained as the data model evolves. Mitigation: tool definitions live alongside the entity / projection they query — so the same PR that touches the entity touches the tool.
  - Sprint 25's 10 Sara-cockpit tools cover < 20% of the real Sara surface. Mitigation: Sprint 27 expands to 30 tools across all five personas.
- Neutral:
  - Tool-call rounds are limited to 1 in v1. Multi-turn reasoning (chain-of-tool-calls) lands in Sprint 27 once the eval harness has the regression coverage to back it.

## Alternatives considered

- **Self-hosted open-source model (Llama 3.x, Mixtral)**: deferred. Italian-fiscal reasoning quality on these models is materially worse than `claude-sonnet-4-6` at the v1 evaluation budget. Reconsider at €5M annual revenue or when the open-source gap closes.
- **Different frontier vendor (OpenAI / Google)**: rejected for v1. Anthropic's Claude is the team's chosen frontier vendor based on Italian-language quality + tool-use API ergonomics + prompt caching maturity. Plan §13 already pins the choice.
- **Free-text-only (no tools)**: rejected — fabrication risk on operational data is unacceptable for an ERP.
- **Per-call dollar cap instead of per-day token cap**: rejected for v1 — token budgets are easier to audit + price than dollar budgets that move with vendor pricing.

## References

- Plan §1.6 — "AI-assisted decision support on every page"; §9.17 (AI Copilot module); §13 (AI/ML layer).
- Plan §31.2 Sprint 25 (S25.1..S25.7 — this ADR + the foundation).
- Anthropic Messages API documentation, prompt-caching guide.
- Global rule (CLAUDE.md): pin exact model IDs in shipped code.
- Global rule (CLAUDE.md): default to prompt caching for repeated system prompts and tool definitions.
- Global rule (CLAUDE.md): redact PII / secrets before sending to any LLM (S26 layers a PII redactor in front of the AnthropicClient).
- Global rule (CLAUDE.md): treat model output as untrusted; tool calls run tenant-scoped + read-only in v1.
