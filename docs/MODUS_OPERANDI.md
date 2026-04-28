# SmartERP — Modus Operandi

## The Definitive Strategic, Technical, and Operational Blueprint

**Version**: 1.0.0
**Last Updated**: 2026-Q2
**Classification**: Internal — Confidential
**Audience**: Founders, investors, engineering leadership, go-to-market leadership

---

## Table of Contents

**Part I — Strategic Foundation**
1. Executive Summary
2. Market Analysis
3. Business Model & Revenue Strategy

**Part II — Technical Deep Dive**
4. Technical Architecture
5. Development Roadmap

**Part III — Scaling & Operations**
6. Scaling Strategy
7. Security & Compliance
8. Infrastructure & DevOps

**Part IV — Business Operations**
9. Team Structure & Hiring Plan
10. Marketing & Sales Strategy
11. Financial Projections

**Part V — Excellence & Growth**
12. Operations Manual
13. Risk Management
14. Quality Assurance
15. Customer Success
16. Partnerships & Ecosystem
17. Exit Strategy

---

# PART I — STRATEGIC FOUNDATION

## 1. Executive Summary

SmartERP is a cloud-native, multi-tenant Enterprise Resource Planning platform engineered from first principles for the small and medium manufacturing enterprises (PMI manifatturiere) of the Mozzecane–Verona industrial corridor and, in staged expansion, for the broader Veneto region and Northern Italy. The company is headquartered in Mozzecane (VR), a comune of approximately 7,500 inhabitants at the south-western fringe of Verona province, five kilometres from the A22 Brennero motorway exit of Nogarole Rocca and twelve kilometres from the Quadrante Europa intermodal platform — Europe's second-largest combined road-rail freight hub. This geographic anchor is strategic: SmartERP serves the densest concentration of family-owned precision-mechanical, metalworking, plastic-processing, food-packaging, and component-assembly firms in Italy.

The market opportunity is concrete and quantifiable. Verona province is the #1 Italian province by wine export value (approximately €1.1 billion annually) and is consistently within the top ten Italian provinces by total export (€13 billion annually) over a GDP of roughly €30 billion and a population of 930,000. Manufacturing accounts for about 34% of provincial employment. Within this ecosystem, Unioncamere Veneto, Confindustria Verona, and CCIAA Verona triangulate that 73% of SMEs still manage core supply-chain and production operations primarily through spreadsheets or paper workflows, ERP adoption among SMEs with 10–250 employees sits at ~38% against a national 47%, and fewer than 28% have e-invoicing workflows integrated with their back-office. The addressable population within Mozzecane and the Verona catchment is approximately 4,500 manufacturing SMEs.

SmartERP closes this gap with a modular monolith architected around Domain-Driven Design bounded contexts — Auth, Tenants, Inventory, Production, Sales, Accounting, Configuration — implemented in NestJS 10 (TypeScript) atop PostgreSQL 16 and Redis 7, with BullMQ for asynchronous work (end-of-day postings, payroll batches, report generation), Next.js 14 App Router for server-rendered dashboards, and OpenTelemetry / Prometheus / Grafana for observability. Multi-tenancy is enforced at the domain layer through a `tenant_id` column on every entity, with a documented migration path to schema-per-tenant as scale demands. Italian fiscal compliance is a first-class concern: invoice records expose FatturaPA v1.2.2-compatible fields for handoff to an SDI-accredited intermediary; the chart-of-accounts template tracks Piano dei Conti IV Direttiva CEE; tax logic recognises the full IVA regime matrix (ordinario, forfettario, minimi, split payment, reverse charge). Reg. UE 2016/679 (GDPR) and D.Lgs. 196/2003 (as amended by D.Lgs. 101/2018) are implemented through explicit lawful-basis tagging, a DPIA template, audit logs preserved for ten years per fiscal retention rules (DPCM 3/12/2013, Circolari AgID), and a documented 72-hour breach-notification workflow toward the Garante.

Commercial architecture follows a three-tier licensed-software model (perpetual seat licence + annual maintenance contract): Base €99/seat/month maintenance & updates (post one-time licence acquisition) for micro-enterprises (up to 3 users, single warehouse, single company), Professionale €199/seat/month maintenance & updates for growing SMEs (full six-module suite, multi-warehouse, multi-company, priority telephone support), and Enterprise at a custom-negotiated price for structured companies requiring multi-entity consolidation, advanced BI, AI-powered demand forecasting, dedicated Customer Success Manager, and bespoke integration contracts. At mid-tier pricing (€199/seat/month × 5 users × 12 months = €11,940 average revenue per customer), a realistic three-year penetration of 2.5% of the 4,500-SME catchment yields ~113 customers and ~€1.35 million annual recurring revenue (licence + maintenance), before service revenue. The company projects operating break-even in month 30–33 and cumulative funding need of €750,000–€800,000 through a pre-seed (€200k) and a seed round (€550–600k) from Italian venture capital (CDP Venture Capital through the Fondo Nazionale Innovazione, Primo Ventures, Italian Angels for Growth) or non-dilutive instruments (Smart&Start Italia, Voucher Innovation Veneto, Horizon Europe SME Instrument).

The strategic differentiation is triangular: SmartERP is more affordable than SAP Business One (whose Italian deployments routinely require €30–100k upfront plus 15–20% annual maintenance), more Italian-aware than Odoo or Netsuite (which require third-party modules for FatturaPA/SDI, Conservazione a Norma, INPS/INAIL interfaces), and more modern than incumbent Italian vendors TeamSystem Alyante, Zucchetti Ad Hoc Enterprise, and Passepartout Mexal (whose architectures are still rooted in on-premise heritage). The elevator pitch: "SmartERP è il primo gestionale cloud-native pensato a Mozzecane per le PMI manifatturiere di Verona — fatturazione elettronica, magazzino, produzione e contabilità in un'unica piattaforma, a €99 per utente al mese."

## 2. Market Analysis

### 2.1 The Verona Manufacturing Landscape

Verona province hosts a densely networked manufacturing base inherited from a century-long evolution through textile, mechanical, furniture, and food-processing specialisations. The official count from CCIAA Verona's 2025 Bilancio di Mandato identifies approximately 8,200 active manufacturing enterprises employing roughly 95,000 workers and generating ~€18 billion in annual manufacturing revenue. Of these, approximately 4,500 fall within SmartERP's ideal customer profile: 10–250 employees, €0.5–50 million revenue, currently operating on spreadsheets or legacy on-premise systems, and required to comply with the electronic-invoicing mandate of D.Lgs. 127/2015 and the conservazione a norma rules articulated in DPCM 3/12/2013 and successive AgID Circolari. Within a 30-kilometre radius of Mozzecane — the effective catchment for on-site sales and implementation work in the first twelve months — there are approximately 450 target SMEs, concentrated along the SR 11 Padana Superiore, the A22 corridor, and the industrial zones of Villafranca di Verona, Nogarole Rocca, Valeggio sul Mincio, Vigasio, and Povegliano Veronese.

Five industrial districts intersect the SmartERP catchment and shape the product roadmap. The Distretto del Mobile di Verona — historically rooted in Cerea, Bovolone, and Minerbe — feeds primary-to-tertiary supplier chains for which multi-level bill-of-materials management is a hard requirement. The precision-mechanical cluster on the Verona–Mantova axis is a tier-2/tier-3 supplier base for automotive and industrial OEMs (Brembo, Marelli, Comau), demanding advanced quality control, lot traceability, and readiness for Piano Transizione 4.0 / 5.0 tax-credit documentation. Food processing and cold-chain operators, particularly around Isola della Scala and along the Garda shoreline, require HACCP-aligned inventory tracking and per-lot expiry management. Plastic-processing SMEs feed the packaging and automotive subsystems sectors, with typical runs measured in thousands of parts per batch and tight per-part margin structures that reward granular cost accounting. Agri-food processors bridge into Project 2 (TraceVino) and Project 10 (AgriVigna) in the portfolio. SmartERP's functional surface — six modules with Italian fiscal logic and multi-tenant isolation — is calibrated to serve each district's cross-section without deep vertical specialisation, leaving vertical depth to later Phase 3 marketplace add-ons or to partner products.

### 2.2 TAM, SAM, SOM

Total Addressable Market. Across Italy there are approximately 420,000 manufacturing SMEs within the 10–250 employee band (ISTAT 2024 demographics). If the average annual IT spend dedicated to ERP and associated services reaches €5,000 (combining licence, maintenance, implementation, training, commercialista integration), the TAM equals approximately €2.1 billion. This figure aligns with Politecnico di Milano's "Osservatorio Digital Innovation nelle PMI" estimates of the Italian enterprise-application software market (€2.0–2.3 billion for SMEs, 2024 figures) and is corroborated by Anitec-Assinform's annual Digital Italy report.

Serviceable Addressable Market. Restricting to Veneto, Lombardia Orientale (Bergamo, Brescia, Mantova, Cremona), Trentino-Alto Adige, and Friuli Venezia Giulia — the geographic band SmartERP can realistically serve with a single-country team within three years — the count is approximately 45,000 manufacturing SMEs. Veneto alone holds about 12% of Italian manufacturing output, second only to Lombardia. At an average contract value of €7,200 (Professionale tier, 3 users, 12 months), the SAM equals approximately €324 million.

Serviceable Obtainable Market. In years 1–3 SmartERP focuses on Verona province (2,500 ICP-matching SMEs inside the 30-km radius plus the rest of the province) plus opportunistic sales to Mantova, Vicenza, and Trentino. Three-year penetration target: 2.5% of 4,500 Verona-catchment SMEs = 113 customers, supplemented by ~20 opportunistic Veneto/Mantova customers. Total target: 130 customers by end of Year 3. At an average ACV of €10,400 (weighted across Base, Professionale, and Enterprise tiers), this produces €1.35 million licence + maintenance revenue, plus €0.25–0.35 million in implementation and training services.

### 2.3 Competitive Landscape

Five categories of competitor exist, each with distinct positioning trade-offs.

Enterprise incumbents (SAP Business One, Oracle NetSuite, Microsoft Dynamics 365 Business Central). SAP Business One's Italian deployments routinely cost €30,000–€100,000 in initial licence + implementation with 15–20% annual maintenance. NetSuite quotes start around €999/month per instance plus per-user fees plus partner implementation cost. Dynamics 365 BC is priced at €70–100 per user per month for the Essential tier, often bundled with partner fees. These platforms are over-engineered for a 20-person SME in Mozzecane, require months of configuration, and their Italian localisation is delivered through partner modules of variable quality. SmartERP's positioning: one-tenth the cost, days not months to deploy, native Italian fiscal logic.

Italian incumbents (TeamSystem Alyante Enterprise, Zucchetti Ad Hoc Enterprise, Passepartout Mexal). TeamSystem (backed by Hellman & Friedman private equity, undergoing aggressive consolidation of the Italian business-software market) has the strongest brand among commercialisti but a hybrid on-premise/cloud architecture that lags cloud-native competitors on UX, performance, and integration ease. Zucchetti (>700,000 customers) is the market leader by volume but its Ad Hoc Enterprise product shows significant legacy debt. Passepartout's Mexal is entrenched in the commercialista channel. Pricing is opaque and typically negotiated; effective first-year spend for a Veneto SME ranges €5,000–€30,000. SmartERP's positioning: transparent licence pricing, modern web-first UX, faster iteration cadence.

Italian SME lite-ERP / invoicing tools (Fatture in Cloud by TeamSystem, Danea EasyFatt, Aruba Fatturazione Elettronica, Libero SISTEMI). These serve the micro-enterprise segment (1–5 employees) effectively but fall short on manufacturing functionality. Fatture in Cloud starts at €8/month but cannot handle production orders, BOM, or work centres. Danea EasyFatt has no multi-user, no cloud, no production module. SmartERP's Base tier (€99/user/month) is the natural upgrade path when a Fatture in Cloud customer grows into manufacturing complexity.

International generalists (Odoo Enterprise, ERPNext, Zoho One). Odoo Enterprise at €24.90/user/month plus required localisation-module fees is the closest horizontal generalist with adequate manufacturing depth, but its Italian fiscal compliance depends on third-party modules with variable quality and support. SmartERP's positioning: native FatturaPA/SDI, conservazione a norma built in, Italian support in Italian from Verona.

Emerging cloud-native niche entrants. A handful of Italian startups (Stampaprint, Cassa in Cloud, Retail in Cloud) target narrow verticals or single-function use cases. None combines the full six-module ERP scope with manufacturing depth in the Verona/Veneto footprint. SmartERP has first-mover potential in this specific positioning.

### 2.4 SWOT Analysis

Strengths. Purpose-built for Italian manufacturing SMEs; cloud-native architecture eliminating upgrade friction; native FatturaPA/SDI and Italian fiscal compliance; transparent licence pricing with three clean tiers; Verona geographic anchor enabling face-to-face pilot sales; team-weekly release cadence enabling rapid response to customer feedback; strong unit economics (LTV/CAC > 15× by Year 2).

Weaknesses. New entrant with no established brand; small team constrains feature development pace in Years 1–2; no commercialista channel presence at launch (requires building over 12–18 months); functionality gap vs. TeamSystem for complex multi-company fiscal structures at launch; dependency on seed funding to reach product-market fit.

Opportunities. Piano Transizione 4.0 (€13.381 billion envelope, 5–20% tax credit on qualifying Industry 4.0 investments including software) and Piano Transizione 5.0 (expanding to I4.0 + energy efficiency combined, 5–45% credit) actively subsidise ERP purchases for eligible SMEs; PNRR Missione 1 Digitalizzazione (€49.2 billion envelope through 2026) provides grant funding to commercialisti and industry associations for member digitalisation; D.Lgs. 127/2015 enforcement extensions continue through 31/12/2027, pushing holdouts into e-invoicing systems; D.Lgs. 138/2024 (NIS2 transposition, effective 17 October 2024) expands cybersecurity documentation requirements for mid-sized companies, creating adjacent demand for structured IT workflows.

Threats. TeamSystem or Zucchetti could accelerate cloud-native offerings with vastly more capital and distribution (mitigation: speed, Italian-SME specificity, direct Verona presence, continuous product-market-fit iteration); Microsoft could launch an Italian-tailored Dynamics 365 BC package (low probability near-term); economic downturn could compress SME IT budgets; a key competitor could cut prices aggressively (mitigation: SmartERP's differentiation is service depth and Italian specificity, not price alone).

## 3. Business Model & Revenue Strategy

### 3.1 Pricing Architecture

SmartERP is sold as licensed software: customers buy a perpetual seat licence at deployment and pay an annual maintenance & updates contract (priced as a monthly fee per seat).

SmartERP operates a three-tier licensed-software model (perpetual seat licence + annual maintenance contract) priced per seat per month, billed monthly in arrears or annually with a 15% discount. The tier design derives from qualitative research with 42 manufacturing-business owners and commercialisti in the Verona area (Q1 2026) and a willingness-to-pay survey across 180 respondents.

Piano Base — €99 per seat per month maintenance & updates (post one-time licence acquisition) (or €990 per seat per year billed annually). Designed for micro-enterprises and artigiani with 1–10 employees and up to 3 active SmartERP users. Includes single-company, single-warehouse, up to 500 SKUs, the Inventory, Production (simplified), Sales, and Accounting modules with FatturaPA/SDI integration, 5 GB attachment storage, email support with 24-hour business-day SLA, and a self-service onboarding portal. Deliberately excludes multi-warehouse, advanced BI, API access, and dedicated onboarding — creating a natural upgrade funnel.

Piano Professionale — €199 per seat per month maintenance & updates (post one-time licence acquisition) (or €1,990 per seat per year). The core tier for SMEs with 10–100 employees and 3–15 SmartERP users. Includes the full six-module suite (Auth, Tenants, Inventory, Production, Sales, Accounting with full extensions for Purchasing and HR-lite integrations), multi-warehouse with unlimited SKUs, multi-level bill-of-materials, advanced reporting with 40+ built-in dashboards, RESTful API access for customer-side integrations (MES, CNC, e-commerce, payroll provider), priority telephone support (4-hour business-day SLA), 50 GB attachment storage, and a complimentary 4-hour guided onboarding session. Target sweet spot: 70% of addressable-market ICP.

Piano Enterprise — custom pricing, typically €349–€599 per seat per month maintenance & updates (post one-time licence acquisition) depending on features and volume. For structured companies with 100+ employees and complex multi-entity operations. Includes multi-company consolidation (ideal for family-holding structures common in Veneto), inter-company transactions, advanced BI with predictive analytics and AI-powered demand forecasting (Phase 3 roadmap), SSO/SAML integration, advanced RBAC, dedicated Customer Success Manager, 24/7 phone/chat support (1-hour SLA), unlimited storage, 20 hours/year of customisation services, and a quarterly Business Review with SmartERP leadership. Enterprise contracts are typically multi-year with annual price review clauses tied to ISTAT FOI inflation.

Three-year pricing strategy is stable: no planned list-price increase for Base and Professionale, except annual ISTAT-indexed adjustments (typical 1.5–2.5%) for multi-year contracts. Enterprise pricing reviewed annually per contract. All prices are IVA esclusa (22% Italian VAT) in line with Italian B2B convention.

### 3.2 Additional Revenue Streams

Implementation and migration services. While SmartERP's self-service onboarding is designed to handle standard cases, approximately 60% of Professionale customers and 100% of Enterprise customers purchase implementation services. Packages: "Avvio Rapido" €500 (data import, basic configuration, 2-hour video training); "Avvio Completo" €2,500 (full legacy-system migration, custom workflow setup, on-site kickoff); "Enterprise Implementation" €5,000–€25,000 (legacy-system migration from TeamSystem/Zucchetti/Access/custom DOS apps, dedicated project manager, 12-week structured programme). Weighted-average implementation revenue per customer: ~€2,000.

Training and certification. Individual training courses at €150/person/day for end users, €800/day for on-site corporate training in the Verona province (€1,200/day outside). A "SmartERP Specialist" certification programme for commercialisti and IT consultants launches in Q3 of Year 1 at €590 per certification cycle, creating a partner ecosystem that amplifies organic customer acquisition.

Marketplace and add-on modules (Phase 4 roadmap, Year 2+). Industry-specific add-ons priced €29–€99 per month, with SmartERP retaining a 30% revenue share on third-party partner-built modules. Planned first-wave modules: ISO 9001 quality-management tracking, advanced finite-capacity production scheduling, EDI Odette/Galia for automotive tier-2/tier-3 suppliers, CNC / OPC-UA machine connectivity (bridge to Project 6 FactoryMind), retail/e-commerce connectors (Shopify, WooCommerce, Amazon Vendor Central).

Premium data and analytics. Enterprise tier bundles anonymised industry-benchmarking dashboards (how your OEE, inventory turns, cost-per-unit, DSO compare to similar-sized peers in Verona/Veneto). Available to Professionale as a €49/user/month add-on (Year 2 launch).

Certified integrations revenue. A "Powered by SmartERP" partnership programme for commercialisti and independent software vendors generates a 10–15% recurring revenue share on referred customer licences for the full contract lifetime. Expected to represent 15–25% of net new ACV by Year 2.

### 3.3 Unit Economics

Customer Acquisition Cost. Blended CAC is engineered to decline with scale. Year 1: €1,800 per customer, derived from 20 hours of sales-rep effort at loaded cost €45/hour (€900), digital marketing spend of €300 per attributed customer (LinkedIn Ads to titolari/direttori produzione in Verona/Veneto geography, Google Ads on "gestionale PMI", "ERP manifatturiero cloud"), trade-show cost allocation of €250 per customer (MECSPE Bologna, SPS Italia Parma, SMAU Milano), and implementation-funnel support cost of €350 per customer. Year 3: €1,200 per customer as brand recognition compounds, referral economics kick in (projected 20% of new business), and Commercialista Partner Programme reduces direct-sales load.

Lifetime Value. LTV uses a conservative churn assumption of 8% annual (industry benchmarks for vertical cloud-software products with high switching costs sit at 6–12%; ERP historically at 5–8%). Weighted average ACV across the customer mix (40% Base, 45% Professionale, 15% Enterprise) is €3,200 in Year 1 rising to €3,900 by Year 3 (mix shift toward Professionale and Enterprise). Gross margin of 80% (cloud infrastructure ~5%, payment-processing ~2%, direct support ~13%). Expected customer lifetime: 1/0.08 = 12.5 years. LTV = €3,200 × 0.80 × 12.5 = €32,000 Year 1 rising to ~€39,000 by Year 3.

LTV/CAC Ratio. Year 1 LTV/CAC ≈ 17.8×. Year 3 LTV/CAC ≈ 32.5×. These ratios are exceptionally strong even under pessimistic stress-testing (doubled CAC, halved lifetime). Industry healthy benchmark is 3×; SmartERP's implied ratio validates sustained sales-and-marketing investment.

Payback Period. Monthly gross profit per customer in Year 1 = €267 × 0.80 = €213. CAC payback = €1,800 / €213 ≈ 8.5 months. Year 3 payback ≈ 5.6 months. Well within the healthy 12–18 month B2B licensed-software band.

Net Revenue Retention. Target 110% (Year 1 exit), 115% (Year 2 exit), 120% (Year 3 exit). Upsell vectors: seat additions as customers scale headcount, tier upgrades (Base→Professionale→Enterprise), marketplace-module attachments, premium-analytics add-on licence. The NRR math: 8% gross churn, offset by 18–28% expansion revenue from the existing base.

### 3.4 Freemium and Trial Strategy

SmartERP does not offer a fully free tier — the operational cost of running a provisioned tenant on PostgreSQL+Redis with genuine usage is non-trivial, and the sales cycle for B2B licensed-software products with ERP-grade stickiness is too long to subsidise indefinite free usage. Instead, two controlled-conversion mechanisms bring prospects into paid plans:

A 30-day free trial on the Professionale tier with no credit card required, full module access, and a pre-loaded demo-data template (anagrafica azienda tipo, 50 prodotti, 2 magazzini, 10 clienti, 10 fornitori). The 30-day trial is supported by email-drip onboarding guidance and a single on-boarding call. Conversion target: 25% trial-to-paid.

A "Freemium SDI Bridge" low-end offering at €19/month (capped at 50 invoices/month, single user, invoice-only functionality) is planned for Q2 Year 2 as a top-of-funnel acquisition tool competing with Fatture in Cloud and Aruba Fatturazione. Upgrade conversion from Freemium to Base or Professionale is targeted at 12% annual.

### 3.5 Revenue Growth Model

Year 1 (pre-seed funded, months 1–12). New customer acquisitions: 15 paid customers by end of month 12 (4 Base, 9 Professionale, 2 Enterprise). Exit monthly maintenance revenue approximately €7,200 (€99 × 4 × avg 2 users + €199 × 9 × avg 5 users + €499 × 2 × avg 8 users). Exit annual recurring revenue (licence + maintenance) approximately €86,000 licence + maintenance + €30,000 one-time services = €116,000 total. Partial-year recognised revenue: €48,000.

Year 2 (seed funded, months 13–24). New acquisitions: +45 customers (total 60 customers after accounting for ~4 churn). Mix shift toward Professionale: 20% Base, 60% Professionale, 20% Enterprise. Exit annual recurring revenue approximately €420,000 licence + maintenance + €80,000 services + €20,000 training & certification = €520,000 recurring revenue run-rate. Marketplace revenue nascent: €10,000 annualised.

Year 3 (growth capital deployment, months 25–36). New acquisitions: +75 customers (total ~130 customers after ~9 churn). Exit annual recurring revenue approximately €1,150,000 licence + maintenance + €160,000 services + €60,000 training & certification + €40,000 marketplace + €60,000 premium analytics = €1,470,000 recurring revenue run-rate. Monthly gross margin ~80%.

Year 3 exit metrics align with the "Rule of 40" threshold commonly cited for healthy licensed-software businesses: ~120% Year-3 growth + ~−10% operating margin ≈ 110 (well above 40).

---

# PART II — TECHNICAL DEEP DIVE

## 4. Technical Architecture

### 4.1 Guiding Principles

SmartERP's architecture is governed by seven principles that reflect both the constraints of a resource-bounded startup and the ambitions of a platform designed to scale to thousands of tenants.

Modular monolith first, microservices later. The backend is structured as a single deployable NestJS application composed of clearly bounded modules (AuthModule, TenantsModule, InventoryModule, ProductionModule, SalesModule, AccountingModule, ConfigModule, HealthModule). Cross-module dependencies flow through explicit injection of service interfaces; direct entity access across modules is forbidden by convention and by lint rule. This structure keeps the deployment footprint and operational complexity low while preserving extraction-to-microservice options when specific modules hit scale walls.

API-first with OpenAPI 3.1. Every feature is built controller-first with an OpenAPI schema generated by `@nestjs/swagger`. The Swagger UI is exposed at `/api/docs`. Contract testing against the schema runs in the CI pipeline, ensuring frontend-backend drift is caught at PR review time. URL versioning (`/api/v1/...`) enables major-version coexistence; deprecation is signalled via `Deprecation` and `Sunset` headers with a minimum 6-month grace window.

Multi-tenancy by `tenant_id` column with migration path to schema-per-tenant. Every entity includes a `tenantId` column with a partial composite index on `(tenant_id, business_key)`. Service methods enforce tenant isolation; tenant resolution is driven by the JWT claim, validated by an `AuthGuard`, and injected into services via a request-scoped `TenantContext`. When tenant count crosses ~500 or when a specific tenant demands strict data isolation (often required by large customers and by some regulatory frameworks), the architecture supports migration to schema-per-tenant through connection-pool routing, with no application-code rewriting required.

Security by design. OAuth 2.0 / OIDC with JWT access tokens (15-minute TTL in production, 1-hour for development) and opaque refresh tokens (7-day TTL, rotated on every use) per NIST SP 800-63B guidance and the OWASP ASVS L2 baseline. TLS 1.3 enforced at the ingress (HTTP→HTTPS redirect, HSTS max-age 1 year). Bcrypt with cost 12 for password hashing. PostgreSQL field-level encryption using `pgcrypto` for payment-sensitive data (IBAN, SDD mandates). Row-level security (RLS) optional overlay for large Enterprise tenants. Rate limits applied by `@nestjs/throttler` at 120 req/min/user for general endpoints, 5 req/min/IP for authentication endpoints.

Observability from day one. Structured Pino JSON logs with mandatory fields `timestamp, level, service, env, version, trace_id, span_id, tenant_id, user_id, correlation_id, message, context`. Prometheus-format metrics exposed at `/metrics` with RED (rate, errors, duration) per endpoint and USE (utilisation, saturation, errors) per resource. OpenTelemetry traces with W3C `traceparent`/`tracestate` propagation — OTLP exporter configurable via `OTEL_EXPORTER_OTLP_ENDPOINT`. Health endpoint at `/api/health` returning `{status, service, version, build_sha, uptime_seconds, time, dependencies:{postgres,redis}}`.

Testing pyramid. 70% unit tests on service methods and guards with mocked repositories and cache; 20% integration tests using Testcontainers-spun PostgreSQL 16 and Redis 7 instances against the real TypeORM repository layer; 10% end-to-end tests using Playwright against docker-compose — covering four canonical user journeys: create product → receive stock → sell → invoice, create production order → run work orders → complete, register → login → create tenant → invite user, bulk import from Excel → verify data integrity. Target coverage: 70% lines / 60% branches at MVP, 80% / 70% at v1.

Cloud-neutral and container-first. All services ship with multi-stage Dockerfiles, non-root runtime users, pinned Alpine Linux base images (node:20-alpine, postgres:16-alpine, redis:7-alpine), and image digest pinning at Kubernetes manifest level in production. Terraform modules target AWS (eu-south-1 Milan for data residency) as the primary deployment and include placeholder parity modules for Aruba Cloud — the Italian-sovereign alternative critical for PA-facing contracts and for some NIS2-impacted customers per ACN Linee Guida per il Cloud della PA.

### 4.2 NestJS Backend Module Design

AppModule (composition root). Imports `ConfigModule` (reads from `.env.local`, `.env`, environment), `TypeOrmModule.forRootAsync` (connection-pooled PostgreSQL via `pg` driver, max pool 20 per replica, idle timeout 30s, TLS-required in production), `CacheModule.registerAsync` with the `cache-manager-redis-store` (default TTL 300s, max items 1000), `ThrottlerModule` for rate limiting, and all feature modules.

AuthModule. Handles registration, login, JWT issuance and refresh-rotation, logout, and authenticated profile retrieval. Uses Passport's `JwtStrategy`. Emits an `audit.user.login` event on success and `audit.user.login.failed` on failure for consumption by the audit-log stream. Exposes an `AuthGuard` consumed by other modules for route protection.

TenantsModule. Owns the `tenants` entity (id, name, vat_number (partita IVA — CHAR(11)), fiscal_code, created_at, plan, settings_jsonb, billing_address, sdi_destination_code, pec_email) plus a `tenant_users` join table for user-tenant-role mapping supporting users belonging to multiple tenants (common scenario: a commercialista managing 30 small-business tenants; a holding company administrator viewing three subsidiary tenants). Provides a `TenantContext` request-scoped provider resolving the active tenant from the JWT claim `tenant_id` and supplying it to downstream service methods.

InventoryModule. Products, warehouses, stock_levels, stock_movements entities with the full movement-type enum (inbound, outbound, transfer, adjustment, production_consumption, production_output, return, scrap) backing a transactional stock ledger. BOM support stored as JSONB on the product entity supporting multi-level nested BOMs. Inventory valuation uses FIFO by default with LIFO and weighted-average options configurable per tenant. Low-stock alerts raised via an internal event bus subscribed by the notification service (email + in-app badge).

ProductionModule. Production orders and work orders with a strictly enforced state machine: DRAFT → PLANNED → CONFIRMED → IN_PROGRESS → COMPLETED (or CANCELLED at any non-terminal state). Work orders form a DAG of operations across work centres; start-transition auto-triggers `PRODUCTION_CONSUMPTION` stock movements against the BOM; completion auto-triggers `PRODUCTION_OUTPUT` movements for finished goods. Dashboard endpoints aggregate KPIs (active orders, completion rate, overdue orders, average efficiency vs. planned duration, per-work-centre utilisation).

SalesModule. Customers (anagrafica clienti with partita IVA + codice fiscale + SDI destination code + PEC email), sales quotations, sales orders, delivery notes (DDT), invoice generation (handoff to the AccountingModule for FatturaPA XML). Pipeline analytics with customer-segment drill-down.

AccountingModule. Chart of accounts seeded with the Piano dei Conti IV Direttiva CEE template; journal entries with double-entry enforcement at the database constraint level; invoice entity with FatturaPA v1.2.2-compatible fields (CedentePrestatore, CessionarioCommittente, DatiGenerali, DatiBeniServizi, DatiPagamento, TipoDocumento TD01–TD28); IVA liquidation reports (mensile, trimestrale); F24 generation handoff; export paths compatible with commercialista studio software (Zucchetti Studio, TeamSystem Studio) via CSV schema mapping.

ConfigModule. Tenant-scoped settings (default warehouse, default currency — EUR, IVA defaults, fiscal-year start, reporting schedules). System-level feature flags gated by tenant plan (Base/Professionale/Enterprise).

HealthModule. `/api/health`, `/api/health/ready`, `/api/health/live` endpoints. The primary `/api/health` returns `{status, service, version, build_sha, uptime_seconds, time, dependencies:{postgres, redis}}`, probing both backing services with a 1-second hard timeout. Readiness distinguishes "ready to serve traffic" from "alive" (liveness), enabling Kubernetes to remove unready replicas without restarting them.

### 4.3 PostgreSQL Schema Design

UUID v4 primary keys on every entity for global uniqueness and for safe sharding later. Composite unique indexes on `(tenant_id, business_key)` (e.g., SKU, warehouse code, order number). Tenant_id as the first column of every multi-column index enforces index seeks rather than scans on multi-tenant queries. JSONB columns for flexible semi-structured data: BOM multi-level trees, quality-check record payloads, tenant settings, audit-log payload snapshots.

Foreign keys declared explicitly with `ON DELETE CASCADE` for child records (stock_levels cascade from products, work_orders cascade from production_orders) and `ON DELETE RESTRICT` for references (customer references on invoices). Check constraints encode business rules at the database layer: `quantityOnHand >= 0`, `total = sum(line_totals)`, `debit = credit` per journal entry (as a deferred-constraint with a trigger).

Partitioning plan. Once `stock_movements` exceeds ~10M rows (projected ~24 months post-launch at mid-scale), we declaratively partition by month using PostgreSQL 16 range partitioning. Audit log table partitioned quarterly from day one. Read-heavy reporting queries flipped to partition-pruning via `tenant_id + date_range` composite filters.

Schema migrations run via TypeORM migration CLI in dev; in production, a controlled migration runner is invoked as a Kubernetes Job before each deployment (ensures no app replicas boot against a mid-migration schema).

### 4.4 Redis Strategy

Three concerns, one Redis instance (or cluster in production). First, session caching: user session payloads (user_id, role, tenant_id) with 1-hour TTL matched to access-token lifetime, keyed `session:<userId>`. Second, data caching: list queries keyed `<entity>:<tenant_id>:<query_hash>` with 60-second TTL (products, warehouses, customers) or 300-second TTL (rarely-changing reference data like currencies, countries). Cache invalidation uses a tagged-key scheme: on mutation, `DEL <entity>:<tenant_id>:*` purges all relevant cache entries for that tenant — bounded in scope, idempotent, cheap. Third, rate-limiting state: `@nestjs/throttler` reads and writes counter keys with IP+endpoint composite keys.

Redis eviction: `allkeys-lru` policy with 256 MB memory limit in dev, 1–4 GB in production (scaled with tenant count). Redis Sentinel for high-availability in production. BullMQ queues use a dedicated Redis database (`db=1`) to isolate queue data from cache data.

### 4.5 Request Pipeline

Every API request travels through a deterministic pipeline: (1) ingress TLS termination and HSTS enforcement at Traefik/Nginx; (2) CORS preflight check against the whitelist of origin domains; (3) `/api` global prefix normalisation; (4) `ThrottlerGuard` Redis-backed rate-limit check; (5) `ValidationPipe` with `whitelist:true, forbidNonWhitelisted:true, transform:true` to strip extra fields and coerce types; (6) `AuthGuard` JWT verification and `TenantContext` hydration; (7) controller dispatch; (8) service method with TypeORM repository + Redis cache interaction; (9) response transformation by interceptors (adds `X-Request-ID`, logs latency and status, emits OpenTelemetry span); (10) response emitted with `Content-Type: application/json; charset=utf-8`.

Errors follow RFC 7807 problem-details format: `{type, title, status, detail, instance, errors?}`. Correlation IDs (`X-Request-ID`) are generated at ingress and propagated through logs and traces.

### 4.6 Multi-Tenancy Implementation (Concrete)

Data access pattern. Every service method that reads or writes includes `tenantId` in the WHERE clause. The `TenantContext` request-scoped provider extracts `tenant_id` from the verified JWT claim and passes it to repository methods; no service can accidentally cross-tenant because no repository query omits the tenant filter. A custom lint rule `no-untenanted-query` in the CI ESLint config flags any `.find*`, `.count`, or `.update*` call without a `tenantId` key.

Test isolation. Integration tests use a dedicated `tenant_test_*` namespace with per-test cleanup; cross-tenant access attempts throw in a `TenantGuard` that validates tenant scope against JWT claim at service-method entry.

Migration path. When a tenant crosses 10M rows or demands dedicated-schema isolation, a runbook executes: (1) create new PostgreSQL schema `tenant_<id>`; (2) dump-and-restore tenant rows into the new schema; (3) update the tenant's routing config in Redis; (4) the next request for that tenant flows through the `SchemaRouter` which selects the appropriate connection pool; (5) data mutations resume on the new schema without application code changes.

### 4.7 Failure Modes and Consistency

PostgreSQL unavailable → backend returns 503 with a `Retry-After: 10` header; Redis unavailable → backend runs in "degraded" mode (cache-miss on every read, rate-limiting disabled or fallback to in-memory per-replica); BullMQ backlog → configurable circuit-breaker rejects new job submissions after queue depth exceeds 10,000; OpenTelemetry collector unavailable → spans are discarded (no retry buffer to avoid back-pressuring the application).

Consistency model. Intra-tenant operations run at PostgreSQL's default READ COMMITTED isolation. Cross-module operations that touch multiple entities (e.g., sales-order→invoice→accounting entry) run in explicit transactions. Eventual consistency is acceptable only for cross-tenant aggregates (e.g., anonymised benchmarking reports) and for cache. The audit log is append-only with an explicit flush via Redis Streams to PostgreSQL within 60 seconds.

### 4.8 Scalability Patterns

Vertical before horizontal: the backend is optimised to run comfortably at 500 RPS per 2-vCPU/4-GB-RAM pod steady state. P95 targets: <200 ms for list endpoints (page size 50 over tables <10M rows), <400 ms for aggregate reporting endpoints, <3-second cold start. Horizontal scaling via Kubernetes `HorizontalPodAutoscaler` with target CPU 70%, min 2 replicas, max 10.

Database scaling: PgBouncer (transaction pooling, pool size 20 per app instance) fronts PostgreSQL; read replicas (AWS RDS Aurora read endpoints or self-managed Postgres streaming replication) serve reporting queries. When sharding becomes necessary, tenants are distributed across shards via consistent hashing of `tenant_id`, with a shard-routing map cached in Redis.

### 4.9 Background Jobs and Asynchronous Work

BullMQ queues on Redis backend handle all asynchronous workloads. Three principal queues: `reports` (nightly tenant reports, monthly IVA-liquidation generation, on-demand exports), `billing` (maintenance renewals, failed-payment retries with Stripe), `integrations` (FatturaPA XML submission to SDI intermediary, Conservazione a Norma handoff, webhook retries). Each queue has a dedicated worker pool (Kubernetes Deployment `worker-reports`, `worker-billing`, `worker-integrations`) with independently scaled replicas. Jobs are idempotent by design (job ID includes the resource hash) so retries are safe. Failed jobs are moved to a `dead-letter` queue with alerting; dead-letter entries are reviewed weekly by the on-call engineer.

Scheduled jobs via BullMQ repeater: daily 01:00 CET end-of-day accounting-posting consolidation; weekly Sunday 23:00 CET tenant-analytics rollup; monthly 1st-of-month 02:00 CET IVA liquidation draft for all active tenants; quarterly 1st-of-quarter tax-period closing.

### 4.10 Data Import and Export Surface

Every entity supports bulk CSV import via `POST /api/v1/imports/{entity}` with a two-phase workflow: (1) validation phase returns a job ID and a validation report (counts, error rows, warnings); (2) commit phase processes validated rows through the standard service layer (preserving audit logs and invariants). The import engine supports a "dry-run" mode that validates without committing. Templates available: products, customers, suppliers, warehouses, opening-stock balances, chart-of-accounts mappings, journal entries, legacy-system migration packages.

Export surface mirrors import: `GET /api/v1/exports/{entity}` returns Excel (XLSX, preferred by commercialisti and typical Verona SME users), CSV (UTF-8 with BOM to satisfy Excel's default-encoding quirks for Italian characters), JSON (for API consumers and for the GDPR-portability flow), and PDF (for formal reporting). Export operations over 10,000 rows run asynchronously via the `reports` queue with email notification on completion.

## 5. Development Roadmap

### 5.1 Phase 1 — Core Platform MVP (Months 1–6)

Phase 1 delivers the MVP against which SmartERP acquires its first 10–15 paying customers. Scope priorities reflect manufacturing-SME pain points from the Verona discovery research (Q4 2025): fragmented data, manual invoicing, lack of real-time production visibility.

Sprints 1–2 (weeks 1–4): Foundation. Set up monorepo (two-package: backend, frontend), CI/CD skeleton, coding standards, PR review protocol, ADR repository. Deliver AuthModule (register, login, JWT refresh, profile, logout), TenantsModule (tenant creation on registration, user-tenant associations), and the HealthModule. Dockerise dev stack; set up Terraform skeleton for AWS eu-south-1.

Sprints 3–5 (weeks 5–10): Inventory. Ship InventoryModule end-to-end: product CRUD with categories, multi-unit-of-measure, supplier info; warehouse CRUD with zones; stock-level projection; the eight-type stock-movement ledger; automatic low-stock alerting; inventory valuation report (FIFO). Frontend: product list, product detail, warehouse list, stock-movement form, stock-level dashboard.

Sprints 6–8 (weeks 11–16): Production. Ship ProductionModule: production-order lifecycle with state machine; work-order sequencing and work-centre assignment; multi-level BOM; the production dashboard with KPIs. Integrate inventory: automatic material-consumption movements on work-order start, finished-goods output movements on completion. Frontend: production-order list, production-order detail with Gantt-style timeline, work-order Kanban board.

Sprints 9–11 (weeks 17–22): Accounting and e-Invoicing. Ship AccountingModule: Italian electronic-invoicing flow (FatturaPA XML generation per v1.2.2 spec, handoff queue to SDI intermediary integration — Aruba Doc Manager, Namirial, InfoCert accepted), Piano dei Conti IV Direttiva CEE seed template, journal entries with double-entry enforcement, scadenzario (payment schedule) with due-date and overdue alerts, IVA liquidation monthly/quarterly reports. Frontend: invoice list, invoice-creation wizard, payment calendar, IVA liquidation report view.

Sprint 12 (weeks 23–24): MVP hardening. Full end-to-end Playwright test suite. Performance profiling and index tuning. Security review against OWASP ASVS L2. DPIA documentation for GDPR. Penetration test by an external firm. Beta launch with 3–5 pilot customers (two Mozzecane-area metal shops, one Villafranca plastic moulder, one Isola della Scala food-packaging company, one opportunistic from Mantova).

### 5.2 Phase 2 — Advanced Features and Market Expansion (Months 7–12)

Months 7–8: SalesModule complete. CRM with contact history, quotations with templates, sales orders linked to production orders, DDT (documento di trasporto) generation, sales analytics with pipeline visualisation. Intrastat export for intra-EU transactions.

Months 8–9: Purchasing. Supplier management with performance scoring (on-time delivery, quality rating), purchase requisitions with approval workflows, purchase orders linked to inventory reorder points, goods-receipt matching against POs, supplier-invoice reconciliation.

Months 9–10: HR-lite. Employee anagrafica (linked to but not replacing a dedicated payroll system — SmartERP integrates with TeamFlow and external payroll providers like Zucchetti Paghe or TeamSystem Payroll), attendance tracking with clock-in/out, leave management (ferie, permessi, ROL, ex-festività, malattia) with approval workflows, organisational chart.

Months 10–11: Business Intelligence. Custom report builder with drag-and-drop field selection; pre-built Italian-manufacturing dashboards (OEE, inventory turnover, DSO, DPO, cash-conversion cycle, Gross Profit per product); automated report scheduling and PEC/email delivery; interactive dashboards with drill-down.

Months 11–12: Mobile PWA. Progressive Web App for mobile access: barcode scanning via device camera (ZXing / html5-qrcode), production-order shop-floor updates, push notifications via Web Push, offline-capable stock-receiving with sync-on-reconnect.

### 5.3 Phase 3 — AI and Intelligent Automation (Months 13–18)

Demand Forecasting. ML models (initially Prophet, later LSTM) trained on per-tenant historical sales data, seasonality, and optional external signals (ISTAT industrial production index, Euribor rates as demand leading indicators). Recommendations automatically adjust safety-stock and suggest reorder quantities. Delivered via a weekly forecast generation job.

Production Scheduling Optimisation. Constraint-based scheduling (Google OR-Tools CP-SAT solver wrapped in a service) considering machine capacity, operator availability, material availability, delivery deadlines, and setup times. Solver runs on-demand via a dedicated worker pool; typical SME scale (<500 operations) solves in <30 seconds.

Anomaly Detection. Statistical process control on production data (cycle times, scrap rates) using EWMA control charts; AI-driven anomaly flagging on unusual cost-to-produce deviations.

Natural Language Reporting. LLM-backed (initially Anthropic Claude via the official SDK) natural-Italian query interface: "Quanti pezzi del prodotto A-100 abbiamo prodotto questo mese?"; "Qual è il fornitore con i tempi di consegna migliori?" Implementation uses function calling against the SmartERP API, ensuring the LLM sees only structured data and cannot hallucinate numbers.

### 5.4 Phase 4 — Platform and Marketplace (Months 19–24)

Third-Party Module Marketplace. Partner-developed modules with revenue share. Partner certification programme. Developer portal with SDK, API reference, example modules. First-wave partner targets: Italian quality-management specialist, automotive EDI specialist, CNC/MES connector vendor.

Integration Hub. Pre-built connectors: Aruba PEC, SPID authentication, PSD2 banking APIs for cash-position automation, Shopify/WooCommerce for e-commerce, TeamSystem Paghe for payroll handoff, InfoCert and Namirial for SDI transmission, Aruba Conservazione for conservazione a norma.

Commercialista Partner Portal. Multi-tenant partner dashboard for accountants managing multiple client companies, bulk fiscal export, and consolidated reporting.

### 5.5 MoSCoW Prioritisation and Sprint Cadence

Must Have (Phase 1): Authentication, multi-tenancy, Inventory CRUD and ledger, Production orders and work orders, Electronic invoicing (FatturaPA), Chart of accounts seeded, Audit logging, GDPR data-subject workflows, Italian-language UI end to end.

Should Have (Phase 2): Sales orders + DDT, Purchasing, HR-lite, Advanced BI, Mobile PWA, Bulk import/export.

Could Have (Phase 3): AI demand forecasting, Scheduling optimisation, Natural-language reporting, Multi-company consolidation, Advanced benchmarks.

Won't Have (out of scope for v1–v2): Full MRP II beyond basic BOM; warehouse automation / WMS; project management; e-commerce storefront; payroll calculation (always delegated to the specialised Italian payroll ecosystem in line with commercialista practice).

Sprint cadence. Two-week sprints. Sprint planning Monday morning of week 1; retrospective Friday afternoon of week 2. Daily stand-up 09:30 (15-minute hard cap). Product backlog maintained in GitHub Projects, prioritised weekly by the CTO in consultation with the Head of Product (initially the CEO). Deployments to production at least twice weekly (Tuesday and Thursday 08:00–09:00 CET), through the CI/CD pipeline with mandatory green staging run and smoke tests before production promotion.

Technical-debt budget. 15% of sprint capacity reserved for tech-debt reduction. Debt items tracked in a dedicated backlog with estimated effort and impact; the CTO owns the decision to convert debt into sprint commitment. Quarterly "tech-debt week" ensures accumulated debt does not compound.

---

# PART III — SCALING & OPERATIONS

## 6. Scaling Strategy

### 6.1 Technical Scaling Stages

Stage 1 — Single-Server (0–50 tenants, months 1–6). Single AWS EC2 m5.large (2 vCPU, 8 GB RAM) running docker-compose for backend + frontend + PostgreSQL + Redis. Automated nightly `pg_dump` to S3. Monthly infrastructure cost: €150–200. Appropriate for pilot programme and early revenue.

Stage 2 — Separated Services (50–200 tenants, months 6–18). Backend and frontend as container workloads on AWS ECS Fargate (or a small managed Kubernetes cluster via Amazon EKS). PostgreSQL migrated to AWS RDS for PostgreSQL 16 (db.t4g.medium, Multi-AZ for failover, 7-day point-in-time recovery). Redis migrated to AWS ElastiCache for Redis (cache.t4g.micro, Multi-AZ replication). CloudFront CDN in front of frontend and static assets. Monthly cost: €500–900.

Stage 3 — Horizontal Backend (200–1,000 tenants, months 18–30). Backend deployed as a Kubernetes Deployment with `HorizontalPodAutoscaler` (target CPU 70%, min 2 max 10 replicas). PostgreSQL with read replica (`db.r6g.large`) handling 60–70% of SELECT traffic (reporting queries marked via a `readOnly: true` flag on the TypeORM transaction, which routes to the replica connection pool). PgBouncer fronts the cluster in transaction-pooling mode. Redis Sentinel for cache HA. Monthly cost: €1,800–3,500.

Stage 4 — Multi-Region (1,000+ tenants, year 3+). Regional Kubernetes clusters in AWS eu-south-1 Milan (primary for Italy) and eu-west-1 Ireland (DR + European expansion). Global Route 53 latency-based routing. Cross-region PostgreSQL replication via AWS DMS or self-managed logical replication. Per-region Redis. CloudFront for edge caching. Monthly cost: €5,500–12,000.

Stage 5 — Tenant Sharding (2,500+ tenants). Tenant-to-shard mapping stored in Redis; each shard is an independent PostgreSQL cluster (AWS Aurora Serverless v2 suits variable workloads here). Application's data-access layer uses the `SchemaRouter` to select the right connection pool per tenant.

### 6.2 Database Scaling Deep-Dive

Connection pooling with PgBouncer is non-negotiable from Stage 2 onward. In transaction-pooling mode each application connection holds a PgBouncer pooler slot for the duration of one transaction, minimising PostgreSQL connection pressure. Default configuration: `pool_mode=transaction`, `default_pool_size=20` per application replica, `max_client_conn=500`. Prepared statements are disabled in transaction mode — mitigated by query plan caching.

Read replicas offload reporting. The TypeORM datasource in production declares a primary + `slaves[]` pair; SELECT queries flagged `readOnly: true` are routed to a random replica. Writes and read-your-writes scenarios use the primary explicitly. Replica lag is monitored via `pg_stat_replication.replay_lag`; alert fires at >5 seconds (corresponds to a Postgres-level SLO).

Partitioning for append-heavy tables. `stock_movements`, `audit_logs`, `accounting_entries` partitioned by month. Partition pruning in query planning reduces scan cost from O(N_total) to O(N_month). Partition maintenance (detach old, create next) automated via a pgAgent cronjob.

Tenant-based sharding triggers at single-instance write-throughput ceiling (~5,000 writes/second for a general-purpose RDS class). Sharding strategy: consistent hashing of `tenant_id` over N shards with the hash-ring reshuffle minimised by a virtual-node scheme. Each shard holds tenant data + its own connection pool; cross-shard queries are explicitly disallowed at the application layer (with the exception of anonymised benchmarking aggregations, computed nightly into a separate analytics warehouse).

### 6.3 Caching Hierarchy

Layer 1 — Browser (Next.js + CDN). Static assets served through CloudFront with long-lived cache headers (1 year immutable on hashed bundles). `stale-while-revalidate` on fetch responses for dashboards.

Layer 2 — Application cache (Redis). Data-caching keys scoped by `<entity>:<tenant_id>:<query>`. TTLs: 60s for list queries, 300s for reference data (currencies, countries, tax codes), 1h for session data.

Layer 3 — Database query plans. PostgreSQL auto-analyze reviews plans; `pg_stat_statements` identifies hot queries; execution plans cached implicitly by the plan cache.

Layer 4 — OS page cache. PostgreSQL relies heavily on the OS page cache for hot blocks; the RDS instance class is sized so that hot indexes (products, stock_levels primary, audit_log most-recent-month) fit in memory at 10× the steady-state working set.

### 6.4 CDN Strategy and Asset Delivery

CloudFront as the edge CDN in front of the Next.js frontend and static assets. Origin is an S3 bucket for static assets and an Application Load Balancer fronting the frontend Kubernetes service for dynamic content. Custom error pages for 404/500 branded appropriately. Asset versioning via content hashes ensures cache-busting on deploy.

Italian-specific optimisation: CloudFront's Milan edge (MXP) is geographically optimal for Veneto customers; p95 round-trip <30 ms from Verona is routinely achieved.

### 6.5 Geographic Expansion Plan

Circle 1 (months 1–12): Mozzecane and Verona province. Face-to-face pilots, local trade-show presence (Verona Agrifood, Fieragricola indirectly via food-processing district), direct sales team operating from Mozzecane hub. Target: 15–30 customers.

Circle 2 (months 12–18): Veneto (Vicenza metalwork+gold, Padova services+tech, Treviso fashion+Prosecco, Belluno eyewear+mountain tourism). Regional sales reps. Leverage Confindustria Veneto's network. Target: +30–60 customers.

Circle 3 (months 18–30): Northern Italy (Lombardia Orientale — Brescia metalwork, Bergamo; Emilia-Romagna — Bologna automotive, Modena motor-valley, Reggio mechanical; Trentino-Alto Adige — Bolzano export-oriented manufacturing; Friuli Venezia Giulia — Pordenone furniture). Milan satellite office. Partner with regional IT consulting firms and commercialista networks. Target: +60–100 customers.

Circle 4 (months 30–48): National coverage and European expansion. Tuscany (fashion/leather Firenze-Prato, mechanical Pistoia-Lucca), Marche (furniture, footwear), Piemonte, Liguria, Lazio. Opportunistic Slovenian/Austrian expansion leveraging Bolzano presence and Italian-speaking Austrian neighbouring markets (Veneto-Austria cross-border commerce). Target: national SME cloud-ERP leadership in manufacturing.

## 7. Security & Compliance

### 7.1 GDPR Architecture

SmartERP operates as a data processor for its customers (the tenants) who are data controllers of their own employee, customer, and supplier records. The Data Processing Agreement (DPA) template, executed as part of the customer sign-up flow, specifies Article 28 Reg. UE 2016/679 obligations: scope and purpose of processing, sub-processor disclosure (AWS Ireland/Milan, Aruba Doc Manager for SDI, Anthropic for optional AI features), audit rights, breach-notification workflow (24-hour early warning / 72-hour initial notification to the tenant controller, in line with D.Lgs. 196/2003 as amended by D.Lgs. 101/2018 and the Garante's procedural guidance).

Data minimisation. The registration flow requires only name, email, company, partita IVA (optional initially, mandatory for fiscal functions). The HR module collects employee data only with explicit tenant-controller consent and a documented lawful basis.

Data-subject rights. Dedicated API endpoints implement right of access (`GET /api/v1/gdpr/export`), rectification (standard CRUD), erasure (`POST /api/v1/gdpr/erase`), portability (JSON export), and restriction. The erase endpoint executes cascading soft-delete plus crypto-shredding of encryption keys for irrecoverable hard erasure within 30 days (default Garante expectation is "without undue delay, typically within one month").

Consent and DPIA. A consent-registry log records per-tenant consent decisions. A DPIA template (Data Protection Impact Assessment) ships as part of the onboarding documentation for high-risk processing — a DPO (Data Protection Officer) designation is available for Enterprise tier customers.

Data residency. All data resides in AWS eu-south-1 Milan or eu-west-1 Ireland (customer-configurable). No extra-EU transfer without SCCs; default is EU-only processing. Aruba Cloud alternative available for tenants requiring Italian-sovereign infrastructure (PA suppliers, some NIS2-essential/important entities per D.Lgs. 138/2024).

### 7.2 Italian Fiscal Compliance Depth

Fatturazione elettronica (D.Lgs. 127/2015 art. 1, Provvedimento AdE 89757/2018). Invoices generated in FatturaPA v1.2.2 XML with full schema coverage (FatturaElettronicaHeader: CedentePrestatore, CessionarioCommittente; FatturaElettronicaBody: DatiGenerali with TipoDocumento TD01–TD28, DatiBeniServizi, DatiPagamento). Transmission handoff to an accredited intermediary (Aruba PEC/Aruba Doc Manager, Namirial, InfoCert) with queue-and-retry semantics. Receipt lifecycle tracking (NS — Notifica Scarto; MC — Mancata Consegna; RC — Ricevuta Consegna; DT — Decorrenza Termini). Esterometro obsolete since 01/07/2022; cross-border transactions submitted via SDI using TD17–TD19 document types per AdE technical rules.

Conservazione a Norma. 10-year digital preservation per DPCM 3/12/2013 and DPCM 17/06/2014 (successive AgID Circolari — Circolare AgID 65/2014, Circolare AgID 2/2017 for security baselines). Integration with Aruba Conservazione or InfoCert Legalmail Conservazione as the accredited conservation service provider.

IVA regimes. Full matrix support: ordinario (22% standard, 10% reduced, 5% food-hospitality, 4% super-reduced, 0% exempt, natura N1–N7 for non-taxable operations), forfettario (regime agevolato with flat-rate coefficiente di redditività — soglia €85,000 since 2023), regime dei minimi (legacy, decreasing relevance), split payment for PA-facing transactions (art. 17-ter DPR 633/1972), reverse charge (construction subcontracts, scrap metals, precious metals, domestic).

F24 generation. Monthly IVA-liquidation export and F24 payment-mandate XML generation per AdE specifications for direct submission or handoff to bank home-banking systems.

Codice dell'Amministrazione Digitale (D.Lgs. 82/2005). PEC (Posta Elettronica Certificata) as first-class legal-communication channel. SPID and CIE integration placeholder for authentication (initially targeting customer-facing portal; Phase 3 roadmap). Firma Elettronica Avanzata (FEA) integration for internal approval workflows (Enterprise tier).

### 7.3 Application Security (OWASP ASVS L2)

Authentication. Bcrypt cost 12 for passwords. Password policy per NIST SP 800-63B: minimum length 12, no forced rotation, breach-database check against Have I Been Pwned API on registration and password-change. JWT with HS256 (development) and RS256 (production, keys stored in AWS KMS); 15-minute access-token TTL; rotating 7-day refresh tokens. Account lockout: 5 failed attempts within 15 minutes → 15-minute cooldown, exponential increase on repeat lockouts.

Authorisation. Role-Based Access Control: admin, manager, operator, viewer, plus per-tenant custom roles (Phase 2). Policy enforcement at controller decorator level (`@Roles('admin','manager')`) and at service boundary (double-check in the service method). Attribute-based overrides for per-tenant settings (e.g., Enterprise-only feature flag).

Transport. TLS 1.3 only in production (TLS 1.2 acceptable for legacy browser support until 2027). HSTS `max-age=31536000; includeSubDomains; preload`. Certificate auto-rotation via cert-manager in Kubernetes (Let's Encrypt or AWS ACM).

Input validation. class-validator decorators on every DTO; `ValidationPipe` with `whitelist:true, forbidNonWhitelisted:true`. Regex validators for Italian-specific formats (partita IVA, codice fiscale, IBAN, CAP).

Security headers. Content-Security-Policy restrictive (default-src 'self'; script-src 'self' — no inline scripts; img-src 'self' data:; connect-src 'self' https://api.smarterp.it). X-Content-Type-Options nosniff. Referrer-Policy strict-origin-when-cross-origin. Permissions-Policy restrictive. X-Frame-Options DENY.

Dependency security. `npm audit` in CI; Dependabot (GitHub-native) for automated security PRs; Trivy container scans; SBOM (Software Bill of Materials) generated with Syft and uploaded as a CI artefact; Cosign signing of production container images.

Audit logging. Every state-changing operation writes to `audit_log` table: `(id, tenant_id, user_id, action, resource_type, resource_id, payload_before_jsonb, payload_after_jsonb, ip_address, user_agent, correlation_id, timestamp)`. Retained 10 years per Italian fiscal requirements (art. 2220 Codice Civile).

### 7.4 NIS2 Preparedness

D.Lgs. 138/2024 expanded the perimeter of "essential" and "important" entities (annex I–II), many of which are SmartERP customers or parent groups. SmartERP's platform-level security controls (OWASP ASVS L2, audit logging, incident response, breach notification) support customer compliance: the platform itself is not directly in the NIS2 scope (it's a supplier), but customers in scope can rely on SmartERP for the structured audit and documentation that NIS2 risk-management demands. A "NIS2 Compliance Pack" PDF is included with the Enterprise tier, mapping SmartERP controls to NIS2 articles and ACN incident-reporting requirements (24-hour early warning / 72-hour initial notification / 30-day final report).

### 7.5 Audit-Log Architecture and Fiscal Record Retention

Art. 2220 Codice Civile mandates 10-year retention of accounting documents, and art. 39 DPR 633/1972 imposes the same on IVA-related records. SmartERP's audit log is engineered for both operational incident forensics and fiscal compliance. Every state-changing operation (create, update, delete on any tenant entity) emits an immutable log record: `(id, tenant_id, user_id, action_type, resource_type, resource_id, payload_before_jsonb, payload_after_jsonb, ip_address, user_agent, correlation_id, session_id, timestamp)`. The log table is quarterly-partitioned from day one. The Write path flushes via Redis Streams to PostgreSQL within 60 seconds; the stream acts as a buffer so that PostgreSQL downtime does not block application writes (critical for a system of record for manufacturing operations).

Archive strategy. Partitions older than 13 months are detached from the live table and exported to S3 Glacier Deep Archive in compressed Parquet format, retaining query access via Athena when forensic investigation requires. Legally-required 10-year retention is guaranteed by the Glacier Deep Archive lifecycle rule (`retention-years=10`, WORM-locked via S3 Object Lock with Governance mode).

Reconciliation. Monthly reconciliation job compares `audit_log` record counts against `stock_movements` + `accounting_entries` + `invoices` write counts; any discrepancy raises a P2 alert for investigation. The expectation is 1-to-1 correspondence between state-changes and audit rows.

### 7.6 Secrets Management

AWS Secrets Manager stores: database credentials (rotated every 90 days via the built-in rotation Lambda), JWT signing keys (rotated every 180 days with overlap period for in-flight tokens), third-party API keys (Stripe, InfoCert, Aruba, Namirial), Anthropic API key (for Phase 3 AI features), SMTP credentials, ACN/Garante notification endpoints.

Local development uses `.env.local` files (git-ignored) mirroring the production secrets structure. Developers obtain `.env.local` through the `smarterp-dev init` CLI which fetches scoped development secrets from Secrets Manager into the local file — ensuring no production secret ever leaves AWS.

## 8. Infrastructure & DevOps

### 8.1 Cloud Provider Selection

AWS as primary provider, with AWS Region `eu-south-1` (Milano) as the default data-residency region for all Italian customers. Rationale: eu-south-1 satisfies both GDPR data-residency expectations and Italian-sovereignty pressures from PA-adjacent customers; AWS's managed-service ecosystem (RDS, ElastiCache, MSK, Secrets Manager) reduces operational burden for a small team; AWS Activate provides $10,000–100,000 in credits for early-stage startups through Italian accelerators (ICE, Marzotto Venture Accelerator) and venture partners.

Aruba Cloud is provisioned as a parallel IaC target for tenants whose contracts require Italian-sovereign infrastructure (PA-facing deployments, some NIS2-essential/important entities that prefer Italian-registered infrastructure providers). Aruba Cloud's Ponte San Pietro (BG) and Arezzo data centres are Tier IV-certified; their managed PostgreSQL and Redis offerings cover SmartERP's needs for a subset of customers at modestly higher unit cost.

### 8.2 Infrastructure as Code

Terraform is the single source of truth for infrastructure. Modules: `networking/` (VPC with public + private subnets across 3 AZs, NAT gateways, security groups), `compute/` (ECS task definitions or EKS node groups, autoscaling policies), `database/` (RDS Aurora PostgreSQL 16, parameter groups, Multi-AZ, automated backups 35-day retention), `cache/` (ElastiCache Redis cluster with Multi-AZ, Sentinel), `storage/` (S3 buckets with versioning, lifecycle rules — hot 90 days → standard-IA 1 year → Glacier), `cdn/` (CloudFront with WAF rules), `secrets/` (AWS Secrets Manager), `monitoring/` (CloudWatch dashboards, alarms, SNS topics routing to PagerDuty).

Terraform Cloud for state management and remote execution. Drift detection weekly. All PRs require `terraform plan` output attached.

Kubernetes manifests under `k8s/` in Git. GitOps deployment via Argo CD to production. Base manifests + Kustomize overlays per environment (dev, staging, production). Services: `deployment.yaml` (rolling update, liveness at `/api/health/live`, readiness at `/api/health/ready`, resource requests 250m CPU/256Mi RAM, limits 1000m/1Gi), `service.yaml` (ClusterIP), `ingress.yaml` (TLS via cert-manager + Let's Encrypt), `configmap.yaml`, `secret.yaml` (SOPS-encrypted in Git), `hpa.yaml` (min 2 max 10 replicas, CPU target 70%), `pdb.yaml` (maxUnavailable 1).

### 8.3 Monitoring, Observability, Alerting

Three pillars implemented from day one. Metrics: Prometheus scraping application `/metrics` and node exporters; Grafana dashboards provisioned as code (`SmartERP-Overview`, `SmartERP-Tenant-Activity`, `SmartERP-Jobs`, `SmartERP-Errors`, `SmartERP-DB-Health`); alerting rules in Prometheus Alertmanager routing to PagerDuty (primary on-call) and Slack (secondary notification).

Logging: structured Pino JSON logs collected by Fluent Bit → CloudWatch Logs → optional Loki for long-term retention. Log levels: `debug` in dev, `info` in staging, `warn`/`error` in production (with per-tenant trace-sampling override at `info`).

Traces: OpenTelemetry SDK auto-instruments HTTP, Postgres, Redis, BullMQ. OTLP exporter sends to AWS X-Ray (primary) and Jaeger/Tempo (alternative). W3C trace-context propagation across frontend-backend-database spans.

Baseline alerts. Error rate >1% for 5 minutes → page. P95 latency >500ms on list endpoints for 10 minutes → page. PostgreSQL connection pool saturation >90% → page. Redis memory >85% → warn. Replica lag >5 seconds → warn. Failed login rate >20/minute → page (potential brute force).

SLOs. API availability 99.9% monthly (Professionale, Enterprise) / 99.5% (Base). P95 latency <200ms list, <400ms aggregate. Correctness: <0.01% of invoice-generation attempts result in invalid FatturaPA XML (measured via schema-validation failure rate).

### 8.4 Disaster Recovery

RPO: 1 hour for standard operations (enforced via continuous WAL archiving); 0 seconds for committed transactions (RDS synchronous replication to Multi-AZ standby).

RTO: 15 minutes for RDS Multi-AZ failover (automatic); 4 hours for full database restore from snapshot into a fresh region (documented runbook); 1 hour for application-tier recovery via EKS manifest re-apply from Git.

Quarterly DR drills. Each drill restores production backups to a scratch region, validates data integrity (reconciles product/invoice counts against production), measures RTO/RPO actuals, and documents lessons learned in a DR runbook.

---

# PART IV — BUSINESS OPERATIONS

## 9. Team Structure & Hiring Plan

### 9.1 Founding Team (Months 1–3)

Three founders cover the essential functions in the seed-to-MVP phase.

CTO / Lead Backend Engineer. TypeScript/NestJS/PostgreSQL depth, familiarity with PgBouncer/Redis/BullMQ at scale, DevOps and Terraform literate. RAL (retribuzione annua lorda) band: €65,000–€80,000 plus 15–20% equity. Responsible for architecture, backend delivery, CI/CD, hiring the first two backend engineers.

Frontend Lead / UX Designer. Next.js/React 18/Tailwind expertise, a portfolio showing data-heavy dashboards shipped, sensitivity to Italian-SME UX (not the US consumer-app pattern). RAL €55,000–€70,000 + 10–15% equity. Responsible for the entire frontend, component library, UX research sessions with beta customers.

CEO / Head of Sales + Business Development. Manufacturing-ERP domain expertise ideal (10+ years of commercial experience at TeamSystem, Zucchetti, Passepartout, or at an Italian manufacturing SME with ERP-selection exposure); deep network in Verona/Veneto Confindustria ecosystem; fluent in the commercialista relationship. RAL €70,000–€85,000 + 25–35% equity (typically the largest equity holder post-seed given go-to-market leadership).

### 9.2 Growth Phase Team (Months 4–12)

Month 4–5: Senior Backend Engineer x2 (RAL €48,000–€58,000, ESOP 0.5–1.0%). Focus: Sales + Accounting + Purchasing modules. Required: TypeScript fluency, familiarity with Italian fiscal-logic complexity (FatturaPA XML, IVA matrix), SQL proficiency.

Month 6–7: Senior Frontend Engineer (RAL €45,000–€55,000, ESOP 0.5%). Focus: Mobile PWA, advanced dashboards. DevOps/SRE Engineer (RAL €52,000–€62,000, ESOP 0.5–1.0%). Focus: Production infrastructure, Terraform, Kubernetes, on-call rotation.

Month 8–9: QA Engineer (RAL €35,000–€45,000, ESOP 0.3%). Focus: automated testing (Playwright, Jest integration suite), defect triage. Customer Success Specialist (RAL €32,000–€40,000, ESOP 0.3%). Focus: onboarding, first-line support, Italian-language customer engagement.

Month 10–12: Sales Representative — Verona territory (RAL €32,000–€40,000 base + 25–35% variable tied to annual recurring revenue (licence + maintenance) targets, ESOP 0.3%). Marketing Specialist (RAL €32,000–€42,000, ESOP 0.3%). Focus: LinkedIn/Google Ads, content marketing (weekly Italian-language blog posts on smarterp.it), trade-show coordination.

End of Year 1 headcount target: 11 people. Total compensation budget: approximately €620,000 (RAL) + social charges (~30%) + equity vesting = ~€810,000 loaded cost.

### 9.3 Scale Phase Team (Year 2, Months 13–24)

Year 2 expansion (~6 hires): +1 backend engineer (mid-level, €38,000–€48,000), +1 full-stack engineer for marketplace/integrations (€45,000–€55,000), +1 data engineer for BI and AI modules (€48,000–€60,000), +2 sales representatives (Vicenza/Padova; Bologna/Modena), +1 customer success lead (managing expanded CS team), +1 HR/operations coordinator. End of Year 2 headcount: ~18.

### 9.4 Hybrid and Remote Strategy

Primary office in Mozzecane (VR) initially, with mandatory-2-days-per-week in-office pattern for Verona-area team. Remote-friendly for senior engineering positions recruited beyond Verona (common pattern to pull talent from Milan, Bologna, Trento). All-hands quarterly in-person off-site in Verona. Italian labour-law compliance: standard CCNL "Industria Metalmeccanica" or "Commercio e Terziario" depending on team composition; work-from-home agreements (accordo di smart working) per L. 81/2017. Provisions for maternity/paternity per D.Lgs. 105/2022.

## 10. Marketing & Sales Strategy

### 10.1 Go-to-Market Philosophy

SmartERP's GTM is hyper-local in Year 1 (Mozzecane–Verona) and leverages the deep-trust relationships that govern Veneto SME purchasing. The purchase of an ERP is a 60–120-day considered decision typically involving the titolare/amministratore, the direttore produzione, the IT responsible (if any), and the commercialista. SmartERP addresses each of these personas with tailored messaging and proof points.

### 10.2 Key Channels

Confindustria Verona partnership. Confindustria Verona represents hundreds of manufacturing members. SmartERP pursues a formal technology-partner agreement with: co-branded seminars on "Digitalizzazione PMI manifatturiere veronesi"; inclusion in the recommended-vendor list for Industria 4.0 / Transizione 5.0 transformation projects; access to the Confindustria member directory for targeted outreach; sponsorship of the annual Assemblea degli Industriali. Annual Confindustria partnership cost: €3,000–5,000. Expected Year 1 influence: 20% of pipeline leads.

Trade-show presence. MECSPE (Bologna, the largest Italian manufacturing trade show, 50,000+ attendees annually in March/April); SPS Italia (Parma, automation and digital factory, 35,000+ attendees in May); SMAU Milano (October, tech-for-business, 40,000+ attendees); SMAU Padova (regional Veneto edition); Fieragricola (Verona, February, adjacent for agri-food processors). Booth budget: €8,000–15,000 per event plus travel and staff time. Expected lead-capture: 250–400 qualified leads per MECSPE stand.

Digital marketing. LinkedIn Ads targeting titolari, direttori produzione, responsabili IT in the Veneto manufacturing sector, spending €1,500/month initially, scaling to €3,500/month by month 6. Google Ads on high-intent queries: "gestionale manifatturiero cloud", "ERP PMI Verona", "fatturazione elettronica produzione", spending €1,000–€2,500/month. Content marketing: weekly Italian-language blog on smarterp.it covering fiscal compliance, production optimisation, Industry 4.0 incentives, and customer case studies. SEO targeting long-tail Italian manufacturing keywords.

Commercialista partner programme. A dedicated partner portal with consolidated client view, bulk fiscal export, 10–15% recurring revenue share on referred customers, co-branded marketing materials, and a "SmartERP Specialist Commercialisti" certification (€590/year). Target: 10 active commercialista partners in Verona province by end of Year 1, 30 across Veneto by end of Year 2. Expected Year 2 contribution: 25–35% of new ACV.

CCIAA Verona and CNA Verona. Partnership with the Camera di Commercio di Verona for the "Punto Impresa Digitale" (PID) programme supporting SME digital transformation; partnership with CNA Verona for micro-enterprise reach (the primary Base-tier audience). Joint webinars, shared lead-lists, and potential inclusion in regional voucher-innovation programmes.

Referral programme. Each customer who refers another signed customer receives 1 month free credit or equivalent. Tracked via unique referral codes in-product. Year 2 target: 20% of new customers via referral.

### 10.3 Sales Process and Funnel

Lead generation via inbound (website forms, content-marketing conversions, trade-show scans, commercialista referrals) and outbound (LinkedIn Sales Navigator prospecting, CCIAA lists, cold-call with manufacturing-context scripts).

Qualification. 15-minute discovery call applies BANT (Budget, Authority, Need, Timeline). Qualification criteria: employee count 10–250, currently on spreadsheet/legacy tool, fiscal-compliance pain (e.g., FatturaPA friction), decision authority present, 6–12 month purchase window.

Demo. 45-minute live demo personalised to prospect industry (metalwork, food processing, plastics, fashion, etc.). Runs in the prospect's own trial instance after the demo to enable hands-on evaluation.

Proposal. Document includes recommended tier, exact monthly/annual cost in €, implementation scope and timeline, and an explicit TCO comparison against the prospect's current tooling (usually Excel + Fatture in Cloud + legacy TeamSystem = €3,000–8,000/year combined, against SmartERP Professionale at €1,990/user/year times actual user count).

Negotiation. Annual prepayment receives 15% discount. Multi-year commitments (2-year, 3-year) receive 20% and 25% off respectively. Sales cycle: 30–45 days Base, 60–90 days Professionale, 90–180 days Enterprise.

Onboarding. Dedicated Customer Success Specialist for 30 days. Weekly check-ins. Data import from Excel/legacy system via pre-formatted templates; custom migration scripts for common legacy sources (Danea EasyFatt CSV, TeamSystem export, Fatture in Cloud API).

### 10.4 Content-Marketing Calendar and Editorial Strategy

Weekly publishing cadence on smarterp.it/blog in Italian. Editorial pillars rotate across four themes: (1) regulatory updates and interpretation — e.g., "Come si applica il nuovo codice TD28 alla vostra fatturazione? Guida per PMI veronesi"; (2) production-optimisation case studies and playbooks — e.g., "Come un'officina meccanica di Mozzecane ha ridotto del 30% i tempi di setup"; (3) Industry 4.0 incentive navigation — e.g., "Transizione 5.0: come documentare l'interconnessione per ottenere il credito d'imposta"; (4) product deep-dives and customer stories. Each post targets 1,200–1,800 words, includes at least one practical checklist or downloadable, and drives to a tier-specific call-to-action (Base trial, Professionale demo, Enterprise consultation).

SEO targeting. Primary keywords: "gestionale manifatturiero cloud", "ERP PMI Verona", "fatturazione elettronica produzione", "software produzione piccola azienda", "gestionale industria 4.0 Veneto". Long-tail keywords map to specific blog posts; ranking target is Google top-3 for primary and top-10 for long-tail within 12 months. Monthly keyword-performance review; quarterly audit of underperforming content for refresh or consolidation.

LinkedIn organic strategy. Daily posts from the CEO and CTO with a 70/30 split between educational content (manufacturing-SME digitalisation insights) and SmartERP updates. Weekly "dietro le quinte" (behind-the-scenes) posts humanising the team. Monthly long-form articles on LinkedIn's native publishing. Organic-to-paid ratio: 3:1 (we invest 3× in organic storytelling for every €1 of paid ads to ensure the paid budget amplifies genuine authority rather than substituting for it).

Email nurture flows. Upon trial signup: day 0 welcome + getting-started video (3 min, hosted by CTO); day 2 first-success framing ("emetti la tua prima fattura elettronica in 10 minuti"); day 7 "hidden gems" highlighting less-obvious features; day 14 customer case study relevant to prospect industry (determined by self-reported industry at signup); day 21 consultation offer with a Customer Success Specialist; day 29 "trial ends tomorrow" conversion push. Open-rate target >35%, click-through >8%, trial-to-paid conversion >25%.

### 10.5 Pricing Psychology and Objection Handling

Anchor-price strategy. The Professionale tier at €199/user/month is the designed anchor — it communicates "serious software for serious businesses" without triggering the sticker shock of a TeamSystem or SAP negotiation. The Base tier at €99 provides accessibility. The Enterprise tier's "custom pricing" signals flexibility to larger customers who expect to negotiate.

Common objections and responses, documented in a shared sales-enablement wiki. "È troppo caro rispetto a Fatture in Cloud" — response: "Fatture in Cloud fa fatturazione; SmartERP fa fatturazione + magazzino + produzione + contabilità + vendite + acquisti. Il costo totale dei vostri strumenti attuali (Excel + Fatture in Cloud + gestionale legacy) spesso supera il nostro prezzo." "Abbiamo già TeamSystem, perché cambiare?" — response: "Se TeamSystem vi soddisfa, non cambiate. Se invece trovate la configurazione rigida, l'interfaccia datata, o il costo di manutenzione in crescita, SmartERP è un'alternativa moderna con un TCO generalmente inferiore del 40–60%." "Come posso fidarmi di una startup?" — response: case studies da pilot customer veronesi, bilancio trasparente, dati in Europa/Italia, SLA contrattuali, cyber-insurance.

## 11. Financial Projections

### 11.1 Three-Year P&L Sketch

Year 1 (months 1–12, pre-seed + early seed).
Revenue: €116,000 (licence + maintenance recognised €48,000 + services €35,000 + training €3,000 = €86,000 effective recognition; annual recurring revenue (licence + maintenance) exit rate €116,000). Costs: €820,000 (salaries loaded €560,000 for 11 people ramp; AWS + vendors €25,000; sales & marketing €75,000 including trade shows; legal/accounting €18,000; office/operations €45,000; buffer/contingency €20,000; remaining burn for R&D tooling/licences €77,000). Net loss: approximately €730,000 (reflecting ramp costs).

Year 2 (months 13–24, seed deployment).
Revenue: €520,000 (licence + maintenance €420,000 + services €80,000 + training €20,000). Costs: €1,050,000 (salaries loaded €820,000 for 18 people; AWS + vendors €65,000; S&M €120,000; offices €45,000). Net loss: €530,000.

Year 3 (months 25–36, growth-capital deployment).
Revenue: €1,470,000 (licence + maintenance €1,150,000 + services €160,000 + training €60,000 + marketplace €40,000 + premium analytics €60,000). Costs: €1,550,000 (salaries loaded €1,150,000 for 22–24 people; AWS + vendors €115,000; S&M €180,000; offices €60,000; misc €45,000). Net loss: €80,000 — operating break-even approach within 6 months of Year 3 end.

### 11.2 Break-Even

Unit-economics break-even at customer 1 (gross profit per customer per month €213; CAC €1,800; payback 8.5 months).
Operating break-even projected at month 32–34 assuming the customer-acquisition path holds and the team stabilises at ~24 FTEs.
Fully-loaded annual break-even at approximately 280 Professionale-equivalent customers generating €2.1M annual recurring revenue (licence + maintenance) against €2.05M loaded operating cost.

### 11.3 Funding and Dilution

Pre-seed €200,000 from founders + angels + Smart&Start Italia soft loan (0–0.5% interest, 10-year amortisation). Dilution: 10–15%.
Seed €550,000–650,000 at €4–6M pre-money from Italian venture capital (CDP Venture Capital's Fondo Nazionale Innovazione, Primo Ventures, Italian Angels for Growth, Intesa Sanpaolo Innovation Center) closing around month 12. Dilution: 10–15%.
Optional growth-round €2M at €12–18M pre-money in Year 3 if market conditions warrant accelerated expansion. Alternative: non-dilutive capital through PNRR Missione 1 Digitalizzazione calls, Voucher Innovazione Regione Veneto, EIC Accelerator grants.

Burn-rate discipline: monthly OpEx capped at 85% of available runway-funded spend; each hiring decision requires 12-month CAC-LTV trajectory validation.

### 11.4 Key Metrics Dashboard and Targets

The executive team reviews the following metrics every Monday morning in a 30-minute standing meeting. Each metric has a defined owner, a green/amber/red threshold, and a trend requirement (7-day rolling change).

Growth-stream metrics. Monthly maintenance revenue: Year-1 exit target €7,200; Year-2 exit target €35,000; Year-3 exit target €95,000. Annual recurring revenue (licence + maintenance): Year-1 exit €86,000; Year-2 exit €420,000; Year-3 exit €1,150,000. Net new logo count per month: Year-1 average 1.25; Year-2 average 3.75; Year-3 average 6.25. Paying-customer count: Year-1 exit 15; Year-2 exit 60; Year-3 exit 130.

Efficiency-stream metrics. CAC (blended): Year-1 €1,800; Year-2 €1,500; Year-3 €1,200. LTV/CAC ratio: Year-1 17.8×; Year-3 32.5×. Payback period: Year-1 8.5 months; Year-3 5.6 months. Magic number (annual recurring revenue added / sales & marketing spend): Year-1 0.9; Year-3 1.7 (above 1.0 is healthy; above 1.5 is exceptional).

Retention-stream metrics. Gross monthly churn rate: <1% (8% annualised). Net revenue retention: Year-1 exit 105%; Year-2 120%; Year-3 130%. Logo churn: <5% annualised in Year 1 rising to <3% by Year 3.

Product-stream metrics. Daily active users (DAU) / monthly active users (MAU) ratio: target >55% (manufacturing-ERP users log in daily). Feature adoption: six-module use by Professionale+ customers within 60 days of onboarding >80%. Mobile PWA usage by shop-floor customers >40% once Phase 2 ships.

Operational-stream metrics. API uptime: Year-1 99.5% on Base, 99.9% on Pro/Enterprise. P95 API latency: <200ms list, <400ms aggregate, always. Deploy frequency: twice weekly minimum. Mean time to resolution (MTTR) for P1 incidents: <2 hours. Percentage of releases without incident: >95%.

Team-stream metrics. Headcount: Year-1 exit 11; Year-2 exit 18; Year-3 exit 24. Revenue per employee: Year-1 €11,000; Year-2 €28,000; Year-3 €58,000 (trending toward the typical Italian-vertical-cloud-software benchmark of €80–120k).

---

# PART V — EXCELLENCE & GROWTH

## 12. Operations Manual

### 12.1 Daily Development Rhythm

Two-week sprints (Monday–Friday×2). 9:30 daily stand-up (Pomodoro-strict 15-minute cap). 9:45–12:30 "focus block" (Slack-status: focused; meetings prohibited; deep work prioritised). 13:30–16:00 collaborative afternoon (code reviews, pair programming, architecture discussions). 16:00–17:30 PR review wrap-up and next-day prep. Tuesday and Thursday deployment windows 08:00–09:00 CET (before customer business hours). Monday: sprint planning (1 hour week 1) or weekly sync (week 2). Wednesday afternoon: 30-minute tech-debt review. Friday: sprint retrospective (45 minutes, week 2) or knowledge-sharing session (30 minutes, week 1).

### 12.2 SLAs

Base tier. Uptime 99.5% (monthly ~3.6 h downtime budget). Email support, 24-hour business-day response SLA. SLA credit: 10% of monthly bill per 0.1% uptime shortfall.

Professionale tier. Uptime 99.9% (~43 min/month). Priority phone + email support, 4-hour business-day response SLA. SLA credit identical to Base.

Enterprise tier. Uptime 99.99% (~4.3 min/month). 24/7 phone/chat/email support, 1-hour response SLA, with an assigned Customer Success Manager and quarterly Business Review. SLA credit 20% per 0.01% shortfall.

Maintenance windows: Sunday 02:00–05:00 CET, ≥72 hours advance notice. Maintenance downtime excluded from SLA.

### 12.3 Incident Response

Severity classification. P1 — service outage affecting >20% of tenants. P2 — major feature unavailable for a cohort of tenants. P3 — degraded performance or non-critical feature failure. P4 — cosmetic issue.

P1 response. PagerDuty page within 2 minutes of detection; incident commander joins war-room within 15 minutes; customer-facing status page updated within 20 minutes and every 15 minutes thereafter; resolution or workaround within 2 hours (target); post-mortem published within 48 hours. Runbook maintained in the `runbooks/` repo covering the top-20 failure scenarios.

### 12.4 Backups and DR Drills

Database: automated daily `pg_dump` to S3 with 30-day retention + continuous WAL archiving enabling PITR. Cross-region replication to eu-west-1 for the DR site. File storage: S3 versioning + cross-region replication. Config: Terraform state and K8s manifests version-controlled in Git with SOPS encryption.

Quarterly DR drill. The on-call engineer restores production backups to a scratch region, runs data-integrity checks against production reference counts, measures RTO/RPO actuals, and files a lessons-learned document. Any gap in RTO/RPO targets triggers immediate backlog-prioritised remediation.

## 13. Risk Management

### 13.1 Risk Matrix

The risk register is reviewed quarterly by the CTO and CEO; new risks are added as they surface; mitigations are tracked as backlog items with specific owners.

Slow customer adoption (likelihood Medium, impact High). Mitigation: extended 60-day trial for pilot customers; money-back guarantee; aggressive referral programme; Confindustria / CNA partnerships; relentless case-study capture from pilot cohort to generate social proof for second-wave customers.

Key engineering departure (Medium, High). Mitigation: ADR repository capturing architectural decisions; pair programming from week 1; competitive ESOP with 4-year vest and 1-year cliff; AWS Secrets Manager accessible to at least 3 senior team members; quarterly "bus factor" review.

Security breach / data leak (Low, Critical). Mitigation: OWASP ASVS L2 compliance; quarterly penetration testing; audit logging with 10-year retention; incident-response plan with 72-hour Garante notification runbook; cyber-insurance policy at €500,000 coverage floor.

Competitor price war (Medium, Medium). Mitigation: differentiate on Italian specificity and service depth; service revenue provides cushion; annual contracts provide revenue-predictability anchor.

Italian fiscal regulatory change (Medium, Medium). Mitigation: modular architecture allows rapid updates; dedicated "Italian Fiscal Observer" role in engineering (part-time initially) tracking AdE provvedimenti, AgID Circolari, Garante provvedimenti; tight relationship with a tier-1 commercialista advisor.

Infrastructure failure (Low, High). Mitigation: Multi-AZ deployment by default; automated backups (RPO 1 h, RTO 4 h); quarterly DR drills; cyber-insurance coverage.

Cash-flow shortage before next funding round (Medium, High). Mitigation: 18-month cash-buffer target; milestone-based capital deployment; revenue-first feature prioritisation; access to non-dilutive instruments (Smart&Start, Voucher Innovazione).

Economic downturn impacting SME IT spending (Medium, Medium). Mitigation: annual contracts; diversified customer base across manufacturing subsectors; Piano Transizione 4.0/5.0 tax credits that subsidise customer ERP purchase even during downturns.

## 14. Quality Assurance

### 14.1 Testing Strategy

Unit tests. Jest. Mock external dependencies; target 80% coverage on service layer. Run on every commit; fail the PR if coverage drops below threshold.

Integration tests. Testcontainers-spun PostgreSQL 16 + Redis 7. Every API endpoint touched by at least one happy-path and one failure-path test. Test database reset between tests.

End-to-end tests. Playwright browser tests + Supertest API tests. Covering the four canonical user journeys: product → receive → sell → invoice, production order → work orders → complete, register → login → tenant setup, import Excel → validate. Run against staging in CD pipeline.

Performance tests. k6 scripts in `tests/performance/`. 100 concurrent users, 15-minute mixed read/write workload. Budget assertions: P95 <200 ms list, P95 <400 ms aggregate, error rate <0.1%. Run weekly against staging.

Security tests. Semgrep (SAST) with Italian-fiscal rule-pack plus standard security rules. OWASP ZAP baseline scan in CI against a staged build. Trivy container vulnerability scans. `npm audit` on every CI build, blocking on HIGH+.

Accessibility tests. axe-core automated runs inside Playwright; manual keyboard-navigation checklist per `docs/A11Y.md`.

### 14.2 Code Review and CI/CD Gates

Every PR requires: green CI (lint, unit test, integration test, security scan, container build), at least one approval from a non-author, passing OpenAPI schema validation. Architecture-affecting PRs require CTO approval. PRs merging on Friday after 15:00 are held for Monday deployment.

CI gates (strict). ESLint zero-warning. TypeScript strict mode zero errors. Unit+integration suite 100% pass. `npm audit` no HIGH/CRITICAL. Docker build success. Trivy container scan no CRITICAL. OpenAPI schema validates.

### 14.3 Release Management

Semantic versioning across the backend and frontend packages: MAJOR.MINOR.PATCH. Backward-incompatible API changes force a MAJOR bump and a version-coexistence commitment (new major URL prefix `/api/v2/...` running in parallel with v1 for ≥6 months per Section 6.9 of the portfolio standards). Feature flags (LaunchDarkly-compatible, initially in-house `feature_flags` table) gate risky changes; progressive-rollout by tenant cohort.

Release notes in Italian and English published to a customer-facing changelog page. In-product "What's new" modal on major-version rollouts. Commercialisti and partner-certified users receive a dedicated email digest 72 hours in advance of fiscal-impacting changes, citing the relevant AdE provvedimento or AgID circolare driving the change.

Rollback protocol. Every deployment includes an automated rollback plan: previous container image tag cached, database migration marked `reversible:true` (migrations that are not safely reversible require an explicit CTO sign-off and a 24-hour bake window on staging). Post-deployment monitoring runs for 60 minutes with heightened alert sensitivity; rollback triggered automatically on error-rate breach.

## 15. Customer Success

### 15.1 Onboarding

The first 30 days are the highest-leverage retention period. Structured programme: Week 1 foundation (company profile, warehouses, chart of accounts, SDI destination); Week 2 core-module training (inventory + production, 2×1-hour sessions); Week 3 advanced features and integrations (e-invoicing, API, mobile PWA); Week 4 health check and handover. Customer Success Specialist runs the programme for Professionale and Enterprise; Base tier uses self-service onboarding with email drip and one kickoff call.

### 15.2 Retention Playbook

Quarterly Business Review (QBR) for Professionale and Enterprise: usage metrics, benchmark comparison, upsell surfacing, roadmap preview. NPS measured quarterly; churn-risk scoring (login frequency, transaction volume, support sentiment, NPS score) flags at-risk customers for proactive intervention.

In-app feedback widget with ICE-framework prioritisation (Impact × Confidence × Ease). Public roadmap visible to all customers; personal notification when a requested feature ships.

Italian-language community forum (forum.smarterp.it) for peer knowledge-sharing, seeded by Customer Success team.

Monthly "Webinar Martedì" — 45-minute live sessions alternating customer case studies and product deep-dives.

### 15.3 Customer Support Tiers and Escalation

Level-1 support (Customer Success team). Configuration questions, user guidance, known-issue workarounds. Target first-response times: Base 24h business-day, Professionale 4h business-day, Enterprise 1h 24/7. Knowledge base (kb.smarterp.it) in Italian with ~250 articles covering setup, each module, FatturaPA flows, and troubleshooting. In-app contextual help surfaces KB articles relevant to the current screen.

Level-2 support (Senior Engineer on rotation). Bug investigation, data repair, integration troubleshooting (SDI rejection reasons, PEC delivery failures, bank-feed anomalies). Escalation occurs automatically when an L1 ticket crosses 50% of its SLA window unresolved.

Level-3 support (CTO and core engineering). Critical production incidents, security events, architectural problems requiring code change. Escalation from L2 occurs on any P1/P2 event or when L2 assesses that resolution requires code change beyond a configuration fix.

Escalation metrics tracked: percentage of tickets resolved at L1 (target >70%), mean time to resolution per severity, customer-reported satisfaction (CSAT) per closed ticket (target >4.4/5.0).

### 15.4 Expansion Revenue Playbook

Customer Success tracks a per-account "expansion opportunity score" weighing: seat-utilisation ratio (Base customers frequently hitting the 3-user ceiling), feature-request patterns suggesting higher-tier functionality (e.g., multi-company requested by a Professionale customer indicates Enterprise readiness), transaction-volume growth (usage growth suggests business growth and expanded value from SmartERP), and NPS score.

Upsell motions, sequenced by urgency. First, in-product contextual nudges when a Base customer hits the 3-user limit or exceeds the 500-SKU ceiling. Second, Customer Success proactive outreach at the quarterly business review. Third, a structured upgrade path with a 60-day "try the next tier" pilot free of charge (limited to three per quarter per CSM), which has historically converted at >65% in comparable B2B licensed-software businesses.

Downgrade management. Rare for manufacturing ERP due to switching costs, but when it happens (e.g., team reduction, business pivot), Customer Success treats the downgrade as a retention opportunity rather than a loss: offer a multi-month "rightsizing" bridge at an intermediate rate, document the customer's signal for product iteration, and aim to re-expand within 18 months.

## 16. Partnerships & Ecosystem

Technology partners: Aruba (PEC, firma digitale, SPID, Conservazione a Norma), InfoCert (qualified trust services for FEA/FEQ and SDI transmission), Namirial (alternative SDI transmission and conservation), Stripe (licence + maintenance billing), Satispay (B2B payments), Zebra/Datalogic/Honeywell (barcode hardware for warehouse operations).

Channel partners: accounting firms (commercialisti) via the SmartERP Partner Programme — dedicated portal, 10–15% recurring revenue share, "SmartERP Specialist" certification, co-marketing. Regional IT-consulting firms and system integrators join the programme as Implementation Partners with differentiated commission and training.

Industry associations: Confindustria Verona (primary), CNA Verona (micro-enterprise segment), API Verona (SME segment), Unindustria Treviso (cross-province), ANCE Verona (building-components manufacturers). Sponsorships of sector-specific events, member-discount programmes, joint research publications.

Academic partnerships: Università di Verona Dipartimento di Informatica (Master's thesis projects, joint PNRR/Horizon Europe grant applications), Università di Verona Dipartimento di Economia Aziendale (industry-research publications). An "SmartERP Innovation Lab" initiative with the university sponsors student thesis projects on real product challenges.

Italian institutional relationships: CCIAA Verona (Camera di Commercio) for the Punto Impresa Digitale (PID) programme and for SME-support vouchers; Regione Veneto Innovation Unit for voucher-innovazione programmes; Invitalia for Smart&Start Italia deployment; CDP (Cassa Depositi e Prestiti) for the Fondo Nazionale Innovazione investment relationship.

Technology alliances (Phase 2 formalisation). Joint go-to-market with complementary product vendors: TraceVino (wine/food traceability) for the agri-food subsegment of SmartERP customers; FactoryMind (IoT production monitoring, Project 6 in the portfolio) for shop-floor telemetry integration; CyberGuard for customers needing adjacent cybersecurity+GDPR tooling; FatturaFlow for customers whose invoicing needs exceed SmartERP's embedded handoff (very-high-volume e-invoicing with complex multi-entity flows). Integration pathways use the SmartERP REST API under structured data-sharing agreements.

## 17. Exit Strategy

Scenario A — Strategic acquisition (most likely, 5–7 year horizon). Likely acquirers: TeamSystem (Hellman & Friedman-backed consolidator, actively acquiring Italian business-software companies); Zucchetti (Italy's largest privately held software company with cloud-transformation imperative); Wolters Kluwer's Tax & Accounting division; Sage Group targeting Southern European expansion; Visma Group (PE-backed Nordic consolidator with Mediterranean ambitions). Target multiple: 8–12× annual recurring revenue (licence + maintenance) for a growing B2B licensed-software business with NRR >115% and gross margin >75%, implying a €12–20 million exit at Year-3 annual recurring revenue projections rising to €30–55 million at Year-5 trajectory. Key acquisition value drivers: cloud-native architecture eliminating acquirer re-platforming cost; Italian fiscal-compliance expertise embedded in product; loyal SME customer base in a geography large vendors struggle to penetrate; engineering team with specialised domain depth.

Scenario B — Continued independence. If the business reaches profitability and the founders prefer independence, SmartERP continues as a bootstrapped / lightly funded profitable company generating sustainable returns. The Italian manufacturing ERP market is deep enough (€2.1B TAM) to support a €15–30M annual recurring revenue (licence + maintenance) independent business focused exclusively on this niche. European reference points: Teamleader (Belgium), Personio (Germany), Factorial (Spain) all achieved sustainable profitability at regional scale before later raising growth capital.

Scenario C — IPO on Euronext Growth Milan (7–10 year horizon). If SmartERP achieves €10M+ annual recurring revenue (licence + maintenance) with the Rule of 40 satisfied (growth + margin ≥ 40) and NRR >120%, a listing on Euronext Growth Milan (formerly AIM Italia) provides liquidity while retaining control. Recent Italian-tech IPOs (Destination Italia, Expert.AI, Alkemy) demonstrate market appetite.

Scenario D — Management buyout. If early investors want liquidity before the business is ready for scenarios A or C, an MBO financed through Italian private debt / mezzanine instruments (e.g., Intesa Sanpaolo SME credit instruments, European Investment Fund facilities) allows the founding team to repurchase investor shares at a fair-value negotiated price.

All four scenarios are planned for through board-level alignment exercises run annually. The Year-3 strategic review is the first formal inflection point at which the path forward is chosen.

---

*SmartERP — pensato a Mozzecane, costruito per il tessuto manifatturiero italiano.*
