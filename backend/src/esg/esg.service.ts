import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { renderMinimalPdf } from '../compliance/pdf.renderer';

/**
 * Energy + ESG reporting (plan §31.3 Sprint 45).
 *
 * v1 ships an ESRS-E1 (climate change) skeleton output: per-tenant
 * Scope-1 + Scope-2 emissions estimate driven by tenant.settings
 * inputs (kWh consumption, fuel, fleet). Scope-3 (supply-chain)
 * estimation is deferred to ADR-046 alongside the marketplace
 * partner data feeds.
 *
 * Energy dashboard data comes from the Sprint 18 BI projection layer
 * (a new `energy_kwh_monthly` projection consumes the tenant's
 * meter-reading inputs); v1 surfaces the report generator + the
 * tenant-side input shape.
 */
export interface EsgInputs {
  kwhElectricity: number;
  kwhRenewableSelfProduced: number;
  litresDieselFleet: number;
  litresGasolineFleet: number;
  m3NaturalGas: number;
}

export interface EsgReport {
  tenantId: string;
  tenantName: string;
  reportingYear: number;
  scope1KgCo2e: number;
  scope2KgCo2e: number;
  totalKgCo2e: number;
  notes: string;
}

const EMISSION_FACTORS = {
  // Italy 2024 grid mix — kg CO2e / kWh consumed.
  electricity: 0.275,
  // Diesel fleet — kg CO2e per litre.
  diesel: 2.68,
  // Gasoline fleet — kg CO2e per litre.
  gasoline: 2.31,
  // Natural gas — kg CO2e per m³.
  naturalGas: 1.96,
};

@Injectable()
export class EsgService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  computeReport(
    tenantId: string,
    tenantName: string,
    reportingYear: number,
    inputs: EsgInputs,
  ): EsgReport {
    const scope2 =
      Math.max(0, inputs.kwhElectricity - inputs.kwhRenewableSelfProduced) *
      EMISSION_FACTORS.electricity;
    const scope1 =
      inputs.litresDieselFleet * EMISSION_FACTORS.diesel +
      inputs.litresGasolineFleet * EMISSION_FACTORS.gasoline +
      inputs.m3NaturalGas * EMISSION_FACTORS.naturalGas;
    return {
      tenantId,
      tenantName,
      reportingYear,
      scope1KgCo2e: Math.round(scope1),
      scope2KgCo2e: Math.round(scope2),
      totalKgCo2e: Math.round(scope1 + scope2),
      notes:
        'Calcolo basato su fattori di emissione 2024 (mix elettrico ITA, diesel, benzina, gas naturale). Scope-3 fuori ambito v1.',
    };
  }

  async generateReportPdf(
    tenantId: string,
    reportingYear: number,
    inputs: EsgInputs,
  ): Promise<{ filename: string; body: Buffer; contentType: string }> {
    // eslint-disable-next-line no-untenanted-query
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const name = tenant?.name ?? '(tenant)';
    const r = this.computeReport(tenantId, name, reportingYear, inputs);
    const lines = [
      `ESG Report — ${name}`,
      `Tenant ID: ${tenantId}`,
      `Reporting year: ${reportingYear}`,
      '',
      'Riferimenti normativi',
      '  Direttiva UE 2022/2464 (CSRD); ESRS E1 — climate change',
      '  D.Lgs. 254/2016 (DNF — Dichiarazione Non Finanziaria)',
      '  Piano Transizione 5.0 — credito d\'imposta efficienza energetica',
      '',
      'Scope 1 — emissioni dirette',
      `  Diesel flotta: ${inputs.litresDieselFleet} L → ${(inputs.litresDieselFleet * EMISSION_FACTORS.diesel).toFixed(0)} kg CO2e`,
      `  Benzina flotta: ${inputs.litresGasolineFleet} L → ${(inputs.litresGasolineFleet * EMISSION_FACTORS.gasoline).toFixed(0)} kg CO2e`,
      `  Gas naturale: ${inputs.m3NaturalGas} m³ → ${(inputs.m3NaturalGas * EMISSION_FACTORS.naturalGas).toFixed(0)} kg CO2e`,
      `  Totale Scope 1: ${r.scope1KgCo2e} kg CO2e`,
      '',
      'Scope 2 — energia acquistata',
      `  kWh elettricità: ${inputs.kwhElectricity}`,
      `  kWh rinnovabili autoprodotti: ${inputs.kwhRenewableSelfProduced}`,
      `  Totale Scope 2: ${r.scope2KgCo2e} kg CO2e`,
      '',
      `Totale Scope 1 + 2: ${r.totalKgCo2e} kg CO2e`,
      '',
      r.notes,
      '',
      'Firmato: SmartERP ESG — generato dal sistema.',
    ];
    return {
      filename: `esg-report-${tenantId}-${reportingYear}.pdf`,
      contentType: 'application/pdf',
      body: renderMinimalPdf(lines),
    };
  }
}
