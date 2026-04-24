# SmartERP

**Il gestionale cloud pensato per le PMI manifatturiere di Verona.**
**Cloud ERP purpose-built for the manufacturing SMEs of Mozzecane and Verona, Italy.**

SmartERP is a multi-tenant, cloud-native Enterprise Resource Planning platform
engineered from first principles for the ~4,500 manufacturing SMEs in the
Mozzecane–Verona–Veneto corridor. Six bounded-context modules cover
production, inventory, accounting (with full FatturaPA / SDI compliance per
D.Lgs. 127/2015), sales, tenant management, and authentication. Built for
Italian fiscal reality (Piano dei Conti IV Direttiva CEE, IVA regime matrix,
Conservazione a Norma per DPCM 3/12/2013) and GDPR compliance (Reg. UE 2016/679,
D.Lgs. 196/2003).

## Stack

| Layer           | Technology                            |
|-----------------|---------------------------------------|
| Backend         | NestJS 10 (TypeScript 5, Node 20)     |
| ORM             | TypeORM 0.3 + PostgreSQL 16           |
| Cache / Queues  | Redis 7 + BullMQ                      |
| Frontend        | Next.js 14 (App Router, React 18)     |
| Styling         | Tailwind CSS 3                        |
| Auth            | JWT (15-min access + 7-day refresh, rotating) |
| API Docs        | OpenAPI 3.1 / Swagger UI at `/api/docs` |
| Containers      | Multi-stage Dockerfiles (node:20-alpine, non-root) |
| Orchestration   | Docker Compose (dev) / Kubernetes (prod) |
| CI/CD           | GitHub Actions                        |
| Observability   | Prometheus + OpenTelemetry + Grafana  |

## Quick Start

Prerequisites: Docker 24+, Docker Compose v2, Node 20 (for local dev
without containers), `make` (optional).

```bash
git clone https://github.com/your-org/smarterp.git
cd smarterp
cp .env.example .env
docker compose up --build
```

After the stack is healthy (~60 seconds) the services are available at:

| Service            | URL                                     |
|--------------------|-----------------------------------------|
| Frontend dashboard | http://localhost:3000                   |
| Backend API        | http://localhost:3001/api               |
| Health endpoint    | http://localhost:3001/api/health        |
| Swagger UI         | http://localhost:3001/api/docs          |
| PostgreSQL         | localhost:5432 (user: smarterp)         |
| Redis              | localhost:6379                          |

## Development (without Docker)

```bash
# Backend
cd backend
npm install
npm run start:dev     # nest start --watch

# Frontend (in a second terminal)
cd frontend
npm install
npm run dev           # next dev
```

Environment variables are read from `.env.local` (git-ignored) overriding
`.env`. See [.env.example](.env.example) for the full list.

## Project Structure

```
~/Documents/SmartERP/
├── backend/                      NestJS 10 API (TypeScript)
│   ├── src/
│   │   ├── auth/                 JWT authentication and authorisation
│   │   ├── tenants/              Multi-tenant organisation lifecycle
│   │   ├── inventory/            Products, warehouses, stock ledger
│   │   ├── production/           Production orders and work orders
│   │   ├── sales/                Customers and sales orders
│   │   ├── accounting/           Piano dei Conti, journal, FatturaPA
│   │   ├── config/               Database and other config
│   │   ├── health/               Liveness, readiness, dependency probes
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/                     Jest + Supertest E2E tests
│   ├── Dockerfile
│   ├── package.json, tsconfig.json, nest-cli.json
├── frontend/                     Next.js 14 dashboard (TypeScript)
│   ├── src/app/
│   │   ├── components/           Sidebar, Header, DashboardCard
│   │   ├── page.tsx              Dashboard
│   │   ├── layout.tsx, globals.css
│   ├── public/
│   ├── Dockerfile
│   ├── package.json, next.config.js, tailwind.config.ts, postcss.config.js, tsconfig.json
├── landing-page/                 Italian marketing site (static HTML/CSS)
│   ├── index.html, styles.css, assets/
├── docs/
│   ├── MODUS_OPERANDI.md         13,000+ word strategic and technical blueprint
│   ├── ARCHITECTURE.md
│   ├── API.md
├── .github/workflows/
│   ├── ci.yml                    Lint + test + build + docker + security
│   ├── cd.yml                    Staging → integration → production → health
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── LICENSE                       MIT
```

## Key API Endpoints

| Method | Path                              | Purpose                                |
|--------|-----------------------------------|----------------------------------------|
| GET    | `/api/health`                     | Full health including PG + Redis probes |
| POST   | `/api/auth/login`                 | Issue JWT access + refresh             |
| POST   | `/api/auth/refresh`               | Rotate refresh + issue new access      |
| GET    | `/api/tenants/current`            | Authenticated tenant details           |
| CRUD   | `/api/inventory/products`         | Product catalogue                      |
| CRUD   | `/api/inventory/warehouses`       | Warehouse master                       |
| POST   | `/api/inventory/stock/movements`  | Record movement on the stock ledger    |
| CRUD   | `/api/production/orders`          | Production orders                      |
| POST   | `/api/production/orders/:id/work-orders` | Create work order               |
| CRUD   | `/api/sales/customers`            | Customer master (anagrafica cliente)   |
| CRUD   | `/api/sales/orders`               | Sales orders                           |
| POST   | `/api/accounting/accounts/seed`   | Seed Piano dei Conti IV Dir. CEE       |
| CRUD   | `/api/accounting/entries`         | Journal entries (prima nota)           |
| POST   | `/api/accounting/invoices`        | Create draft FatturaPA invoice         |
| PATCH  | `/api/accounting/invoices/:id/submit` | Queue invoice for SDI             |
| GET    | `/api/accounting/iva-liquidation` | Monthly / quarterly IVA summary        |

Full OpenAPI spec available at `/api/docs` once the backend is running.

## Testing

```bash
cd backend
npm run test             # Unit tests
npm run test:e2e         # E2E against the compose stack
npm run test:cov         # Coverage report
```

The CI pipeline (`.github/workflows/ci.yml`) runs lint, type-check,
unit + integration tests, build, Docker image build, Trivy vulnerability
scan, and `npm audit` on every PR.

## Compliance & Security

- **GDPR**: Reg. UE 2016/679 + D.Lgs. 196/2003 (as amended by D.Lgs. 101/2018).
  Audit logs retained 10 years (art. 2220 Codice Civile).
- **FatturaPA v1.2.2**: full schema support for TD01–TD28 document types.
- **Conservazione a Norma**: integration path for Aruba / InfoCert / Namirial.
- **TLS 1.3**, HSTS, OWASP ASVS L2 baseline.

See `docs/MODUS_OPERANDI.md` (Section 7) for the complete compliance posture.

## Documentation

- [`docs/MODUS_OPERANDI.md`](docs/MODUS_OPERANDI.md) — Strategic + technical + operational blueprint (13,000+ words).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Architectural diagrams, data model, sequence diagrams.
- [`docs/API.md`](docs/API.md) — REST API reference with request/response samples.

## Commercial Tiers

| Plan            | Price (IVA esclusa)        | Included                                                  |
|-----------------|----------------------------|-----------------------------------------------------------|
| Base            | €99 / user / month         | Up to 3 users, single warehouse, core 4 modules, FatturaPA |
| Professionale   | €199 / user / month        | Up to 15 users, full 6 modules, multi-warehouse, API      |
| Enterprise      | Custom (€349–€599+ typ.)   | Multi-company, advanced BI, dedicated CSM, 24/7 SLA       |

## License

[MIT License](LICENSE) — Copyright (c) 2026 SmartERP Contributors.

---

*SmartERP — pensato a Mozzecane, costruito per il tessuto manifatturiero italiano.*
