import type { WebhookDeliveryOutcome } from './entities/webhook-delivery-attempt.entity';

/**
 * WebhookRetryPolicy — pure logic, no DB / network (ADR-037).
 *
 * Schedule (with up to ±N seconds of jitter to spread the thundering
 * herd):
 *   attempt 1 →   0  s   (immediate)
 *   attempt 2 →  30  s + jitter(0..10s)
 *   attempt 3 →   5 min + jitter(0..1m)
 *   attempt 4 →  30 min + jitter(0..5m)
 *   attempt 5 →   2 h   + jitter(0..15m)
 *   attempt 6 →   6 h   + jitter(0..30m)
 *   attempt 7 → DLQ (no further retries)
 *
 * Total wall-clock to DLQ is ≤ 9 hours.
 */
export interface RetryDecision {
  /**
   * - `retry`: enqueue a delayed retry; `delayMs` is set.
   * - `dlq`:   move to DLQ.
   * - `disable_subscription`: tell the dispatcher to flip subscription
   *            status to `disabled` (e.g. on 410 Gone or 404 Not Found).
   */
  action: 'retry' | 'dlq' | 'disable_subscription';
  delayMs?: number;
  disableReason?: string;
}

const MAX_ATTEMPTS = 6;

/** Base delay (in ms) before each attempt's jitter is added. */
const BASE_DELAYS_MS: ReadonlyArray<number> = [
  0,
  30_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
];

/** Jitter window (in ms) for each attempt index — added to the base. */
const JITTER_WINDOWS_MS: ReadonlyArray<number> = [
  0,
  10_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
];

export interface RetryDecisionInput {
  /** 1-based attempt counter that just executed (i.e., 1 means "first attempt just ran"). */
  attemptJustExecuted: number;
  outcome: WebhookDeliveryOutcome;
  retryAfterSeconds?: number;
  /** Pseudorandom 0..1 used for jitter; injected for determinism in tests. */
  random: () => number;
}

/**
 * Decide what to do after a delivery attempt completes.
 */
export function decideRetry(input: RetryDecisionInput): RetryDecision {
  const { attemptJustExecuted, outcome, retryAfterSeconds, random } = input;

  // Success — no retry.
  if (outcome === 'success_2xx') {
    return { action: 'retry', delayMs: 0 }; // dispatcher uses delayMs=0 to mean done; see callers.
  }

  // Hard "go away" responses: disable subscription.
  if (outcome === 'gone_410') {
    return {
      action: 'disable_subscription',
      disableReason: '410 Gone — consumer indicated endpoint is permanently retired.',
    };
  }
  if (outcome === 'not_found_404') {
    return {
      action: 'disable_subscription',
      disableReason: '404 Not Found — consumer endpoint does not exist.',
    };
  }

  // Out of retries → DLQ.
  if (attemptJustExecuted >= MAX_ATTEMPTS) {
    return { action: 'dlq' };
  }

  // 429 Too Many Requests honours Retry-After (clamped ≤ 30 minutes).
  if (outcome === 'rate_limited_429' && retryAfterSeconds !== undefined) {
    const clamped = Math.min(Math.max(retryAfterSeconds, 1), 30 * 60);
    return { action: 'retry', delayMs: clamped * 1000 };
  }

  // Default: exponential backoff with jitter from the next attempt's slot.
  const nextAttemptIdx = attemptJustExecuted; // 0-indexed slot for the upcoming attempt
  const base = BASE_DELAYS_MS[nextAttemptIdx] ?? BASE_DELAYS_MS[BASE_DELAYS_MS.length - 1];
  const window =
    JITTER_WINDOWS_MS[nextAttemptIdx] ??
    JITTER_WINDOWS_MS[JITTER_WINDOWS_MS.length - 1];
  const jitter = Math.min(window, Math.floor(random() * (window + 1)));
  return { action: 'retry', delayMs: base + jitter };
}

/**
 * Map an HTTP status to the canonical outcome enum used by the audit
 * trail. Falls back to `unknown` for non-numeric / unexpected inputs.
 */
export function classifyHttpStatus(status: number | null | undefined): WebhookDeliveryOutcome {
  if (status === null || status === undefined || !Number.isFinite(status)) {
    return 'unknown';
  }
  if (status === 410) return 'gone_410';
  if (status === 404) return 'not_found_404';
  if (status === 429) return 'rate_limited_429';
  if (status >= 200 && status <= 299) return 'success_2xx';
  if (status >= 400 && status <= 499) return 'client_4xx';
  if (status >= 500 && status <= 599) return 'server_5xx';
  return 'unknown';
}

/** Storm-trip: ≥50 DLQ entries inside any rolling 1-hour window auto-disables. */
export const DLQ_STORM_THRESHOLD = 50;
export const DLQ_STORM_WINDOW_MS = 60 * 60_000;

export function shouldAutoDisableOnDlqStorm(
  recentDlqEntryTimestampsMs: number[],
  nowMs: number,
): boolean {
  const cutoff = nowMs - DLQ_STORM_WINDOW_MS;
  const inWindow = recentDlqEntryTimestampsMs.filter((t) => t >= cutoff);
  return inWindow.length >= DLQ_STORM_THRESHOLD;
}

export const RETRY_POLICY_LIMITS = {
  MAX_ATTEMPTS,
  BASE_DELAYS_MS,
  JITTER_WINDOWS_MS,
} as const;
