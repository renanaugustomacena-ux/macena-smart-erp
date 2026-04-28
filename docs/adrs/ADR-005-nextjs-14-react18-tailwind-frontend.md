# ADR-005 — Next.js 14 App Router + React 18 + Tailwind for the frontend

- **Status**: Accepted 2026-04-28 (inherited; ratified)
- **Date**: 2026-04-28
- **Owner**: CTO + Frontend Lead

## Context

The product needs server-rendered initial loads for dashboards (LCP <2.5s per Web rules), client-side interactivity (reactive forms, real-time-ish updates), TypeScript-typed data fetching, and PWA support for shop-floor mobile (per ADR-026). Next.js 14 with App Router covers all four with a mature ecosystem and the Italian-developer hiring pool's familiarity.

## Decision

Next.js 14 with App Router. React 18 with React Server Components used selectively (page shells; client components for interactive widgets). Tailwind CSS 3 with project-specific design tokens (per plan §29.8). PWA via the `next-pwa` plugin.

## Consequences

- Positive:
  - SSR-by-default; React Server Components for data-heavy pages; route-level code-splitting; image optimisation; mature SEO support.
  - Italian-developer pool familiarity (the largest framework with Italian practitioner density).
- Negative:
  - Vercel's default deployment is fastest; self-hosting requires Edge Runtime considerations (we self-host).
  - React 18 + RSC is a moving target; require occasional version upgrades.
- Neutral:
  - Tailwind utility classes can clutter JSX; we adopt the pattern with per-feature component-co-located styles per Web rules.

## Alternatives considered

- **Remix**: rejected — smaller ecosystem; less mature SSR caching at our use case scale.
- **SvelteKit**: rejected — smaller TypeScript-developer pool in Italy; less mature dashboard patterns.
- **Vue 3 + Nuxt**: rejected — team prefers React; smaller hiring pool with NestJS+Vue combo.
- **Astro**: rejected — built more for content sites than data-heavy dashboards; PWA support thinner.

## References

- Plan §1.4, §5, §29.8.
- Existing `frontend/` directory.
- MODUS_OPERANDI §4.
