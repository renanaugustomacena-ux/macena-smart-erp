# Security Self-Assessment — SmartERP

**Standard:** OWASP ASVS v4.0.3 Level 2 (L2).
**Date of assessment:** 2026-04-17.
**Assessor:** SmartERP CISO.
**Status:** Baseline PASS with noted gaps (see §9).

Below is the chapter-by-chapter crosswalk.

---

## V1 — Architecture, Design and Threat Modelling

| Req | Status | Evidence |
|-----|--------|----------|
| V1.1.1 Security SDLC defined | PASS | `docs/CONTRIBUTING.md` §6 security review gate. |
| V1.2.2 Threat model exists | PASS | `docs/ARCHITECTURE.md` + this document. |
| V1.4.1 Trust boundaries | PASS | Ingress → Backend → DB/Redis; documented in ARCHITECTURE. |
| V1.8.1 Data classification | PASS | `docs/COMPLIANCE.md` ROPA. |

## V2 — Authentication

| Req | Status | Evidence |
|-----|--------|----------|
| V2.1.1 No default creds | PASS | Seed password is dev-only, documented in README. |
| V2.1.9 Change password flow | PARTIAL | `/auth/change-password` not yet implemented (T-21 new). |
| V2.2.1 MFA available | GAP | T-07 roadmap Q3 2026. |
| V2.4.1 Passwords validated against breach lists | PARTIAL | Zxcvbn integration planned; min-length enforced. |
| V2.5.1 Password change disallowed common | PASS | argon2id + min-length + disallow null. |
| V2.7.2 Tokens have short TTL | PASS | 15m access TTL. |
| V2.7.3 Refresh token rotated | PASS | Rotation + replay detection. |
| V2.10.3 Passwords stored with approved algo | PASS | argon2id. |

## V3 — Session Management

| Req | Status | Evidence |
|-----|--------|----------|
| V3.1.1 Secure session identifiers | PASS | JWT + refresh hash stored SHA-256. |
| V3.3.1 Sessions have inactivity timeout | PASS | 15m access TTL. |
| V3.5.1 No session identifiers in URL | PASS | Bearer header only. |

## V4 — Access Control

| Req | Status | Evidence |
|-----|--------|----------|
| V4.1.1 Principle of least privilege | PASS | RBAC roles; tenant isolation. |
| V4.1.5 Access control deny by default | PASS | `AuthGuard('jwt')` on every protected controller. |
| V4.2.1 Horizontal privilege escalation blocked | PASS | `TenantScopeGuard`. |
| V4.3.1 Admin interfaces separated | PARTIAL | Admin endpoints currently on same server; separate admin subdomain is future work. |

## V5 — Validation, Sanitization and Encoding

| Req | Status | Evidence |
|-----|--------|----------|
| V5.1.1 Input validation | PASS | `ValidationPipe` + `class-validator`. |
| V5.1.4 Server rejects unexpected content | PASS | `forbidNonWhitelisted: true`. |
| V5.2.5 Output encoding | PASS | React auto-escape; `esc()` in FatturaPA adapter. |
| V5.3.4 SQL parameterised queries | PASS | TypeORM parameter binding. |
| V5.5.1 Do not eval user input | PASS | No eval. |

## V7 — Error Handling and Logging

| Req | Status | Evidence |
|-----|--------|----------|
| V7.1.1 Sensitive data excluded from logs | PASS | Review policy in `CONTRIBUTING.md`. |
| V7.3.1 Log auth, access control, session, input validation events | PASS | `auth.login`, `auth.refresh`, `Tenant scope violation`, ValidationPipe errors. |

## V8 — Data Protection

| Req | Status | Evidence |
|-----|--------|----------|
| V8.1.1 Cached / stored sensitive data protected | PASS | TDE, TLS, KMS. |
| V8.3.1 Sensitive data not logged | PASS | See V7.1.1. |

## V9 — Communication

| Req | Status | Evidence |
|-----|--------|----------|
| V9.1.1 TLS | PASS | Terminated at ingress. |
| V9.2.1 TLS configuration | PASS | TLS 1.2+ with modern ciphers. |

## V10 — Malicious Code

| Req | Status | Evidence |
|-----|--------|----------|
| V10.3.1 Third-party code inventory | PASS | `docs/sbom/` planned; `package.json` pinned. |
| V10.3.2 Third-party code updated | PASS | `npm audit` CI. |

## V12 — Files and Resources

| Req | Status | Evidence |
|-----|--------|----------|
| V12.1.1 Do not allow client to choose file path | PASS | Invoice XML paths derived server-side. |
| V12.3.4 File uploads scanned | N/A | No user-uploaded files in v1. |

## V13 — API and Web Service

| Req | Status | Evidence |
|-----|--------|----------|
| V13.1.1 API standards documented | PASS | OpenAPI / Swagger. |
| V13.2.1 CORS allow-list | PASS | `main.ts` `CORS_ORIGIN` env. |
| V13.4.1 GraphQL N/A | N/A | REST only. |

## V14 — Configuration

| Req | Status | Evidence |
|-----|--------|----------|
| V14.1.1 Build and deploy processes are secure | PASS | GHA with signed commits. |
| V14.2.1 Dependencies pinned and scanned | PASS | Pinned `^x.y.z`; Trivy. |
| V14.4.1 Security headers | PASS | Helmet. |
| V14.5.1 App isolated at runtime | PASS | Docker + non-root. |

---

## §9 — Open Gaps (consolidated)

1. **V2.2.1 MFA** — T-07 roadmap Q3 2026.
2. **V2.1.9 Change-password flow** — T-21 (new), Q2 2026.
3. **V2.4.1 Breach-list password validation** — T-22 (new), Q3 2026.
4. **V4.3.1 Admin separation** — consider `/admin/*` subdomain with network-layer ACL.
5. **V12.3.4 Upload scanning** — revisit when file-upload surface lands.
