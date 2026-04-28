import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadModelRow } from '../bi/entities/read-model-row.entity';

/**
 * Anomaly detection (plan §31.2 Sprint 30).
 *
 * v1 ships a deterministic z-score detector over the BI projection
 * read model. Tenant-scoped.
 */
export interface AnomalyFinding {
  projectionId: string;
  key: string;
  field: string;
  value: number;
  mean: number;
  stdev: number;
  zScore: number;
  severity: 'low' | 'medium' | 'high';
}

@Injectable()
export class AnomalyService {
  constructor(
    @InjectRepository(ReadModelRow)
    private readonly rmRepo: Repository<ReadModelRow>,
  ) {}

  async detect(
    tenantId: string,
    projectionId: string,
    field: string,
    threshold = 2,
  ): Promise<AnomalyFinding[]> {
    const rows = await this.rmRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.projectionId = :p', { p: projectionId })
      .getMany();
    const values = rows
      .map((r) => Number((r.payload as Record<string, unknown>)[field] ?? 0))
      .filter((v) => Number.isFinite(v));
    if (values.length < 3) return [];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + (b - mean) * (b - mean), 0) /
      values.length;
    const stdev = Math.sqrt(variance) || 1;
    const findings: AnomalyFinding[] = [];
    for (const r of rows) {
      const value = Number(
        (r.payload as Record<string, unknown>)[field] ?? 0,
      );
      const z = (value - mean) / stdev;
      if (Math.abs(z) >= threshold) {
        findings.push({
          projectionId,
          key: r.key,
          field,
          value,
          mean,
          stdev,
          zScore: z,
          severity: Math.abs(z) >= 3 ? 'high' : Math.abs(z) >= 2 ? 'medium' : 'low',
        });
      }
    }
    return findings.sort(
      (a, b) => Math.abs(b.zScore) - Math.abs(a.zScore),
    );
  }
}
