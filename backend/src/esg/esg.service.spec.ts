import { EsgService } from './esg.service';

describe('EsgService (S45)', () => {
  // Bypass DI — the compute path doesn't touch the repository.
  const svc = new EsgService(null as never);

  it('computes Scope 1 + Scope 2 from inputs', () => {
    const r = svc.computeReport('t1', 'Acme', 2026, {
      kwhElectricity: 10_000,
      kwhRenewableSelfProduced: 2_000,
      litresDieselFleet: 1_000,
      litresGasolineFleet: 0,
      m3NaturalGas: 500,
    });
    // Scope 2: 8000 * 0.275 = 2200 kg CO2e
    expect(r.scope2KgCo2e).toBe(2200);
    // Scope 1: 1000 * 2.68 + 0 + 500 * 1.96 = 3660
    expect(r.scope1KgCo2e).toBe(3660);
    expect(r.totalKgCo2e).toBe(5860);
  });

  it('clamps renewable above gross to zero net Scope 2', () => {
    const r = svc.computeReport('t1', 'Acme', 2026, {
      kwhElectricity: 1_000,
      kwhRenewableSelfProduced: 5_000,
      litresDieselFleet: 0,
      litresGasolineFleet: 0,
      m3NaturalGas: 0,
    });
    expect(r.scope2KgCo2e).toBe(0);
    expect(r.scope1KgCo2e).toBe(0);
  });
});
