# Security Posture — SmartERP

**Profile:** OWASP ASVS v4.0.3 Level 2 (L2) baseline. Level 3 for payment/invoice-critical flows where called out.
**Threat model:** Italian manufacturing SME SaaS multi-tenant ERP; attackers are motivated by fiscal fraud (fake invoices), data theft (client lists, pricing), and ransomware.

---

## 1. Authentication & Session Management

| Control | Implementation |
|---------|----------------|
| Password hashing | `argon2id` m=19456 t=2 p=1 (OWASP 2024 baseline). Legacy `bcrypt` hashes accepted on verification and transparently re-hashed to argon2id on successful login. |
| Login timing | Constant-time verification: on unknown email, a dummy argon2 verify is still run to blunt timing side-channels. |
| Brute-force | ThrottlerGuard (global 120 req/min); tighter per-IP limit on `/auth/login` planned (T-06 in TECHNICAL-DEBT.md). |
| JWT access token | HS256, 15m TTL, signed with `JWT_SECRET` ≥ 16 chars enforced at boot; `issuer: smarterp`, `audience: smarterp-client`. |
| JWT refresh token | HS256, 7d TTL, signed with `JWT_REFRESH_SECRET`; **rotated on every use**; replay detection via `tokenVersion` counter. On replay, all refresh tokens for the user are invalidated. |
| Session storage | Redis `session:<userId>` (profile cache only, non-authoritative). Authoritative state in Postgres. |
| Account lockout | After N failed logins → disable via admin; automatic lockout backlog (T-07). |

---

## 2. Authorisation & Multi-Tenancy

| Control | Implementation |
|---------|----------------|
| RBAC | `UserRole` enum: admin, manager, operator, viewer. Enforced via `RolesGuard`. |
| Tenant isolation | `TenantScopeGuard` — enforces that the JWT `tenantId` claim matches any `tenantId` in the URL, query, body, or `X-Tenant-ID` header. Responds `403 Forbidden` on mismatch and logs `Tenant scope violation` for SIEM routing. |
| Service-layer enforcement | Every repository query is scoped by `tenantId` as a mandatory `where` clause. Code review policy: any new service method missing a `tenantId` parameter fails review. |
| Cross-tenant GET test | Integration test `tenant-isolation.spec.ts` asserts 404 (not 200) when tenant-A GETs tenant-B's sales order. |

---

## 3. Input Validation

- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- DTO classes decorated with `class-validator` (`IsString`, `IsEmail`, `IsEnum`, `IsUUID`, `Length`, `IsDateString`, `Min`, `Max`, `IsOptional`, `ValidateNested`, `Type` from `class-transformer`).
- `ParseUUIDPipe` on every path parameter named `:id` or `:tenantId`.
- JSON parsing max body size enforced by the Express server default (100 kB) — larger payloads fail fast.

---

## 4. HTTP Hardening (Helmet Profile)

```ts
contentSecurityPolicy: prod-only {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:"],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"]
}
hsts: prod-only { maxAge: 63072000, includeSubDomains, preload }
referrerPolicy: no-referrer
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Frame-Options: DENY
```

Development mode loosens CSP for Swagger UI; production is strict.

---

## 5. Data Protection

| Data class | At rest | In transit | Retention |
|------------|---------|------------|-----------|
| Passwords | argon2id (never plaintext) | TLS | Indefinite (hash) |
| JWT secrets | Env var from KMS in prod | N/A | Rotated 90d |
| Invoice XML | Filesystem + S3 with SSE-KMS | TLS + PEC | 10 years (Codice Civile art. 2220) |
| Customer PII | Postgres with TDE enabled | TLS | 10 years |
| Audit logs | Append-only, immutable S3 with object-lock | TLS | 2 years |

---

## 6. Logging & Monitoring

- Structured JSON logs — fields: `event`, `outcome`, `tenantId`, `userId`, `requestId`.
- Never logged: passwords, full JWTs, invoice XMLs, customer VAT numbers.
- Counters exposed at `/metrics` drive SIEM/Prometheus alerts (see `docs/RUNBOOK.md` §6).

---

## 7. Dependency Hygiene

- `npm audit --production` in CI (S4 gate from plan).
- Trivy fs scan + image scan — no CRITICAL / HIGH unless written acceptance.
- Gitleaks and `detect-secrets` pre-commit hooks.
- Semgrep default ruleset + `p/owasp-top-ten` ruleset.

---

## 8. Incident Response

- P1 tenant isolation breach → 72-hour GDPR art. 33 clock. DPO notified. Runbook §3.4.
- Ransomware playbook — cold-storage offline backups daily + monthly.
- SDI outage → queue invoices locally, retry on 1-minute cron, alert ops if queue > 100.

---

## 9. ASVS L2 Crosswalk (abridged — only non-obvious items)

| Req | Implementation |
|-----|----------------|
| V2.1.1 Verify no default credentials shipped | Seed admin password is dev-only; docker-compose env var placeholder. |
| V2.1.9 Allow changing password; require current | `/api/auth/change-password` endpoint — required in CI integration test. |
| V2.2.1 Verify MFA is supported | Scheduled Q3 2026 — TOTP (MFA) track in TECHNICAL-DEBT.md. |
| V3.3.1 Session tokens bound to a device/client | `JwtStrategy` uses audience binding; refresh rotation binds to `tokenVersion`. |
| V5.1.1 Input validation | `ValidationPipe`. |
| V5.2.1 Output encoding | React auto-escapes; XML adapter escapes `<>&'"` in `esc()`. |
| V7.1.1 Logs DO NOT contain sensitive data | Policy enforced at code review. |
| V9.1.1 TLS everywhere | Reverse proxy (ingress) terminates TLS. |
| V11.1.1 Log security-relevant events | All auth/tenant-scope events logged. |
| V14.3 Secure deployment | Docker with Alpine base; helmet; prod CSP. |

Full crosswalk: `docs/SECURITY-SELF-ASSESSMENT.md`.
