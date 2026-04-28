# ADR-007 — JWT (HS256 dev / RS256 prod) with rotating refresh tokens

- **Status**: Accepted 2026-04-28 (inherited; ratified)
- **Date**: 2026-04-28
- **Owner**: CISO + CTO

## Context

The platform needs stateless auth that scales horizontally (a backend pod can be killed and replaced without session loss). The platform also needs revocability (a stolen token must be invalidatable). Pure stateless JWT cannot revoke without an external denylist. Pure server-side sessions don't scale as cheaply.

The OWASP ASVS L2 baseline (per plan §11.2) and NIST SP 800-63B specify the controls.

## Decision

A hybrid auth model:

- Access token: JWT, 15-minute TTL, signed with HS256 in development and RS256 in production (private key in AWS KMS); claims include `sub` (userId), `tenantId`, `role`, `plan`, `tokenVersion`, `iat`, `exp`, `iss=smarterp`, `aud=smarterp-client`. Algorithm pinned per RFC 8725 (no `alg: none`).
- Refresh token: JWT, 7-day TTL, signed with a separate `JWT_REFRESH_SECRET`; rotated on every use (the new refresh's `tokenVersion` increments by 1; the previous refresh is invalidated).
- Replay detection: if a refresh is presented but its `tokenVersion` doesn't match the user's current `tokenVersion`, all refresh tokens for the user are invalidated (full session reset); a security alert fires.
- Token version counter: stored on the user row; incrementable to "log out everywhere".
- Argon2id for password hashing (per ADR-S03; m=19456 t=2 p=1 per OWASP 2024).
- Per-IP throttle on `/auth/login` (5/min/IP).
- Account lockout after 5 failed login attempts; auto-cooldown 15 min; exponential backoff on repeat lockouts.

## Consequences

- Positive:
  - Scales horizontally (no Redis lookup on the hot path for token verification).
  - Revocation possible via tokenVersion bump (single DB UPDATE).
  - 15-minute access window limits stolen-token blast radius.
  - Rotating refresh + replay detection produces a fail-loud bad-actor signal.
- Negative:
  - 15-minute window for a stolen access token to be misused (acceptable; mitigated by IP-binding option in v3 per the security backlog).
  - Refresh-rotation requires careful client-side handling (the SDK at plan §7 helps).
- Neutral:
  - Requires the `tokenVersion` column on the user row; small storage overhead.

## Alternatives considered

- **Server-side sessions only**: rejected — extra Redis lookup per request; revocation easier but cost in latency; doesn't scale as cheaply.
- **JWT without refresh**: rejected — forces re-login every 15 min; user-experience cost.
- **JWT with long TTL (24h)**: rejected — stolen-token blast radius too long.
- **PASETO / Macaroons**: rejected — smaller ecosystem; JWT is the established standard.

## References

- Plan §2.4, §11.2.
- Existing `backend/src/auth/`, `auth.service.ts`, `auth.module.ts`.
- RFC 8725 best practices.
- NIST SP 800-63B.
- OWASP ASVS V2 + V3.
- LIB-12:04_Security_Cryptography.
- SECURITY.md §1.
