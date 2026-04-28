/**
 * WebhookHttpTransport — pure port (ADR-037).
 *
 * Decouples the dispatcher logic from the live HTTP client. The live
 * implementation (planned for §31.2 Sprint 24) wraps `HttpClientService`
 * (ADR-032) for timeout / retry / circuit-breaker. Tests substitute a
 * deterministic in-memory transport.
 */

export interface WebhookHttpRequest {
  url: string;
  /** Pre-rendered body — already JSON-stringified upstream. */
  rawBody: string;
  headers: Record<string, string>;
  timeoutMs: number;
}

export interface WebhookHttpResponse {
  /** HTTP status code if the request reached the consumer. */
  status: number | null;
  /** `Retry-After` header value in seconds (when present, on 429/503). */
  retryAfterSeconds?: number;
  /** Network-level failure mode when status is null. */
  networkError?: 'timeout' | 'connection_refused' | 'tls_error' | 'unknown';
  /** Truncated to ≤ 2000 chars — never carries response body bytes. */
  errorMessage?: string;
  durationMs: number;
}

export interface WebhookHttpTransport {
  send(request: WebhookHttpRequest): Promise<WebhookHttpResponse>;
}
