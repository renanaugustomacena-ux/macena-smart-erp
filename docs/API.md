# SmartERP — REST API Reference

**Base URL (development)**: `http://localhost:3001/api`
**Base URL (production)**:  `https://api.smarterp.it/api`
**Interactive Swagger UI**: `/api/docs`
**OpenAPI 3.1 JSON**:       `/api/docs-json`

All endpoints return JSON (`application/json; charset=utf-8`).
Protected endpoints require a Bearer JWT token in the
`Authorization: Bearer <token>` header. See Section *Error Responses*
at the bottom for the shared error envelope per RFC 7807.

## Authentication Scopes

| Scope                | Applies To                                      |
|----------------------|-------------------------------------------------|
| `public`             | Health, auth register/login/refresh             |
| `authenticated`      | Any JWT-valid user                              |
| `role:admin`         | Tenant administration, user management          |
| `role:manager`       | Inventory, production, sales, accounting write  |
| `role:operator`      | Production and inventory write                  |
| `role:viewer`        | Read-only                                        |
| `tenant`             | Request is scoped to the JWT's tenant_id        |

---

## Health

### `GET /api/health`
Full health probe including dependency status.
**Scope**: public.

Response 200:
```json
{
  "status": "ok",
  "service": "smarterp-backend",
  "version": "1.0.0",
  "build_sha": "a1b2c3d",
  "uptime_seconds": 12345,
  "time": "2026-04-17T08:30:00.000Z",
  "dependencies": {
    "postgres": { "status": "up", "latencyMs": 2 },
    "redis":    { "status": "up", "latencyMs": 1 }
  }
}
```

Response 200 (degraded): `status` becomes `degraded` or `down` when a
dependency probe fails; the specific dependency block includes
`status: "down"` and `error: "<message>"`.

### `GET /api/health/live`
Kubernetes liveness. Always `200` unless process is dead.
```json
{ "status": "alive" }
```

### `GET /api/health/ready`
Readiness probe. Returns `200` with `status: "ready"` when all
dependencies are UP; `status: "not_ready"` (also HTTP 200 so Kubernetes
can evaluate the body) when any dependency is DOWN.

---

## Authentication

### `POST /api/auth/register`
**Scope**: public.

Request body:
```json
{
  "firstName": "Mario",
  "lastName": "Rossi",
  "email": "mario@meccanica-rossi.it",
  "password": "SicurezzaComplessa123!",
  "companyName": "Meccanica Rossi SRL",
  "phone": "+39 045 123 4567",
  "partitaIva": "12345678901"
}
```

Response 201:
```json
{
  "message": "Registration successful",
  "user": {
    "id": "7a5c4f1e-…",
    "email": "mario@meccanica-rossi.it",
    "firstName": "Mario",
    "lastName": "Rossi",
    "companyName": "Meccanica Rossi SRL"
  }
}
```

Errors: `409` email already registered; `400` validation failure.

### `POST /api/auth/login`
**Scope**: public. Rate-limited at 5 req/min/IP.

Request body:
```json
{ "email": "mario@meccanica-rossi.it", "password": "SicurezzaComplessa123!" }
```

Response 200:
```json
{
  "accessToken": "eyJhbGci…",
  "refreshToken": "eyJhbGci…",
  "expiresIn": 3600,
  "user": {
    "id": "7a5c4f1e-…",
    "email": "mario@meccanica-rossi.it",
    "firstName": "Mario",
    "lastName": "Rossi",
    "role": "admin",
    "companyName": "Meccanica Rossi SRL"
  }
}
```

Errors: `401` invalid credentials; `429` rate-limited.

### `POST /api/auth/refresh`
**Scope**: public (token-bearing).

Request body: `{ "refreshToken": "eyJhbGci…" }`

Response 200: `{ "accessToken": "…", "refreshToken": "…", "expiresIn": 3600 }`

Errors: `401` invalid or expired refresh token.

### `GET /api/auth/profile`
**Scope**: authenticated.

Response 200: profile object with `id, email, firstName, lastName, role,
companyName, phone, partitaIva, lastLoginAt, createdAt`.

### `POST /api/auth/logout`
**Scope**: authenticated. Invalidates refresh token and clears session.
Response 200: `{ "message": "Logout successful" }`

---

## Tenants

### `POST /api/tenants`
**Scope**: role:admin.
Request body:
```json
{
  "name": "Meccanica Rossi SRL",
  "vatNumber": "12345678901",
  "fiscalCode": "12345678901",
  "sdiDestinationCode": "ABCDEFG",
  "pecEmail": "rossi@pec.it",
  "billingAddress": "Via Industriale 15",
  "billingCity": "Mozzecane",
  "billingPostalCode": "37060",
  "billingProvince": "VR",
  "plan": "professionale"
}
```
Response 201: Tenant object.
Errors: `409` Partita IVA already registered.

### `GET /api/tenants/current`
**Scope**: authenticated. Returns the tenant of the authenticated user.

### `GET /api/tenants/:id`
**Scope**: authenticated + tenant (user must belong to this tenant).

### `PATCH /api/tenants/:id`
**Scope**: role:admin. Accepts partial updates. Changing `plan` auto-updates `seatLimit`.

---

## Inventory

### Products

#### `POST /api/inventory/products`
**Scope**: role:manager | role:operator.
Request body:
```json
{
  "sku": "MAT-001",
  "name": "Acciaio Inox 304 — Lamiera 2mm",
  "description": "Lamiera laminata a freddo",
  "category": "raw_material",
  "unitOfMeasure": "kg",
  "unitCost": 3.50,
  "sellingPrice": 5.00,
  "weight": 1.0,
  "barcode": "8001234567890",
  "minimumStock": 100,
  "reorderPoint": 200,
  "reorderQuantity": 500,
  "leadTimeDays": 5,
  "supplier": "Forniture Metalli Verona"
}
```
Enums: `category` ∈ `raw_material | semi_finished | finished_product |
consumable | packaging | spare_part`; `unitOfMeasure` ∈ `pz | kg | g | l
| m | mq | mc | box | pallet`.

Response 201: Product object.
Errors: `400` SKU already exists; `400` validation.

#### `GET /api/inventory/products`
**Scope**: authenticated.
Query: `?page=1&limit=20&category=raw_material&search=acciaio&isActive=true`.
Response 200: `{ data: [...], total, page, limit, totalPages }`.

#### `GET /api/inventory/products/:id`
**Scope**: authenticated. Returns product with stock levels and recent movements.
Errors: `404` not found.

#### `PUT /api/inventory/products/:id`
**Scope**: role:manager. Partial update.

#### `DELETE /api/inventory/products/:id`
**Scope**: role:manager. Soft delete (`isActive = false`). Response 204.

#### `GET /api/inventory/products/low-stock`
**Scope**: authenticated. Returns products where total on-hand ≤ reorder_point.

### Warehouses

#### `POST /api/inventory/warehouses`
**Scope**: role:manager.
Request body:
```json
{
  "code": "MAG-01",
  "name": "Magazzino Principale Mozzecane",
  "address": "Via Industriale 15",
  "city": "Mozzecane",
  "postalCode": "37060",
  "province": "VR",
  "capacitySquareMeters": 2500,
  "zones": [
    { "name": "Zona A — Materie prime", "code": "A", "type": "raw_materials" },
    { "name": "Zona B — Semilavorati",  "code": "B", "type": "wip" },
    { "name": "Zona C — Prodotti finiti","code": "C", "type": "finished" }
  ]
}
```

#### `GET /api/inventory/warehouses`
Response 200: array of warehouses with stock-level summaries.

#### `GET /api/inventory/warehouses/:id`
Full warehouse details including per-product stock.

#### `PUT /api/inventory/warehouses/:id`
Partial update.

### Stock

#### `GET /api/inventory/stock?warehouseId=…`
Current stock levels across or within a warehouse.

#### `POST /api/inventory/stock/movements`
**Scope**: role:operator.
Request body:
```json
{
  "productId": "uuid",
  "movementType": "inbound",
  "quantity": 500,
  "destinationWarehouseId": "uuid",
  "referenceNumber": "DDT-2026-00012",
  "notes": "Consegna da Forniture Metalli Verona",
  "performedBy": "Mario Rossi"
}
```
Enum `movementType` ∈ `inbound | outbound | transfer | adjustment |
production_consumption | production_output | return | scrap`.
For TRANSFER both `sourceWarehouseId` and `destinationWarehouseId` required.

Response 201: Movement object.
Errors: `404` product not found; `400` insufficient stock.

#### `GET /api/inventory/stock/movements`
Query: `?productId=&page=&limit=`. Paginated.

#### `GET /api/inventory/stock/valuation`
Response 200:
```json
{
  "totalValue": 342500.00,
  "byCategory": { "raw_material": 125000, "semi_finished": 87500, "finished_product": 130000 },
  "byWarehouse": { "Magazzino Principale": 275000, "Magazzino Secondario": 67500 }
}
```

---

## Production

### Production Orders

#### `POST /api/production/orders`
**Scope**: role:manager.
Request body:
```json
{
  "productName": "Componente Meccanico A-100",
  "productId": "uuid",
  "quantityPlanned": 1000,
  "priority": "high",
  "plannedStartDate": "2026-04-20",
  "plannedEndDate": "2026-05-05",
  "notes": "Ordine urgente per cliente Verona Meccanica",
  "customerReference": "CLI-2026-045",
  "estimatedCost": 15000,
  "billOfMaterials": [
    { "materialId": "uuid", "materialName": "Acciaio Inox 304", "quantityRequired": 500, "unit": "kg" }
  ]
}
```

#### `GET /api/production/orders`
Query: `?status=confirmed&page=&limit=`.

#### `GET /api/production/orders/:id`
Order details with all work orders.

#### `PATCH /api/production/orders/:id/status`
State-machine transitions: `draft → planned → confirmed → in_progress →
completed`, with `cancelled` available from any non-terminal state.
Request: `{ "status": "confirmed" }`. Errors: `400` invalid transition.

### Work Orders

#### `POST /api/production/orders/:orderId/work-orders`
Request body:
```json
{
  "operationName": "Taglio Laser",
  "workCenter": "CNC-01",
  "sequenceNumber": 1,
  "estimatedDurationHours": 8,
  "assignedTo": "Giuseppe Verdi",
  "instructions": "Utilizzare programma CNC #A100-TAGLIO"
}
```

#### `GET /api/production/work-orders`
Query: `?status=&workCenter=&page=&limit=`.

#### `PATCH /api/production/work-orders/:id/status`
Request body:
```json
{
  "status": "completed",
  "quantityProduced": 995,
  "quantityRejected": 5,
  "notes": "Completato con 0.5% scarto",
  "qualityChecks": [
    { "checkName": "Dimensioni",             "passed": true, "value": "OK" },
    { "checkName": "Finitura superficiale", "passed": true, "value": "Ra 0.8" }
  ]
}
```

### Dashboard & Schedule

#### `GET /api/production/dashboard`
Response 200:
```json
{
  "activeOrders": 24,
  "completedToday": 5,
  "overdueOrders": 2,
  "efficiency": 87,
  "workCenterUtilization": {
    "CNC-01":     { "estimated": 40, "actual": 45, "efficiency": 89 },
    "CNC-02":     { "estimated": 32, "actual": 36, "efficiency": 89 },
    "ASSEMBLY-01":{ "estimated": 24, "actual": 28, "efficiency": 86 }
  }
}
```

#### `GET /api/production/schedule?startDate=ISO&endDate=ISO`

---

## Sales

### Customers (Anagrafica)

#### `POST /api/sales/customers`
**Scope**: role:manager.
Request body:
```json
{
  "code": "CLI-001",
  "name": "Verona Meccanica SRL",
  "customerType": "business",
  "vatNumber": "01234567890",
  "fiscalCode": "01234567890",
  "sdiDestinationCode": "ABCDEFG",
  "pecEmail": "vm@pec.it",
  "email": "amministrazione@veronameccanica.it",
  "phone": "+39 045 999 8888",
  "address": "Viale dell'Industria 42",
  "city": "Verona",
  "postalCode": "37138",
  "province": "VR",
  "country": "IT",
  "defaultIvaRate": 22,
  "paymentTermsDays": 60,
  "splitPayment": false
}
```

#### `GET /api/sales/customers`
Query: `?search=verona&page=&limit=`.

#### `GET /api/sales/customers/:id`

### Sales Orders

#### `POST /api/sales/orders`
Request body:
```json
{
  "customerId": "uuid",
  "orderDate": "2026-04-17",
  "requestedDeliveryDate": "2026-05-10",
  "customerPoReference": "PO-VM-2026-128",
  "notes": "Ritiro presso magazzino",
  "lines": [
    { "productId": "uuid", "sku": "PF-001", "description": "Componente A-100",
      "quantity": 100, "unitPrice": 45.50, "discountPct": 5, "ivaRate": 22 }
  ]
}
```

Response 201: SalesOrder with computed `subtotalAmount`, `taxAmount`,
`totalAmount`. If the customer has `splitPayment=true`, `taxAmount=0`
(art. 17-ter DPR 633/1972).

#### `GET /api/sales/orders?status=&page=&limit=`

#### `PATCH /api/sales/orders/:id/confirm`
Transition from DRAFT → CONFIRMED.

---

## Accounting

### Chart of Accounts

#### `POST /api/accounting/accounts`
Create a single account.
Request: `{ "code": "04.01.003", "description": "Ricavi consulenza", "type": "revenue", "parentCode": "04.01" }`

#### `GET /api/accounting/accounts?type=revenue`

#### `POST /api/accounting/accounts/seed`
**Scope**: role:admin.
Seed the Piano dei Conti IV Direttiva CEE template. Idempotent.
Response 200: `{ "created": 27, "message": "27 accounts seeded" }`.

### Journal Entries (Prima Nota)

#### `POST /api/accounting/entries`
Request body:
```json
{
  "reference": "FC-2026-0128",
  "entryDate": "2026-04-17",
  "journal": "vendite",
  "description": "Fattura nr. 128 Verona Meccanica SRL",
  "lines": [
    { "accountId": "uuid-01.04", "accountCode": "01.04", "debit": 5500.00, "description": "Credito v/cliente" },
    { "accountId": "uuid-04.01", "accountCode": "04.01", "credit": 4508.20, "description": "Ricavo vendita" },
    { "accountId": "uuid-02.02.001", "accountCode": "02.02.001", "credit": 991.80, "description": "IVA a debito 22%" }
  ]
}
```
Errors: `400` unbalanced (sum of debits ≠ sum of credits).

#### `GET /api/accounting/entries?from=&to=&page=&limit=`

### Invoices (FatturaPA)

#### `POST /api/accounting/invoices`
Create a DRAFT invoice.
Request body:
```json
{
  "documentType": "TD01",
  "invoiceDate": "2026-04-17",
  "customerId": "uuid",
  "customerName": "Verona Meccanica SRL",
  "customerVatNumber": "01234567890",
  "customerSdiCode": "ABCDEFG",
  "customerPecEmail": "vm@pec.it",
  "lines": [
    { "description": "Componente A-100", "quantity": 100, "unitPrice": 45.50, "ivaRate": 22 }
  ],
  "notes": "Consegna franco destino"
}
```
Supports `ivaNature` (`N1`–`N7`) for non-taxable operations.
Response 201: Invoice with auto-computed `subtotalAmount`, `taxAmount`,
`totalAmount`, and per-fiscal-year sequential `number`.

#### `PATCH /api/accounting/invoices/:id/submit`
Transition DRAFT → QUEUED. Asynchronously hands off to the SDI
intermediary (Aruba / InfoCert / Namirial per `IT_SDI_INTERMEDIARY`
env var) for XML generation, XAdES signature, and submission.
Errors: `400` only DRAFT invoices can be queued.

#### `GET /api/accounting/invoices?status=&fiscalYear=&page=&limit=`

### IVA Liquidation

#### `GET /api/accounting/iva-liquidation?period=2026-04`
Accepts `YYYY-MM` (monthly) or `YYYY-Q1|Q2|Q3|Q4` (quarterly).
Response 200:
```json
{
  "period": "2026-04",
  "totalTaxable": 128450.00,
  "totalIva":     28259.00,
  "byRate": {
    "22%": { "taxable": 110000, "iva": 24200 },
    "10%": { "taxable":  18450, "iva":  1845 },
    "4%":  { "taxable":      0, "iva":     0 }
  }
}
```

---

## Error Responses

All errors follow a common envelope consistent with RFC 7807 problem-
details. NestJS exception filters transform `HttpException` and
`ThrottlerException` into:
```json
{
  "statusCode": 400,
  "message": "Product with SKU MAT-001 already exists",
  "error": "Bad Request",
  "path": "/api/inventory/products",
  "timestamp": "2026-04-17T10:30:00.000Z",
  "correlationId": "req-abc123"
}
```

| Code | Meaning                                                           |
|------|-------------------------------------------------------------------|
| 400  | Bad Request / validation error / invalid state transition         |
| 401  | Unauthorized (missing / invalid / expired token)                  |
| 403  | Forbidden (authenticated but insufficient role)                   |
| 404  | Resource not found                                                |
| 409  | Conflict (duplicate key, e.g., Partita IVA or SKU already exists) |
| 422  | Unprocessable (semantically invalid)                              |
| 429  | Too Many Requests (rate limit exceeded)                           |
| 500  | Internal Server Error                                             |
| 503  | Service Unavailable (PostgreSQL or Redis down)                    |

## Rate Limiting

Headers on every response:
- `X-RateLimit-Limit` — total allowed requests in the current window
- `X-RateLimit-Remaining` — remaining requests in the current window
- `X-RateLimit-Reset` — Unix epoch seconds until window reset

Defaults:
- General endpoints: 120 req/min per user
- Authentication endpoints: 5 req/min per IP (brute-force protection)

## Pagination

All list endpoints accept `page` (default 1) and `limit` (default 20,
max 100) and return:
```json
{
  "data":       [ /* items */ ],
  "total":      150,
  "page":       1,
  "limit":      20,
  "totalPages": 8
}
```

## Correlation and Tracing

Every request should include `X-Request-ID` (client-generated or
server-generated UUID). The response echoes this header. OpenTelemetry
traces propagate via W3C `traceparent` / `tracestate` headers.
