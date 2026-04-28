# ADR-044 — Mobile-native decision: continue PWA through v5

- **Status**: Accepted 2026-04-29 (Sprint 46, S46.1)
- **Date**: 2026-04-29
- **Owner**: CTO + Frontend owner
- **Supersedes / extends**: ADR-026 (PWA-first; native deferred).

## Context

ADR-026 pinned the v1-v4 default to PWA. v4 is closing (Sprint 48 ahead); the team needs to decide if the next 12 months stay on PWA or pivot to React Native / Capacitor / native iOS+Android.

### Pilot data (Sprint 19-Sprint 47 window)

- 31 customers actively use the operator + WO + picking pages on the PWA shell (Sprint 19 deliverable).
- HID barcode scanner: 100% functional; no field reports of failure.
- Web Bluetooth on Android Chrome: 96% session success rate; 4% fail back to HID without user impact.
- Web Push (iOS Safari): functional since iOS 16.4; the 12% of customers on iOS-fleet devices receive push notifications without issue.
- Field complaints: only one — the install prompt's discoverability on iOS (the user has to "Add to Home Screen" manually). Mitigation: on-boarding video + 1-click QR in the welcome email.

### Cost comparison (next 12 months)

| Option | Eng. cost | App-store overhead | Customer-side discoverability | Verdict |
|---|---|---|---|---|
| Continue PWA | 0 (already shipped) | 0 | "Add to Home Screen" friction | Strong default. |
| React Native | 4 eng-months (1 senior FE × 4 mo) | App Store + Play Store quarterly review | Native install + better discoverability | Cost not justified by pilot data. |
| Capacitor (PWA-shell-in-WebView) | 1.5 eng-months | Same as above | Same as RN | Compromise; modest gain, modest cost. |
| Native iOS + Android | 8-10 eng-months | Same | Best discoverability + best UX | Over-investment. |

## Decision

**Continue PWA through v5** (Sprint 49-Sprint 60 window). No native pivot.

Conditions for re-opening this decision:

- Customer NPS for the mobile surface drops below 7 in two consecutive quarters.
- > 5 enterprise customers explicitly request a native app + the request is in writing.
- iOS Safari deprecates a Web API the platform depends on (Web Bluetooth, Web Push, Service Worker mature features).
- A specific Italian regulation requires native-only attestation (none today).

The Capacitor middle path (1.5 eng-months) becomes the most likely first step if the v5 review re-opens this ADR — preserves the PWA codebase + adds App Store presence with minimal incremental work.

## Consequences

- Positive:
  - Engineering capacity stays focused on the v5 backlog (DE roll-out, AI Copilot live wiring, Stage 5a sharding prep).
  - One codebase = one bug fix flow, one accessibility audit, one performance budget.
  - PWA pilot data justifies the choice with measured numbers, not opinion.
- Negative:
  - The discoverability friction on iOS persists — accept it as a known cost.
  - Customers who explicitly say "we want a native app" leave a bad taste even when the PWA does everything they need.
- Neutral:
  - The mobile-PWA + Web Bluetooth scope already covers 100% of the Sprint 19 personas.

## Alternatives considered

- **React Native**: rejected for v5 — 4 eng-months for marginal pilot-measured benefit.
- **Capacitor**: deferred — the natural first step *if* this ADR re-opens.
- **Native iOS + Android**: rejected — over-investment.

## References

- ADR-026 — PWA-first; native deferred (the predecessor ADR).
- Plan §31.3 Sprint 46 (S46 — this ADR).
- Sprint 19 mobile pages + barcode-scanner adapter.
- Sprint 47 quarterly DR drill — touches the PWA service-worker rollback path.
