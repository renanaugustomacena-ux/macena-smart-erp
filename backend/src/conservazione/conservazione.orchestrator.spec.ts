import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnprocessableEntityException } from '@nestjs/common';
import { ConservazioneOrchestrator } from './conservazione.orchestrator';
import { ConservazioneRegistry } from './conservazione-registry.service';
import {
  ConservazioneAdapter,
  ConservazioneVendorId,
  VersamentoRequest,
  VersamentoReceipt,
} from './conservazione.adapter';
import { SubscriptionPlan, Tenant } from '../tenants/tenant.entity';

const TENANT = '11111111-1111-1111-1111-111111111111';

function fakeAdapter(
  vendorId: ConservazioneVendorId,
  send: (req: VersamentoRequest) => Promise<VersamentoReceipt>,
): ConservazioneAdapter {
  return {
    vendorId,
    send,
    fetchReceipt: jest.fn(),
    exhibit: jest.fn(),
    search: jest.fn(),
  } as unknown as ConservazioneAdapter;
}

function ok(vendor: ConservazioneVendorId): VersamentoReceipt {
  return {
    vendorId: vendor,
    versamentoId: `v-${vendor}-1`,
    bundleHashSha256: '0'.repeat(64),
    acknowledgedAt: new Date().toISOString(),
    rapportoDiVersamentoUrl: `https://${vendor}.example/r/1`,
  };
}

function tenantWith(
  plan: SubscriptionPlan,
  conservazione: Record<string, unknown>,
): Tenant {
  return {
    id: TENANT,
    name: 'Demo Spa',
    plan,
    status: 'active',
    settings: { conservazione },
  } as unknown as Tenant;
}

async function build(
  tenants: Tenant[],
  adapters: Partial<Record<ConservazioneVendorId, ConservazioneAdapter>>,
) {
  const tenantRepo = {
    findOne: async ({ where }: { where: { id: string } }) =>
      tenants.find((t) => t.id === where.id) ?? null,
  };
  const registry = {
    get: jest.fn((id: ConservazioneVendorId) => {
      const a = adapters[id];
      if (!a) throw new Error(`No adapter for ${id}`);
      return a;
    }),
    list: jest.fn(() => Object.keys(adapters) as ConservazioneVendorId[]),
  };

  const module = await Test.createTestingModule({
    providers: [
      ConservazioneOrchestrator,
      { provide: ConservazioneRegistry, useValue: registry },
      { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
    ],
  }).compile();

  return {
    svc: module.get(ConservazioneOrchestrator),
    registry,
  };
}

const REQUEST: VersamentoRequest = {
  documentBody: Buffer.from('<xml>fake</xml>', 'utf8'),
  documentMimeType: 'application/xml',
  index: {
    reference: 'INV-001',
    documentClass: 'fatturapa_attiva',
    issuerFiscalId: '12345678901',
    documentDate: '2026-04-15',
    documentNumber: '1',
    documentHashSha256: '0'.repeat(64),
  },
  tenantId: TENANT,
};

describe('ConservazioneOrchestrator — tier policy (ADR-025)', () => {
  it('rejects Base tenant attempting dual-vendor configuration', async () => {
    const tenant = tenantWith(SubscriptionPlan.BASE, {
      primary: 'aruba',
      secondary: 'infocert',
    });
    const { svc } = await build(
      [tenant],
      {
        aruba: fakeAdapter('aruba', async () => ok('aruba')),
        infocert: fakeAdapter('infocert', async () => ok('infocert')),
      },
    );
    await expect(svc.submit(REQUEST)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('routes Base tenant directly to primary (single policy)', async () => {
    const tenant = tenantWith(SubscriptionPlan.BASE, { primary: 'aruba' });
    const { svc } = await build(
      [tenant],
      {
        aruba: fakeAdapter('aruba', async () => ok('aruba')),
      },
    );
    const r = await svc.submit(REQUEST);
    expect(r.vendorId).toBe('aruba');
    expect(r.tierPolicy).toBe('single');
    expect(r.failoverFrom).toBeNull();
  });

  it('Professionale tenant: failover to secondary on primary 5xx', async () => {
    const tenant = tenantWith(SubscriptionPlan.PROFESSIONALE, {
      primary: 'aruba',
      secondary: 'infocert',
    });
    const arubaSend = jest.fn(async () => {
      const e = new Error('SOAP fault: 503 Service Unavailable');
      (e as unknown as { status: number }).status = 503;
      throw e;
    });
    const infocertSend = jest.fn(async () => ok('infocert'));
    const { svc, registry } = await build(
      [tenant],
      {
        aruba: fakeAdapter('aruba', arubaSend),
        infocert: fakeAdapter('infocert', infocertSend),
      },
    );
    const r = await svc.submit(REQUEST);
    expect(arubaSend).toHaveBeenCalledTimes(1);
    expect(infocertSend).toHaveBeenCalledTimes(1);
    expect(r.vendorId).toBe('infocert');
    expect(r.failoverFrom).toBe('aruba');
    expect(r.tierPolicy).toBe('dual');
    expect(registry.get).toHaveBeenCalledWith('aruba');
    expect(registry.get).toHaveBeenCalledWith('infocert');
  });

  it('does NOT failover on permanent 4xx from primary', async () => {
    const tenant = tenantWith(SubscriptionPlan.PROFESSIONALE, {
      primary: 'aruba',
      secondary: 'infocert',
    });
    const arubaSend = jest.fn(async () => {
      const e = new Error('Bad Request: missing IdPaese');
      (e as unknown as { status: number }).status = 400;
      throw e;
    });
    const infocertSend = jest.fn(async () => ok('infocert'));
    const { svc } = await build(
      [tenant],
      {
        aruba: fakeAdapter('aruba', arubaSend),
        infocert: fakeAdapter('infocert', infocertSend),
      },
    );
    await expect(svc.submit(REQUEST)).rejects.toThrow(/Bad Request/);
    expect(infocertSend).not.toHaveBeenCalled();
  });

  it('Enterprise tenant cascades primary → secondary → tertiary', async () => {
    const tenant = tenantWith(SubscriptionPlan.ENTERPRISE, {
      primary: 'aruba',
      secondary: 'infocert',
      tertiary: 'namirial',
    });
    const arubaSend = jest.fn(async () => {
      const e = new Error('ECONNRESET');
      throw e;
    });
    const infocertSend = jest.fn(async () => {
      const e = new Error('502 Bad Gateway');
      (e as unknown as { status: number }).status = 502;
      throw e;
    });
    const namirialSend = jest.fn(async () => ok('namirial'));
    const { svc } = await build(
      [tenant],
      {
        aruba: fakeAdapter('aruba', arubaSend),
        infocert: fakeAdapter('infocert', infocertSend),
        namirial: fakeAdapter('namirial', namirialSend),
      },
    );
    const r = await svc.submit(REQUEST);
    expect(r.vendorId).toBe('namirial');
    expect(r.failoverFrom).toBe('infocert');
    expect(r.tierPolicy).toBe('triple');
  });
});

describe('InfoCertConservazioneAdapter — sandbox mode (S16.4)', () => {
  it('returns a deterministic sandbox receipt', async () => {
    const { InfoCertConservazioneAdapter } = await import('./infocert.adapter');
    const previous = process.env.CONSERVAZIONE_INFOCERT_MODE;
    process.env.CONSERVAZIONE_INFOCERT_MODE = 'sandbox';
    try {
      const adapter = new InfoCertConservazioneAdapter();
      const r = await adapter.send(REQUEST);
      expect(r.vendorId).toBe('infocert');
      expect(r.versamentoId).toMatch(/^IC-SBX-/);
      expect(r.rapportoDiVersamentoUrl).toContain('sandbox.infocert');
    } finally {
      process.env.CONSERVAZIONE_INFOCERT_MODE = previous;
    }
  });

  it('throws in production mode until Sprint 23 wiring lands', async () => {
    const { InfoCertConservazioneAdapter } = await import('./infocert.adapter');
    const previous = process.env.CONSERVAZIONE_INFOCERT_MODE;
    process.env.CONSERVAZIONE_INFOCERT_MODE = 'production';
    try {
      const adapter = new InfoCertConservazioneAdapter();
      await expect(adapter.send(REQUEST)).rejects.toThrow(/Sprint 23/);
    } finally {
      process.env.CONSERVAZIONE_INFOCERT_MODE = previous;
    }
  });
});
