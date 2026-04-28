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

describe('InfoCertConservazioneAdapter (S14.5 skeleton — explicit NotImplemented)', () => {
  const adapter = new InfoCertConservazioneAdapter();

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
