# SmartERP — Technical Architecture

This document complements `MODUS_OPERANDI.md` Section 4 with concrete
architectural diagrams, the canonical data model, and sequence diagrams
for the four load-bearing user journeys.

---

## 1. System Overview

```
                           +────────────────────────+
                           │   Ingress / Traefik     │
                           │   TLS 1.3 + HSTS        │
                           +────────────┬───────────+
                                        │
                       +────────────────+───────────────+
                       │                                │
             +─────────v─────────+           +─────────v─────────+
             │  Next.js 14       │           │  Landing page     │
             │  App Router       │           │  (static HTML/CSS)│
             │  Port 3000        │           │  served via CDN   │
             +─────────┬─────────+           +───────────────────+
                       │ JSON + JWT over HTTPS
                       │
             +─────────v─────────+
             │  NestJS 10 API    │
             │  Port 3001        │
             │  /api/v1/*        │
             │                   │
             │  Interceptors:    │
             │  • Logging (Pino) │
             │  • Tracing (OTEL) │
             │  • RBAC           │
             │  • Rate-limit     │
             +──┬─────┬─────┬────+
                │     │     │
     +──────────v+ +──v──+ +v──────────+
     │ PostgreSQL│ │Redis│ │  BullMQ   │
     │  16       │ │  7  │ │  (queue)  │
     │ (tenant_id│ │(cache │ │(jobs)   │
     │  scoped)  │ │sessions│ │         │
     +───────────+ +─────+ +───────────+
```

Per MODUS_OPERANDI Section 4.1 the backend is a modular monolith — one
deployable, many bounded-context modules. Per Section 4.6 multi-tenancy
is enforced at the service and repository layer by a mandatory
`tenantId` clause in every query, with a `TenantGuard` double-checking
JWT scope at controller boundary.

---

## 2. NestJS Module Graph

```
backend/src/
├── main.ts                    Bootstrap: Helmet, CORS, ValidationPipe,
│                              Swagger, graceful shutdown hooks
├── app.module.ts              Composition root — imports all features
│
├── config/
│   └── database.config.ts     TypeORM PostgreSQL datasource + pool
│
├── health/                    Liveness / readiness / full health probes
│   ├── health.module.ts
│   └── health.controller.ts   Probes PG + Redis with 1-s timeout
│
├── auth/                      JWT issuance + refresh-token rotation
│   ├── auth.module.ts
│   ├── auth.controller.ts     /api/auth/{login, register, refresh, profile, logout}
│   └── auth.service.ts        bcrypt 12 + Passport JWT strategy
│
├── tenants/                   Organisation lifecycle + plan management
│   ├── tenants.module.ts
│   ├── tenants.controller.ts  /api/tenants
│   ├── tenants.service.ts     Create, update, suspend, activate
│   └── tenant.entity.ts       SubscriptionPlan enum: base | professionale | enterprise
│
├── inventory/                 Products, warehouses, stock ledger
│   ├── inventory.module.ts
│   ├── inventory.controller.ts /api/inventory/{products, warehouses, stock}
│   ├── inventory.service.ts    Eight-type stock movement engine
│   └── inventory.entity.ts     Product, Warehouse, StockLevel, StockMovement
│
├── production/                Production and work orders with state machine
│   ├── production.module.ts
│   ├── production.controller.ts /api/production/{orders, work-orders, dashboard}
│   └── production.service.ts    ProductionOrder + WorkOrder entities + KPI aggregation
│
├── sales/                     Customers and sales orders
│   ├── sales.module.ts
│   ├── sales.controller.ts    /api/sales/{customers, orders}
│   ├── sales.service.ts
│   └── sales.entity.ts        Customer, SalesOrder with FatturaPA-ready fields
│
└── accounting/                Piano dei Conti, Prima Nota, FatturaPA
    ├── accounting.module.ts
    ├── accounting.controller.ts /api/accounting/{accounts, entries, invoices, iva-liquidation}
    ├── accounting.service.ts    Double-entry enforcement, IVA aggregation
    └── accounting.entity.ts     ChartOfAccount, JournalEntry, Invoice (TD01–TD28)
```

---

## 3. Request Pipeline

```
Incoming HTTP request
        │
        ▼
[Ingress TLS termination + HSTS]
        │
        ▼
[CORS preflight check]
        │
        ▼
[Helmet security headers]
        │
        ▼
[Global /api prefix stripping]
        │
        ▼
[ThrottlerGuard — rate limit via Redis]
        │
        ▼
[ValidationPipe — whitelist + forbidNonWhitelisted + transform]
        │
        ▼
[AuthGuard — JWT verify, extract tenant_id + user_id]
        │
        ▼
[Controller method]
        │
        ▼
[Service method — tenant-scoped query/cache]
        │
        ▼
[TypeORM Repository ←→ PostgreSQL]
        │                  ↑
        └──[Redis cache-aside for list queries]
        │
        ▼
[Interceptor — logs latency, emits OTEL span, adds X-Request-ID]
        │
        ▼
JSON response
```

---

## 4. Data Model (PostgreSQL 16)

Every table below includes `tenant_id uuid NOT NULL` (composite index
first position) and, where applicable, `created_at`, `updated_at`. The
schema is expressed in TypeORM entity classes under
`backend/src/<module>/*.entity.ts`.

### 4.1 Tenancy

```
tenants(id uuid PK, name, vat_number (partita IVA 11), fiscal_code,
        sdi_destination_code (7), pec_email, billing_address, billing_city,
        billing_postal_code (5), billing_province (2), billing_country (2),
        plan (base|professionale|enterprise), status (trial|active|past_due|
        suspended|cancelled), seat_limit, trial_ends_at, settings jsonb,
        created_at, updated_at)

users(id uuid PK, tenant_id FK→tenants, first_name, last_name,
      email UNIQUE, password_hash (bcrypt 12), role (admin|manager|
      operator|viewer), phone, partita_iva, refresh_token_hash,
      is_active, last_login_at, created_at, updated_at)
```

### 4.2 Inventory

```
products(id uuid PK, tenant_id FK, sku, name, description,
         category (raw_material|semi_finished|finished_product|
         consumable|packaging|spare_part),
         unit_of_measure (pz|kg|g|l|m|mq|mc|box|pallet),
         unit_cost (12,2), selling_price (12,2), weight (10,2),
         barcode, minimum_stock, reorder_point, reorder_quantity,
         lead_time_days, supplier, is_active, metadata jsonb,
         created_at, updated_at)
         UNIQUE(tenant_id, sku)

warehouses(id uuid PK, tenant_id FK, code, name, address, city,
           postal_code (5), province (2), contact_person, contact_phone,
           capacity_sqm (10,2), zones jsonb, is_active,
           created_at, updated_at)
           UNIQUE(tenant_id, code)

stock_levels(id uuid PK, tenant_id FK, product_id FK, warehouse_id FK,
             qty_on_hand (12,2), qty_reserved (12,2), qty_on_order (12,2),
             zone, location, last_count_date, updated_at)
             UNIQUE(tenant_id, product_id, warehouse_id)

stock_movements(id uuid PK, tenant_id FK, product_id FK,
                movement_type (inbound|outbound|transfer|adjustment|
                production_consumption|production_output|return|scrap),
                quantity (12,2), source_warehouse_id, destination_warehouse_id,
                reference_number, notes, performed_by, unit_cost_at_time,
                created_at)
```

### 4.3 Production

```
production_orders(id uuid PK, tenant_id FK, order_number,
                  product_name, product_id, quantity_planned (12,2),
                  quantity_produced (12,2),
                  status (draft|planned|confirmed|in_progress|completed|cancelled),
                  priority (low|normal|high|urgent),
                  planned_start_date, planned_end_date,
                  actual_start_date, actual_end_date,
                  notes, customer_reference, estimated_cost, actual_cost,
                  bill_of_materials jsonb, created_at, updated_at)
                  UNIQUE(tenant_id, order_number)

work_orders(id uuid PK, tenant_id FK, production_order_id FK,
            work_order_number, operation_name, work_center,
            sequence_number, status (pending|ready|in_progress|paused|
            completed|cancelled),
            estimated_duration_hours, actual_duration_hours,
            started_at, completed_at, assigned_to, instructions,
            quantity_produced, quantity_rejected, quality_checks jsonb,
            created_at, updated_at)
```

### 4.4 Sales

```
customers(id uuid PK, tenant_id FK, code, name,
          customer_type (business|public_administration|individual|foreign),
          vat_number (11), fiscal_code (16), sdi_destination_code (7),
          pec_email, email, phone, address, city, postal_code (5),
          province (2), country (2), default_iva_rate, payment_terms_days,
          split_payment bool, is_active, notes jsonb,
          created_at, updated_at)
          UNIQUE(tenant_id, code)

sales_orders(id uuid PK, tenant_id FK, order_number, customer_id FK,
             status (draft|confirmed|partially_shipped|shipped|invoiced|cancelled),
             order_date, requested_delivery_date, customer_po_reference,
             subtotal_amount, tax_amount, total_amount, notes,
             lines jsonb, created_at, updated_at)
             UNIQUE(tenant_id, order_number)
```

### 4.5 Accounting

```
chart_of_accounts(id uuid PK, tenant_id FK, code, description,
                  type (asset|liability|equity|revenue|expense|cogs|other),
                  parent_code, is_active, is_bank_account,
                  created_at, updated_at)
                  UNIQUE(tenant_id, code)

journal_entries(id uuid PK, tenant_id FK, reference, entry_date, journal,
                description, lines jsonb, total_debit, total_credit,
                is_posted, created_at, updated_at)

invoices(id uuid PK, tenant_id FK,
         document_type (TD01|TD02|TD04|TD05|TD17|TD18|TD19|TD24|TD26),
         number, fiscal_year, invoice_date,
         customer_id FK, customer_name, customer_vat_number,
         customer_fiscal_code, customer_sdi_code, customer_pec_email,
         status (draft|queued|sent|received|accepted|rejected|
                 not_delivered|expired|cancelled),
         subtotal_amount, tax_amount, total_amount, lines jsonb,
         xml_path, receipt_path, archive_path,
         submitted_at, archived_at, notes,
         created_at, updated_at)
         UNIQUE(tenant_id, number, fiscal_year)
```

### 4.6 Audit

```
audit_log(id uuid PK, tenant_id FK, user_id FK, action,
          resource_type, resource_id, payload_before jsonb,
          payload_after jsonb, ip_address, user_agent,
          correlation_id, timestamp)
          -- Partitioned quarterly; 10-year retention via Glacier archive
```

---

## 5. Sequence Diagrams

### 5.1 Login

```
Client            NestJS Auth         PostgreSQL        Redis
  │                   │                   │               │
  │── POST /auth/login────────────────────▶               │
  │                   │── SELECT user WHERE email=?──────▶│
  │                   │◀──────────────────│               │
  │                   │                   │               │
  │                   │── bcrypt.compare(password, hash) │
  │                   │                   │               │
  │                   │── sign access JWT (15 min)       │
  │                   │── sign refresh JWT (7 d)         │
  │                   │                   │               │
  │                   │── UPDATE users SET refresh_token_hash, last_login_at
  │                   │──────────────────▶│               │
  │                   │                   │               │
  │                   │── SET session:<userId> {uid,role,tenantId} EX 3600
  │                   │──────────────────────────────────▶│
  │                   │                   │               │
  │◀──{accessToken, refreshToken, expiresIn:3600, user}──│
```

### 5.2 Create Invoice (FatturaPA)

```
Client       NestJS Accounting      PostgreSQL      Redis            BullMQ
  │              │                      │              │                 │
  │── POST /accounting/invoices ────────▶                                │
  │              │                      │              │                 │
  │              │── count invoices WHERE tenant+fiscal_year ─▶          │
  │              │◀─────────────────────│              │                 │
  │              │                      │              │                 │
  │              │── compute subtotal, tax, total per line               │
  │              │                      │              │                 │
  │              │── INSERT invoice (status=draft) ────▶                 │
  │              │◀─────────────────────│              │                 │
  │              │                      │              │                 │
  │              │── DEL invoices:<tenant>:*  (cache invalidation)       │
  │              │─────────────────────────────────────▶                 │
  │              │                      │              │                 │
  │◀── 201 Created {invoice}             │              │                 │
  │              │                      │              │                 │
  │── PATCH /invoices/:id/submit ────────▶                                │
  │              │── SELECT invoice WHERE id, tenant ─▶                  │
  │              │◀─────────────────────│              │                 │
  │              │── UPDATE status=queued, submitted_at=now()            │
  │              │──────────────────────▶              │                 │
  │              │                      │              │                 │
  │              │── enqueue 'sdi-submit' job with invoiceId ───────────▶│
  │              │                      │              │                 │
  │◀── 200 OK {invoice(status=queued)}                                   │
  │              │                      │              │                 │
  │                                                              [Worker] │
  │                                                                  │    │
  │                                                    Generate FatturaPA │
  │                                                    v1.2.2 XML        │
  │                                                    Sign (XAdES)      │
  │                                                    POST to SDI       │
  │                                                    intermediary      │
  │                                                                  │    │
  │                                                    [on receipt]      │
  │                                                    UPDATE status,    │
  │                                                    receipt_path      │
```

### 5.3 Stock Movement

```
Client       NestJS Inventory       PostgreSQL      Redis
  │              │                       │              │
  │── POST /inventory/stock/movements ───▶              │
  │              │                       │              │
  │              │── SELECT product WHERE id, tenant ──▶│
  │              │◀──────────────────────│              │
  │              │                       │              │
  │              │── BEGIN TRANSACTION                  │
  │              │                       │              │
  │              │── INSERT stock_movement ─────────────▶│
  │              │◀──────────────────────│              │
  │              │                       │              │
  │              │   depending on movement_type:        │
  │              │   INBOUND | OUTBOUND | TRANSFER | …  │
  │              │── UPSERT stock_levels qty_on_hand ──▶│
  │              │◀──────────────────────│              │
  │              │                       │              │
  │              │   if qty_on_hand < 0: throw 400      │
  │              │                       │              │
  │              │── COMMIT                              │
  │              │                       │              │
  │              │── check product.reorder_point;       │
  │              │   if crossed: emit LOW_STOCK alert   │
  │              │                       │              │
  │              │── DEL products:<tenant>:* ──────────▶│
  │              │                       │              │
  │◀── 201 Created {movement}             │              │
```

### 5.4 Create Production Order → Work Orders → Completion

```
Client       NestJS Production       PostgreSQL       NestJS Inventory
  │                │                       │                │
  │── POST /production/orders ────────────▶                 │
  │                │── generate order_number (PO-2026-NNNNN)│
  │                │── INSERT production_orders (draft) ───▶│
  │                │◀──────────────────────│                │
  │◀── 201 Created {productionOrder}       │                │
  │                                        │                │
  │── POST /production/orders/:id/work-orders ──────────────▶│
  │                │── INSERT work_orders (pending) ───────▶│
  │                │◀──────────────────────│                │
  │                                        │                │
  │── PATCH /production/orders/:id/status {confirmed} ──────▶│
  │                │── state-machine check (draft→planned   │
  │                │   →confirmed→…) — BadRequest on invalid│
  │                │── UPDATE production_orders.status      │
  │                │──────────────────────▶                 │
  │                                                          │
  │── PATCH /production/work-orders/:id/status {in_progress}▶│
  │                │── UPDATE work_orders.status=in_progress │
  │                │── startedAt = now()                     │
  │                │── trigger: stock PRODUCTION_CONSUMPTION ▶│── update stock_levels ─▶ PG
  │                │                                         │
  │── PATCH /production/work-orders/:id/status {completed,qty=995,rejected=5}
  │                │── UPDATE work_orders (completed_at,     │
  │                │   actual_duration_hours, qualities)     │
  │                │── trigger: stock PRODUCTION_OUTPUT ─────▶│── update stock_levels ─▶ PG
  │                │── update parent production_order        │
  │                │   quantity_produced                     │
```

---

## 6. Caching Strategy

| Key pattern                           | TTL   | Purpose                               |
|---------------------------------------|-------|---------------------------------------|
| `session:<userId>`                    | 1 h   | Authenticated user session            |
| `profile:<userId>`                    | 5 min | User-profile read-through cache       |
| `products:<tenantId>:<queryHash>`     | 60 s  | Paginated product-list cache          |
| `warehouses:<tenantId>`               | 5 min | Warehouse list                        |
| `ref:currencies` / `ref:countries`    | 24 h  | Immutable reference data              |
| `rate:<ip>:<endpoint>`                | 60 s  | Rate-limiter counter                  |

Eviction: `allkeys-lru` with 256 MB dev / 1 GB production memory cap.

---

## 7. Security Architecture (Quick Reference)

- TLS 1.3 with HSTS (`max-age=31536000; includeSubDomains; preload`)
- JWT access 15 min + refresh 7 d with rotation-on-use
- Bcrypt cost 12
- OWASP ASVS L2 baseline
- OWASP Top 10 mitigations: input validation (class-validator),
  parameterised queries (TypeORM), CSP / XCTO / Referrer-Policy,
  rate limiting, RBAC, audit log
- GDPR (Reg. UE 2016/679, D.Lgs. 196/2003) as data processor with DPA
- FatturaPA v1.2.2 compliance (D.Lgs. 127/2015 art. 1)
- Conservazione a Norma (DPCM 3/12/2013, AgID Circolari)

See `docs/MODUS_OPERANDI.md` Sections 7 and 12 for the complete
compliance posture.

---

## 8. Deployment Topology

Development: single-host `docker-compose` (backend, frontend, Postgres,
Redis).

Staging / production: Kubernetes (AWS EKS in eu-south-1 Milano):

- Backend Deployment: 2–10 replicas, HPA CPU 70%, resources 250m/256Mi
  → 1000m/1Gi.
- Frontend Deployment: 2–5 replicas, HPA CPU 70%.
- PostgreSQL: AWS RDS Aurora PostgreSQL 16, Multi-AZ, read replica for
  reporting.
- Redis: AWS ElastiCache for Redis, Multi-AZ with Sentinel.
- Ingress: Nginx Ingress Controller + cert-manager + Let's Encrypt.
- CDN: CloudFront for static assets.
- Secrets: AWS Secrets Manager + SOPS-encrypted manifests in Git.
- Observability: CloudWatch + OTEL Collector → X-Ray + Grafana Cloud.

See `docs/MODUS_OPERANDI.md` Section 8 for DevOps depth.
