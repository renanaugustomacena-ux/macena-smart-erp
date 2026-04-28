import { NotImplementedException, NotFoundException } from '@nestjs/common';
import { ArubaConservazioneAdapter } from './aruba.adapter';
import { InfoCertConservazioneAdapter } from './infocert.adapter';
import { ConservazioneRegistry } from './conservazione-registry.service';
import type { ConservazioneVendorId } from './conservazione.adapter';

describe('ConservazioneRegistry (S14.5 skeleton)', () => {
  function build(): ConservazioneRegistry {
    return new ConservazioneRegistry(
      new ArubaConservazioneAdapter(),
      new InfoCertConservazioneAdapter(),
    );
  }

  it('exposes the Aruba adapter under vendorId="aruba"', () => {
    const reg = build();
    const adapter = reg.get('aruba');
    expect(adapter).toBeDefined();
    expect(adapter.vendorId).toBe('aruba');
  });

  it('exposes the InfoCert adapter under vendorId="infocert"', () => {
    const reg = build();
    const adapter = reg.get('infocert');
    expect(adapter).toBeDefined();
    expect(adapter.vendorId).toBe('infocert');
  });

  it('lists both registered Conservatori', () => {
    const reg = build();
    expect(reg.list().sort()).toEqual(['aruba', 'infocert']);
  });

  it('throws NotFoundException for an unknown vendorId', () => {
    const reg = build();
    expect(() =>
      reg.get('namirial' as ConservazioneVendorId),
    ).toThrow(NotFoundException);
  });
});

describe('ArubaConservazioneAdapter (S14.5 skeleton — explicit NotImplemented)', () => {
  const adapter = new ArubaConservazioneAdapter();

  it('throws NotImplementedException on send()', async () => {
    await expect(
      adapter.send({
        documentBody: Buffer.from('<xml/>'),
        documentMimeType: 'application/xml',
        index: anyIndex(),
        tenantId: 'tenant-1',
      }),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('throws NotImplementedException on fetchReceipt()', async () => {
    await expect(adapter.fetchReceipt('vid-x')).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  it('throws NotImplementedException on exhibit()', async () => {
    await expect(adapter.exhibit('vid-x')).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  it('throws NotImplementedException on search()', async () => {
    await expect(
      adapter.search({ tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });
});

describe('InfoCertConservazioneAdapter (S16.4 — sandbox + production split)', () => {
  // Sandbox mode is the default; the adapter returns deterministic
  // synthetic receipts so the orchestrator failover path can be exercised
  // ahead of the Sprint 23 production wiring.
  describe('sandbox mode (default)', () => {
    let saved: string | undefined;
    let adapter: InfoCertConservazioneAdapter;
    beforeAll(() => {
      saved = process.env.CONSERVAZIONE_INFOCERT_MODE;
      process.env.CONSERVAZIONE_INFOCERT_MODE = 'sandbox';
      adapter = new InfoCertConservazioneAdapter();
    });
    afterAll(() => {
      process.env.CONSERVAZIONE_INFOCERT_MODE = saved;
    });

    it('send() returns a sandbox VersamentoReceipt', async () => {
      const r = await adapter.send({
        documentBody: Buffer.from('<xml/>'),
        documentMimeType: 'application/xml',
        index: anyIndex(),
        tenantId: 'tenant-1',
      });
      expect(r.vendorId).toBe('infocert');
      expect(r.versamentoId).toMatch(/^IC-SBX-/);
    });

    it('fetchReceipt() returns a sandbox receipt', async () => {
      const r = await adapter.fetchReceipt('vid-x');
      expect(r.versamentoId).toBe('vid-x');
      expect(r.vendorDocClass).toBe('sandbox');
    });

    it('search() returns an empty list', async () => {
      const list = await adapter.search({ tenantId: 'tenant-1' });
      expect(list).toEqual([]);
    });

    it('exhibit() still throws NotImplementedException (Sprint 23)', async () => {
      await expect(adapter.exhibit('vid-x')).rejects.toBeInstanceOf(
        NotImplementedException,
      );
    });
  });

  describe('production mode (Sprint 23 schedule)', () => {
    let saved: string | undefined;
    let adapter: InfoCertConservazioneAdapter;
    beforeAll(() => {
      saved = process.env.CONSERVAZIONE_INFOCERT_MODE;
      process.env.CONSERVAZIONE_INFOCERT_MODE = 'production';
      adapter = new InfoCertConservazioneAdapter();
    });
    afterAll(() => {
      process.env.CONSERVAZIONE_INFOCERT_MODE = saved;
    });

    it('send() throws NotImplementedException', async () => {
      await expect(
        adapter.send({
          documentBody: Buffer.from('<xml/>'),
          documentMimeType: 'application/xml',
          index: anyIndex(),
          tenantId: 'tenant-1',
        }),
      ).rejects.toBeInstanceOf(NotImplementedException);
    });

    it('search() throws NotImplementedException', async () => {
      await expect(
        adapter.search({ tenantId: 'tenant-1' }),
      ).rejects.toBeInstanceOf(NotImplementedException);
    });
  });
});

function anyIndex() {
  return {
    reference: 'SI-2026-00001',
    documentClass: 'fatturapa_passiva' as const,
    issuerFiscalId: '12345678901',
    documentDate: '2026-04-28',
    documentNumber: '2026/0001',
    totalAmountCents: 122_000,
    currency: 'EUR',
    documentHashSha256:
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };
}
