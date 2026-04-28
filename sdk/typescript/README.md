# @smarterp/sdk

Official TypeScript SDK for the SmartERP REST API. Generated from the OpenAPI 3.1 spec at `docs/openapi/v1.yaml` (ADR-035).

## Install

```bash
npm install @smarterp/sdk
```

## Quick start

```ts
import { SmartErpClient } from '@smarterp/sdk';

const client = new SmartErpClient({
  baseUrl: 'https://api.smarterp.it',
  apiKey: process.env.SMARTERP_API_KEY!,
});

const health = await client.health();
console.log(health.status);

await client.webhooks.create({
  eventType: 'it.smarterp.invoices.issued.v1',
  targetUrl: 'https://your-app.example.com/webhooks/smarterp',
});
```

## Versioning

The SDK major version tracks the API path prefix (`/api/v1` ↔ SDK 1.x). Minor + patch follow the spec snapshot tag.

## Regenerate from spec

```bash
npm run regen
```

Reads `docs/openapi/v1.yaml` (checked into the repo) and rewrites `src/generated/`.
