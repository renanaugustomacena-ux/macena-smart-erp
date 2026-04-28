import { randomUUID } from 'node:crypto';
import { HmacSigner } from './hmac-signer';
import {
  classifyHttpStatus,
  decideRetry,
  RETRY_POLICY_LIMITS,
} from './retry-policy';
import type {
  WebhookHttpResponse,
  WebhookHttpTransport,
} from './webhook-http-transport';

/**
 * Pure-logic dispatcher (ADR-037; plan §31.1 Sprint 14 S14.6).
 *
 * Takes one outbox row + one matching subscription and drives the
 * delivery: build the signed request, hand it to the injected transport,
 * record the outcome, decide retry / DLQ / disable-subscription. Pure
 * logic — no DB, no BullMQ, no clock dependency (caller injects `nowIso`
 * + `random`). The live worker (Sprint 24) wraps this with a poller and
 * a BullMQ delayed-retry mechanism.
 */

export interface OutboxRow {
  id: string;
  tenantId: string;
  eventType: string;
  source: string;
  eventTime: string; // RFC 3339
  data: Record<string, unknown>;
}

export interface SubscriptionRow {
  id: string;
  tenantId: string;
  eventType: string;
  targetUrl: string;
  /** Plaintext at sign time — caller is responsible for decryption. */
  hmacSecret: string;
}

export interface DispatchOutcome {
  /** Per-attempt fields the caller persists into `webhook_delivery_attempts`. */
  attempt: {
    deliveryId: string;
    attemptNumber: number;
    outcome: ReturnType<typeof classifyHttpStatus> | 'timeout' | 'connection_refused' | 'tls_error' | 'unknown';
    httpStatus: number | null;
    durationMs: number;
    errorMessage: string | null;
  };
  /** What the caller should do next. */
  next: ReturnType<typeof decideRetry>;
}

export interface DispatchInputs {
  outbox: OutboxRow;
  subscription: SubscriptionRow;
  attemptJustToExecute: number; // 1-based
  nowIso: string; // RFC 3339
  random: () => number;
  transport: WebhookHttpTransport;
  signer: HmacSigner;
  /** Per-call request timeout (ms). Default 10s. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export async function dispatchOnce(inputs: DispatchInputs): Promise<DispatchOutcome> {
  const {
    outbox,
    subscription,
    attemptJustToExecute,
    nowIso,
    random,
    transport,
    signer,
    timeoutMs,
  } = inputs;

  if (attemptJustToExecute < 1) {
    throw new Error(`attemptJustToExecute must be >= 1 (got ${attemptJustToExecute})`);
  }
  if (attemptJustToExecute > RETRY_POLICY_LIMITS.MAX_ATTEMPTS) {
    throw new Error(
      `attemptJustToExecute ${attemptJustToExecute} exceeds MAX_ATTEMPTS ${RETRY_POLICY_LIMITS.MAX_ATTEMPTS}`,
    );
  }

  const deliveryId = randomUUID();
  const rawBody = JSON.stringify({
    specversion: '1.0',
    id: outbox.id,
    type: outbox.eventType,
    source: outbox.source,
    time: outbox.eventTime,
    datacontenttype: 'application/json',
    data: outbox.data,
  });
  const signature = signer.sign({
    timestamp: nowIso,
    rawBody,
    secret: subscription.hmacSecret,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-SmartERP-Event-Id': outbox.id,
    'X-SmartERP-Event-Type': outbox.eventType,
    'X-SmartERP-Timestamp': nowIso,
    'X-SmartERP-Signature': signature,
    'X-SmartERP-Delivery-Id': deliveryId,
    'X-SmartERP-Delivery-Attempt': String(attemptJustToExecute),
  };

  let response: WebhookHttpResponse;
  try {
    response = await transport.send({
      url: subscription.targetUrl,
      rawBody,
      headers,
      timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    response = {
      status: null,
      networkError: 'unknown',
      errorMessage: message.slice(0, 2000),
      durationMs: 0,
    };
  }

  const outcome = response.networkError
    ? response.networkError
    : classifyHttpStatus(response.status);

  const next = decideRetry({
    attemptJustExecuted: attemptJustToExecute,
    outcome,
    retryAfterSeconds: response.retryAfterSeconds,
    random,
  });

  return {
    attempt: {
      deliveryId,
      attemptNumber: attemptJustToExecute,
      outcome,
      httpStatus: response.status,
      durationMs: response.durationMs,
      errorMessage: response.errorMessage ?? null,
    },
    next,
  };
}
