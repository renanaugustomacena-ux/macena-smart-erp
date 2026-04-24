# Integrations — SmartERP

External systems that SmartERP can integrate with. Each integration has a tier (**core** = shipped by v1; **roadmap** = planned; **custom** = built per customer on Enterprise plan).

---

## 1. E-Invoicing

| System | Tier | Description | Protocol |
|--------|:----:|-------------|----------|
| SDI (Sistema di Interscambio — AdE) | core | Invoice submission + SDI notifications (RC, NS, MC, DT, NE) | SOAP Webservice SDICoop + PEC fallback |
| InfoCert Conservazione a Norma | roadmap Q2 2026 | DPCM 3/12/2013 conformance archive | REST API with SAML auth |
| Aruba PEC Conservazione | roadmap Q3 2026 | Alternative archive provider | REST API |

---

## 2. Banking (CBI / SEPA)

| System | Tier | Description | Protocol |
|--------|:----:|-------------|----------|
| CBI Globe | roadmap Q3 2026 | Bonifici massivi, riconciliazione estratti conto | REST / ISO 20022 |
| Stripe | roadmap Q2 2026 | Card payments sul piano Base-add-on | Stripe SDK |

---

## 3. E-Commerce

| System | Tier | Description | Protocol |
|--------|:----:|-------------|----------|
| Shopify | custom | Sync prodotti, ordini, magazzino | REST / GraphQL / webhooks |
| WooCommerce | custom | Sync prodotti, ordini | REST |
| PrestaShop | custom | Sync prodotti | REST |

---

## 4. Industrial / MES

| System | Tier | Description | Protocol |
|--------|:----:|-------------|----------|
| OPC UA | custom | Real-time state da PLC / HMI | OPC UA (IEC 62541) |
| MQTT | custom | Telemetria IoT | MQTT v5 (OASIS) |
| Modbus TCP | custom | Legacy PLC | Modbus TCP |

---

## 5. Logistics

| System | Tier | Description | Protocol |
|--------|:----:|-------------|----------|
| DDT → courier (Bartolini, GLS, SDA) | roadmap Q3 2026 | Stampa lettera di vettura + tracking | per-carrier REST |

---

## 6. Identity

| System | Tier | Description | Protocol |
|--------|:----:|-------------|----------|
| SPID (Sistema Pubblico di Identità Digitale) | roadmap Q4 2026 | Login cittadini / PA | OIDC |
| SAML 2.0 SSO | Enterprise | Corporate SSO | SAML 2.0 |
| OIDC SSO | Enterprise | Azure AD, Okta, Auth0 | OIDC |

---

## 7. Observability

| System | Tier | Description | Protocol |
|--------|:----:|-------------|----------|
| Prometheus scraping `/metrics` | core | Metriche | HTTP text format |
| Grafana dashboards | core | Visualisation | pre-built JSON dashboards |
| Loki / Elastic via fluent-bit | core | Log aggregation | JSON lines |
| Sentry | core | Error monitoring | Sentry SDK |

---

## 8. Webhook Events

SmartERP emits these webhooks (Professionale + Enterprise):

| Event | Payload |
|-------|---------|
| `sales_order.created` | orderId, orderNumber, totalAmount, customerId |
| `sales_order.confirmed` | + reservation details |
| `sales_order.shipped` | + shipping manifest |
| `invoice.accepted` | invoiceId, journalEntryId |
| `invoice.sdi_rejected` | invoiceId, errorCode, errorMessage |
| `inventory.low_stock` | productId, warehouseId, quantityOnHand, reorderPoint |
| `production.order.completed` | orderId, quantityProduced, actualCost |

Signature header `X-SmartERP-Signature: sha256=<hmac>` where the secret is configured per tenant.
