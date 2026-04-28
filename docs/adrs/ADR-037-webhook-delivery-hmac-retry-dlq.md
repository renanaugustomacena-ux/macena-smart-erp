# ADR-037 — Webhook delivery: HMAC-signed, exponential-retry, dead-letter-queued

- **Status**: Accepted 2026-04-28 (Sprint 14)
- **Date**: 2026-04-28
- **Owner**: CTO + Integrations-team owner

## Context

Tenants integrate SmartERP into their own automation: a B2B distributor wants Zapier-like triggers when a Goods Receipt is confirmed, an external accounting firm wants a notification when a Supplier Invoice flips to `paid`, a marketplace wants to know when stock for a SKU drops below a threshold. This is a webhooks problem.

Webhooks done badly are operational disasters: silent failures, duplicate deliveries, infinite retries that DDoS the consumer, signed-by-nobody payloads vulnerable to spoofing. The platform must guarantee:

1. **Authenticity** — the consumer can verify the payload came from SmartERP, not a man-in-the-middle.
2. **Integrity** — the body wasn't modified in transit.
3. **At-least-once delivery** — every event is delivered or surfaces in a dead-letter queue an operator can inspect.
4. **Bounded retry** — never more than N attempts, with bounded total wall-clock so a misbehaving consumer can't pin a worker forever.
5. **Replay protection** — the consumer can detect a replay attack within a short window (5 minutes).
6. **Observability** — per-subscription per-event metrics + per-attempt audit trail.
7. **Multi-tenancy isolation** — a tenant's webhook subscriptions, events, and DLQ are strictly scoped to the tenant.

Plan §9.x and plan §31.1 Sprint 14 (S14.6) call for the webhook infrastructure to land in the same sprint as Procurement Phase B so the first two event types (`procurement.gr_confirmed`, `procurement.si_paid`) can be emitted from real domain logic the moment they are wired.

## Decision

**Transactional Outbox pattern + HMAC SHA-256 signature + bounded exponential retry + DLQ.**

### 1. Outbox

Every domain event the platform wants to deliver to a webhook is first persisted in a `webhook_outbox` row inside the same database transaction that produced the domain change (e.g. when a SupplierInvoice transitions to `paid`, the row insert and the outbox-event insert commit together or not at all). This makes the platform durable to crashes and avoids the "ghost event" problem.

The outbox has the canonical CloudEvents 1.0 envelope shape (per portfolio invariant): `id`, `source`, `specversion`, `type`, `time`, `data`. The payload `data` carries the domain-specific fields.

### 2. Subscription

`webhook_subscriptions` rows persist per-tenant per-event-type subscriptions:

```
id            uuid
tenantId      uuid              (tenantId-first composite indexes — R-D01)
eventType     text              ('procurement.gr_confirmed', 'procurement.si_paid', ...)
targetUrl     text              (HTTPS only — enforced server-side)
hmacSecret    text              (encrypted at rest per ADR-DA07)
status        enum              ('active' | 'paused' | 'disabled')
createdAt     timestamptz
disabledAt    timestamptz NULL  (set when DLQ trip exhausts attempts)
```

### 3. Signing

Each delivery attempt sends:

```
POST {targetUrl}
Content-Type: application/json
X-SmartERP-Event-Id: {outbox.id}
X-SmartERP-Event-Type: {event.type}
X-SmartERP-Timestamp: {RFC3339 UTC, second precision}
X-SmartERP-Signature: sha256={hex(HMAC-SHA256(hmacSecret, "{timestamp}.{rawBody}"))}
X-SmartERP-Delivery-Id: {uuid; per-attempt}
X-SmartERP-Delivery-Attempt: {1..N}

{rawBody}
```

The consumer verifies the signature by recomputing `HMAC-SHA256(hmacSecret, "{timestamp}.{rawBody}")` and constant-time-comparing it. The timestamp is part of the signed-over content so a replay against a future delivery is impossible without re-signing.

The `{timestamp}.{rawBody}` framing matches the GitHub / Stripe / Twilio convention so consumer-side libraries already exist.

Replay protection: consumers SHOULD reject deliveries with a timestamp older than 5 minutes from server time.

### 4. Retry

Exponential backoff with jitter, bounded:

```
attempt 1 → 0s   (immediate)
attempt 2 → 30s + jitter[0..10s]
attempt 3 → 5m  + jitter[0..1m]
attempt 4 → 30m + jitter[0..5m]
attempt 5 → 2h  + jitter[0..15m]
attempt 6 → 6h  + jitter[0..30m]
attempt 7 → DLQ
```

Total wall-clock ≤ 9 hours. After 6 unsuccessful attempts, the event lands in `webhook_dlq`. After 50 DLQ entries inside any rolling 1-hour window for a single subscription, the subscription is auto-disabled (status → `disabled`) and an operator alert fires.

Retry condition: HTTP status ∉ {2xx} OR connection-refused / timeout / TLS error.

A 410 Gone or 404 Not Found from the consumer disables the subscription on the first failure (the consumer told us it doesn't exist).

A 429 Too Many Requests honours the `Retry-After` header (clamped to ≤ 30 minutes).

### 5. Worker

A BullMQ queue `webhook-dispatch` is fed from the outbox by a poller running every 1 second. Multiple workers can run concurrently; per-event idempotency is enforced by the outbox-event id (`X-SmartERP-Event-Id`); consumers MUST de-duplicate using that header.

Per-tenant rate-limit: 100 deliveries / second / tenant (BullMQ rate-limiter feature).

### 6. DLQ + replay

`webhook_dlq` rows persist every event that exhausted attempts. Operators (or, behind a feature flag, tenants themselves) can replay a DLQ row through `POST /api/webhooks/dlq/{id}/replay` — the row gets re-enqueued with attempt counter reset to 1. DLQ rows TTL = 30 days.

### 7. Observability

Prometheus counters:
- `smarterp_webhook_delivery_attempts_total{tenant_id, event_type, outcome="2xx|4xx|5xx|timeout|tls"}`
- `smarterp_webhook_delivery_duration_ms` (histogram)
- `smarterp_webhook_dlq_total{tenant_id, event_type}`
- `smarterp_webhook_subscription_disabled_total{reason="dlq_storm|410_gone|404_not_found|manual"}`

Per-attempt structured log row:
```json
{
  "event": "webhook.delivery_attempt",
  "tenantId": "...",
  "subscriptionId": "...",
  "outboxId": "...",
  "attempt": 3,
  "outcome": "5xx",
  "httpStatus": 503,
  "durationMs": 412,
  "deliveryId": "..."
}
```

### 8. What ships in Sprint 14 (S14.6)

This sprint ships:
- The ADR (this document).
- Entities: `WebhookSubscription`, `WebhookOutboxEvent`, `WebhookDeliveryAttempt`, `WebhookDlqEntry`.
- Migration M-016 (4 tables + 2 enums; tenantId-first composite indexes per R-D01).
- A pure-logic `HmacSigner` (sign + constant-time verify) with full test coverage.
- A pure-logic `WebhookRetryPolicy` (next-delay + retry-allowed + DLQ-trip predicates) with full test coverage.
- A pure-logic `WebhookOutboxDispatcher` skeleton: pulls from the outbox, signs, hands to a `WebhookHttpTransport` port, records the attempt outcome, schedules retry or DLQ. The HTTP transport is a port; the live `HttpClientService`-backed transport lands in plan §31.2 Sprint 24 alongside the consumer-facing `Webhook Subscription` REST API and the BullMQ worker.

The worker, REST API, and BullMQ wiring land in plan §31.2 Sprint 24. The ADR pins the contract so consumers can prepare against the documented signing scheme today.

## Consequences

- Positive:
  - Stripe-/GitHub-compatible signing scheme means tenants can bring their existing webhook libraries.
  - Outbox + transactional commit removes the "did the event fire?" class of bugs.
  - Bounded retry + DLQ + auto-disable on storm prevents a misbehaving consumer from amplifying load.
  - Observability is first-class (per-attempt metrics, per-attempt log, DLQ dashboard).
  - Multi-tenant isolation matches the rest of the platform (R-D01 / R-D02).
- Negative:
  - Outbox table grows linearly with event volume; needs a TTL or archival job (separate ticket).
  - Per-tenant HMAC secret rotation is a manual flow in v2.0 (UI lands in Sprint 24).
  - At-least-once delivery semantics force consumers to de-duplicate by `X-SmartERP-Event-Id`. Documented.
- Neutral:
  - The `WebhookHttpTransport` port allows substituting the live HTTP client in tests with a deterministic transport (counters + canned responses). This is what the unit tests in this sprint exercise.

## Alternatives considered

- **Direct HTTP push without outbox**: rejected — loses durability; an outage between event-emit and HTTP send drops the event.
- **At-most-once delivery**: rejected — consumers explicitly want at-least-once. De-duplication via `X-SmartERP-Event-Id` is documented.
- **Vendor-provided webhook gateway (Hookdeck, Convoy, etc.)**: deferred. Pros: less infrastructure to run. Cons: extra cost layer; data-residency concerns for IT-tenant payloads. Reconsider at €5M ARR if maintenance burden exceeds the gateway margin.
- **GraphQL Subscriptions / WebSockets**: deferred. The first ten target tenants asked for HTTP webhooks first; GraphQL Subscriptions land alongside the v3 public API.

## References

- Plan §9.x (Integrations) + §31.1 Sprint 14 (S14.6) + §31.2 Sprint 24 (live worker + REST API).
- CloudEvents 1.0 spec: `https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md`.
- Stripe webhook signing: `https://stripe.com/docs/webhooks#verify-official-libraries` (signing scheme reference).
- GitHub webhook signing: `https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries` (HMAC-SHA256 reference).
- ADR-011 (RFC 7807 ProblemDetails — used in the REST API for error shapes).
- ADR-032 (HttpClientService wrapper — reused by the live transport in Sprint 24).
- ADR-DA07 (field-level encryption for `hmacSecret`).
