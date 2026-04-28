import {
  classifyHttpStatus,
  decideRetry,
  RETRY_POLICY_LIMITS,
  shouldAutoDisableOnDlqStorm,
  DLQ_STORM_THRESHOLD,
  DLQ_STORM_WINDOW_MS,
} from './retry-policy';

describe('classifyHttpStatus (S14.6)', () => {
  it.each([
    [200, 'success_2xx'],
    [201, 'success_2xx'],
    [299, 'success_2xx'],
    [400, 'client_4xx'],
    [403, 'client_4xx'],
    [404, 'not_found_404'],
    [410, 'gone_410'],
    [429, 'rate_limited_429'],
    [500, 'server_5xx'],
    [502, 'server_5xx'],
    [599, 'server_5xx'],
  ])('maps %i → %s', (status, expected) => {
    expect(classifyHttpStatus(status)).toBe(expected);
  });

  it.each([null, undefined, NaN, Infinity, 100])(
    'maps %p → unknown',
    (input) => {
      expect(classifyHttpStatus(input as number)).toBe('unknown');
    },
  );
});

describe('decideRetry (S14.6)', () => {
  it('treats 2xx as success (delayMs=0)', () => {
    const out = decideRetry({
      attemptJustExecuted: 1,
      outcome: 'success_2xx',
      random: () => 0,
    });
    expect(out.action).toBe('retry');
    expect(out.delayMs).toBe(0);
  });

  it('disables subscription on 410 Gone', () => {
    const out = decideRetry({
      attemptJustExecuted: 1,
      outcome: 'gone_410',
      random: () => 0,
    });
    expect(out.action).toBe('disable_subscription');
    expect(out.disableReason).toMatch(/410 Gone/);
  });

  it('disables subscription on 404 Not Found', () => {
    const out = decideRetry({
      attemptJustExecuted: 1,
      outcome: 'not_found_404',
      random: () => 0,
    });
    expect(out.action).toBe('disable_subscription');
    expect(out.disableReason).toMatch(/404 Not Found/);
  });

  it('schedules attempt 2 ≥ 30s with bounded jitter', () => {
    const noJitter = decideRetry({
      attemptJustExecuted: 1,
      outcome: 'server_5xx',
      random: () => 0,
    });
    expect(noJitter.action).toBe('retry');
    expect(noJitter.delayMs).toBe(30_000);

    const fullJitter = decideRetry({
      attemptJustExecuted: 1,
      outcome: 'server_5xx',
      random: () => 1,
    });
    expect(fullJitter.delayMs).toBe(30_000 + 10_000);
  });

  it('schedules attempt 6 ≥ 6h with bounded jitter', () => {
    const out = decideRetry({
      attemptJustExecuted: 5,
      outcome: 'server_5xx',
      random: () => 0,
    });
    expect(out.action).toBe('retry');
    expect(out.delayMs).toBe(6 * 60 * 60_000);
  });

  it('moves to DLQ after MAX_ATTEMPTS', () => {
    const out = decideRetry({
      attemptJustExecuted: RETRY_POLICY_LIMITS.MAX_ATTEMPTS,
      outcome: 'server_5xx',
      random: () => 0,
    });
    expect(out.action).toBe('dlq');
  });

  it('honours Retry-After on 429 (clamped to ≤ 30 minutes)', () => {
    const ok = decideRetry({
      attemptJustExecuted: 1,
      outcome: 'rate_limited_429',
      retryAfterSeconds: 60,
      random: () => 0,
    });
    expect(ok.delayMs).toBe(60_000);

    const clamped = decideRetry({
      attemptJustExecuted: 1,
      outcome: 'rate_limited_429',
      retryAfterSeconds: 24 * 3600,
      random: () => 0,
    });
    expect(clamped.delayMs).toBe(30 * 60 * 1000);
  });

  it('falls back to exponential schedule on 429 without Retry-After', () => {
    const out = decideRetry({
      attemptJustExecuted: 1,
      outcome: 'rate_limited_429',
      random: () => 0,
    });
    expect(out.action).toBe('retry');
    expect(out.delayMs).toBe(30_000);
  });

  it('treats network failures as retriable', () => {
    for (const outcome of ['timeout', 'connection_refused', 'tls_error', 'unknown'] as const) {
      const out = decideRetry({
        attemptJustExecuted: 2,
        outcome,
        random: () => 0,
      });
      expect(out.action).toBe('retry');
      expect(out.delayMs).toBeGreaterThan(0);
    }
  });
});

describe('shouldAutoDisableOnDlqStorm (S14.6)', () => {
  it('does not trip below the threshold', () => {
    const now = Date.now();
    const ts = Array.from({ length: DLQ_STORM_THRESHOLD - 1 }, () => now - 1000);
    expect(shouldAutoDisableOnDlqStorm(ts, now)).toBe(false);
  });

  it('trips at the threshold inside the window', () => {
    const now = Date.now();
    const ts = Array.from({ length: DLQ_STORM_THRESHOLD }, () => now - 1000);
    expect(shouldAutoDisableOnDlqStorm(ts, now)).toBe(true);
  });

  it('does not trip when entries are outside the rolling window', () => {
    const now = Date.now();
    const ts = Array.from(
      { length: DLQ_STORM_THRESHOLD + 5 },
      () => now - DLQ_STORM_WINDOW_MS - 1000,
    );
    expect(shouldAutoDisableOnDlqStorm(ts, now)).toBe(false);
  });
});
