import { NotImplementedException, NotFoundException } from '@nestjs/common';
import { BartoliniAdapter } from './bartolini.adapter';
import { CarrierRegistry } from './carrier-registry.service';
import type { CarrierId } from './carrier.adapter';

describe('CarrierRegistry (S13.4 skeleton)', () => {
  it('exposes the Bartolini adapter under carrierId="bartolini"', () => {
    const reg = new CarrierRegistry(new BartoliniAdapter());
    const adapter = reg.get('bartolini');
    expect(adapter).toBeDefined();
    expect(adapter.carrierId).toBe('bartolini');
  });

  it('lists the registered carriers', () => {
    const reg = new CarrierRegistry(new BartoliniAdapter());
    expect(reg.list()).toEqual(['bartolini']);
  });

  it('throws NotFoundException for an unknown carrierId', () => {
    const reg = new CarrierRegistry(new BartoliniAdapter());
    expect(() => reg.get('gls' as CarrierId)).toThrow(NotFoundException);
  });
});

describe('BartoliniAdapter (S13.4 skeleton — explicit NotImplemented)', () => {
  const adapter = new BartoliniAdapter();

  it('throws NotImplementedException on quote()', async () => {
    await expect(
      adapter.quote({
        fromAddress: anyAddress(),
        toAddress: anyAddress(),
        parcels: [{ weightGrams: 1000 }],
      }),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('throws NotImplementedException on createShipment()', async () => {
    await expect(
      adapter.createShipment({
        reference: 'SH-2026-00001',
        fromAddress: anyAddress(),
        toAddress: anyAddress(),
        parcels: [{ weightGrams: 1000 }],
      }),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('throws NotImplementedException on fetchLabel()', async () => {
    await expect(adapter.fetchLabel('x')).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  it('throws NotImplementedException on track()', async () => {
    await expect(adapter.track('TRACK123')).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  it('throws NotImplementedException on cancelShipment()', async () => {
    await expect(adapter.cancelShipment('x')).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });
});

function anyAddress() {
  return {
    name: 'Test',
    street: 'Via Roma 1',
    city: 'Verona',
    postalCode: '37100',
    country: 'IT',
  };
}
