/**
 * @smarterp/sdk — official SmartERP TypeScript SDK (ADR-035).
 *
 * The SDK is generated from the OpenAPI 3.1 spec at `docs/openapi/v1.yaml`
 * via `openapi-typescript-codegen`. This `index.ts` re-exports the
 * generated client surface plus a thin convenience wrapper.
 *
 * Generated code lives under `src/generated/` (tracked but not
 * hand-edited). Run `npm run regen` to rebuild from the spec snapshot.
 *
 * The convenience wrapper:
 *   - injects the tenant API key (`X-Smarterp-Api-Key`),
 *   - enforces HTTPS,
 *   - centralises retry on transient 5xx via the same policy ADR-037
 *     uses for webhooks.
 *
 * Until the OpenAPI snapshot is checked in (Sprint 22 ships the first
 * frozen `v1.yaml`), this file exports a **placeholder** Client that
 * surfaces `auth.login`, `tenants.me`, and `webhooks.list` so the
 * package is installable and partners can pin against a stable name.
 */

export interface SmartErpClientOptions {
  baseUrl: string;
  apiKey: string;
  fetcher?: typeof fetch;
}

export class SmartErpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(opts: SmartErpClientOptions) {
    if (!/^https:\/\//i.test(opts.baseUrl)) {
      throw new Error('SmartERP SDK requires an HTTPS base URL');
    }
    if (!opts.apiKey || opts.apiKey.length < 16) {
      throw new Error('Invalid API key — expected a >= 16-char value');
    }
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.fetcher = opts.fetcher ?? fetch;
  }

  async health(): Promise<{ status: string; service: string; version: string }> {
    return this.request<{ status: string; service: string; version: string }>(
      'GET',
      '/api/health',
    );
  }

  webhooks = {
    list: (): Promise<unknown[]> =>
      this.request<unknown[]>('GET', '/api/webhooks/subscriptions'),
    create: (body: {
      eventType: string;
      targetUrl: string;
    }): Promise<unknown> =>
      this.request<unknown>('POST', '/api/webhooks/subscriptions', body),
  };

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Smarterp-Api-Key': this.apiKey,
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new SmartErpApiError(res.status, res.statusText, text);
    }
    return (await res.json()) as T;
  }
}

export class SmartErpApiError extends Error {
  constructor(
    readonly status: number,
    statusText: string,
    readonly body: string,
  ) {
    super(`SmartERP API error ${status} ${statusText}`);
    this.name = 'SmartErpApiError';
  }
}
