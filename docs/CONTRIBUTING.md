# Contributing — SmartERP

Thank you for your interest. This document lays out the conventions and review process for contributing to SmartERP.

---

## 1. Development Setup

```
git clone https://github.com/your-org/smarterp.git
cd smarterp
cp .env.example .env.local   # edit secrets
docker compose up --build
```

For backend-only rapid iteration:
```
cd backend
npm install
npm run start:dev
```

---

## 2. Branch & Commit Conventions

- Branch names: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`, `docs/<scope>`.
- Commit messages follow Conventional Commits: `feat(inventory): add reservation release`. A linting check blocks malformed messages at pre-push.

---

## 3. Testing

- Every new service method comes with a Jest unit test (`<module>.spec.ts`) asserting the happy path and one failure path.
- Every new controller comes with a supertest E2E test asserting the route is tenant-scoped (cross-tenant GET returns 404).
- Coverage ratchet: new code must keep the file's line coverage ≥ previous ratchet.
- Run locally: `npm test` for unit, `npm run test:e2e` for integration.

---

## 4. Pull Requests

- Target branch: `main`.
- CI runs: lint → unit tests → E2E (docker-compose spin-up) → Trivy fs + image → Semgrep → Gitleaks → Hadolint → npm audit.
- All CI jobs must be green before a reviewer is auto-requested.
- A squash-merge strategy is used; PR title becomes the merged commit message.

---

## 5. Code Style

- `npm run format` before committing (Prettier).
- `npm run lint` — ESLint with `@typescript-eslint/recommended`, `eslint-plugin-prettier`, `eslint-config-prettier`.
- No `any`. Prefer `unknown` + narrowing.
- Services that touch the database use `@InjectRepository(...)` and an explicit `tenantId` argument.

---

## 6. Security Review

- Any change touching auth, tenants, invoices, or payments flags the `security-review` label.
- The security reviewer rota is maintained by the CISO. Reviews must complete within 2 business days.

---

## 7. Documentation

- Any public API change updates `docs/API.md` and the OpenAPI spec.
- Any regulatory-citation change updates `docs/ITALIAN-COMPLIANCE.md` with the new URL + access-date.
- Major architectural changes update `docs/ARCHITECTURE.md` and add an ADR under `docs/adr/`.

---

## 8. Releasing

- Versions follow SemVer.
- `docs/CHANGELOG.md` is updated as part of the PR that introduces a user-visible change.
- Release tags are signed by a member of the release rota.
