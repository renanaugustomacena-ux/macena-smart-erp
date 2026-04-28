# ADR-006 — Italian as the source language for product copy

- **Status**: Accepted 2026-04-28
- **Date**: 2026-04-28
- **Owner**: UX Lead + CEO

## Context

The customer is Italian. Translations from English to Italian are routinely awkward and produce stilted Italian (witness any major SaaS product translated by a non-Italian team). UX research is in Italian. Sales is in Italian. Marketing is in Italian. The personas (Marco, Sara, Luca, Giulia, Andrea, Federico, Elena per plan §4) are Italian.

Localisation drift kills credibility: a customer who finds a German loanword in the UI questions every other detail.

## Decision

Italian is the source language for all product-facing copy:

- The `frontend/src/locales/it.json` is the authoritative key set.
- Other locales (`en.json`, `de.json`, future `de.json` for German cross-border, `es.json` for Spanish Phase 4+, `fr.json` for French Phase 4+) are projections derived from Italian.
- Missing translations fall back to Italian (not to English).
- Code comments stay in English (broader contributor pool, future hires; per R-P07).
- Architecture, ADR, and engineering docs in English (the contributor pool).
- Every UX-research session, every marketing copy, every customer-facing PDF: Italian-first.

## Consequences

- Positive:
  - The product *feels* Italian; commercialisti and operators trust it.
  - No "translated from English" awkwardness.
  - Marketing copy and product copy share the same source.
  - First-mover positioning vs Odoo / NetSuite / Dynamics (whose Italian translations are a constant complaint per LIB-01).
- Negative:
  - Future market expansion (Spain, France, Germany) requires a structured "rebase the source language" exercise; non-trivial but planned for Phase 4-5 per ADR-047.
- Neutral:
  - Engineering team needs at least one Italian-native PR reviewer for product-copy changes.

## Alternatives considered

- **English source with Italian translation**: rejected — produces stilted Italian; loses the persona-language alignment that is core to the differentiation strategy.
- **English source with per-locale translation by professional Italian translator**: rejected for v1-v4 — adds cost and latency; reconsider for v5+ when scaling internationally.

## References

- Plan §1.4, §4.1, §5.8.
- Frontend `src/locales/it.json` is the authoritative key set.
- Portfolio CLAUDE.md (Italian-language convention).
