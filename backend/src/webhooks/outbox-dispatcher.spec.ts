import { HmacSigner } from './hmac-signer';
import { dispatchOnce, type OutboxRow, type SubscriptionRow } from './outbox-dispatcher';
import type {
  WebhookHttpRequest,
  WebhookHttpResponse,
  WebhookHttpTransport,
} from './webhook-http-transport';

class FakeTransport implements WebhookHttpTransport {
  public lastRequest?: WebhookHttpRequest;
  constructor(private readonly response: WebhookHttpResponse) {}
  async send(request: WebhookHttpRequest): Promise<WebhookHttpResponse> {
    this.lastRequest = request;
    return this.response;
  }
}

const outbox: OutboxRow = {
  id: '11111111-1111-1111-1111-111111111111',
  tenantId: 'tenant-1',
  eventType: 'it.smarterp.procurement.gr_confirmed.v1',
  source: 'urn:smarterp:procurement',
  eventTime: '2026-04-28T10:00:00Z',
  data: { goodsReceiptId: 'gr-1' },
};

const subscription: SubscriptionRow = {
  id: '22222222-2222-2222-2222-222222222222',
  tenantId: 'tenant-1',
  eventType: 'it.smarterp.procurement.gr_confirmed.v1',
  targetUrl: 'https://consumer.example.com/hooks',
  hmacSecret: 'shared-secret',
};

describe('dispatchOnce (S14.6)', () => {
  it('signs the request and reports success on 2xx', async () => {
    const transport = new FakeTransport({
      status: 202,
      durationMs: 42,
    });
    const signer = new HmacSigner();
    const out = await dispatchOnce({
      outbox,
      subscription,
      attemptJustToExecute: 1,
      nowIso: '2026-04-28T10:00:00Z',
      random: () => 0,
      transport,
      signer,
    });
    expect(out.attempt.outcome).toBe('success_2xx');
    expect(out.attempt.httpStatus).toBe(202);
    expect(out.next.action).toBe('retry');
    expect(out.next.delayMs).toBe(0);

    const req = transport.lastRequest!;
    expect(req.url).toBe(subscription.targetUrl);
    expect(req.headers['Content-Type']).toBe('application/json');
    expect(req.headers['X-SmartERP-Event-Id']).toBe(outbox.id);
    expect(req.headers['X-SmartERP-Event-Type']).toBe(outbox.eventType);
    expect(req.headers['X-SmartERP-Timestamp']).toBe('2026-04-28T10:00:00Z');
    expect(req.headers['X-SmartERP-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(req.headers['X-SmartERP-Delivery-Attempt']).toBe('1');
    // Verify the signature roundtrips against the same body.
    const verified = signer.verify(
      {
        timestamp: '2026-04-28T10:00:00Z',
        rawBody: req.rawBody,
        secret: subscription.hmacSecret,
      },
      req.headers['X-SmartERP-Signature'],
    );
    expect(verified).toBe(true);
  });

  it('schedules a retry on 5xx (attempt 1 → ~30s)', async () => {
    const transport = new FakeTransport({
      status: 503,
      durationMs: 100,
    });
    const out = await dispatchOnce({
      outbox,
      subscription,
      attemptJustToExecute: 1,
      nowIso: '2026-04-28T10:00:00Z',
      random: () => 0,
      transport,
      signer: new HmacSigner(),
    });
    expect(out.attempt.outcome).toBe('server_5xx');
    expect(out.next.action).toBe('retry');
    expect(out.next.delayMs).toBe(30_000);
  });

  it('moves to DLQ after attempt 6 fails', async () => {
    const transport = new FakeTransport({
      status: 502,
      durationMs: 100,
    });
    const out = await dispatchOnce({
      outbox,
      subscription,
      attemptJustToExecute: 6,
      nowIso: '2026-04-28T10:00:00Z',
      random: () => 0,
      transport,
      signer: new HmacSigner(),
    });
    expect(out.next.action).toBe('dlq');
  });

  it('disables subscription on 410 Gone', async () => {
    const transport = new FakeTransport({
      status: 410,
      durationMs: 50,
    });
    const out = await dispatchOnce({
      outbox,
      subscription,
      attemptJustToExecute: 1,
      nowIso: '2026-04-28T10:00:00Z',
      random: () => 0,
      transport,
      signer: new HmacSigner(),
    });
    expect(out.attempt.outcome).toBe('gone_410');
    expect(out.next.action).toBe('disable_subscription');
  });

  it('honours Retry-After on 429', async () => {
    const transport = new FakeTransport({
      status: 429,
      retryAfterSeconds: 120,
      durationMs: 30,
    });
    const out = await dispatchOnce({
      outbox,
      subscription,
      attemptJustToExecute: 1,
      nowIso: '2026-04-28T10:00:00Z',
      random: () => 0,
      transport,
      signer: new HmacSigner(),
    });
    expect(out.attempt.outcome).toBe('rate_limited_429');
    expect(out.next.action).toBe('retry');
    expect(out.next.delayMs).toBe(120_000);
  });

  it('classifies a network timeout as timeout outcome', async () => {
    const transport: WebhookHttpTransport = {
      async send() {
        return {
          status: null,
          networkError: 'timeout',
          durationMs: 10_000,
          errorMessage: 'request timed out',
        };
      },
    };
    const out = await dispatchOnce({
      outbox,
      subscription,
      attemptJustToExecute: 1,
      nowIso: '2026-04-28T10:00:00Z',
      random: () => 0,
      transport,
      signer: new HmacSigner(),
    });
    expect(out.attempt.outcome).toBe('timeout');
    expect(out.next.action).toBe('retry');
  });

  it('emits a CloudEvents 1.0 envelope as the request body', async () => {
    const transport = new FakeTransport({ status: 200, durationMs: 10 });
    await dispatchOnce({
      outbox,
      subscription,
      attemptJustToExecute: 1,
      nowIso: '2026-04-28T10:00:00Z',
      random: () => 0,
      transport,
      signer: new HmacSigner(),
    });
    const body = JSON.parse(transport.lastRequest!.rawBody);
    expect(body.specversion).toBe('1.0');
    expect(body.id).toBe(outbox.id);
    expect(body.type).toBe(outbox.eventType);
    expect(body.source).toBe(outbox.source);
    expect(body.time).toBe(outbox.eventTime);
    expect(body.data).toEqual(outbox.data);
  });

  it('rejects out-of-bounds attempt numbers', async () => {
    await expect(
      dispatchOnce({
        outbox,
        subscription,
        attemptJustToExecute: 0,
        nowIso: '2026-04-28T10:00:00Z',
        random: () => 0,
        transport: new FakeTransport({ status: 200, durationMs: 10 }),
        signer: new HmacSigner(),
      }),
    ).rejects.toThrow(/>= 1/);
    await expect(
      dispatchOnce({
        outbox,
        subscription,
        attemptJustToExecute: 99,
        nowIso: '2026-04-28T10:00:00Z',
        random: () => 0,
        transport: new FakeTransport({ status: 200, durationMs: 10 }),
        signer: new HmacSigner(),
      }),
    ).rejects.toThrow(/exceeds MAX_ATTEMPTS/);
  });
});
