import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { AnthropicClient } from './anthropic.client';
import { ToolRegistry } from './tool-registry.service';
import { CopilotCostCounter } from './entities/copilot-cost-counter.entity';
import { Tenant } from '../tenants/tenant.entity';

const TENANT = '11111111-1111-1111-1111-111111111111';

async function build(plan: 'base' | 'professionale' | 'enterprise', dailyCap?: number) {
  const counters: CopilotCostCounter[] = [];
  const tenants = [
    {
      id: TENANT,
      name: 'Acme',
      plan,
      settings:
        dailyCap !== undefined
          ? { aiCopilot: { dailyTokenCap: dailyCap } }
          : null,
    } as unknown as Tenant,
  ];

  const counterRepo = {
    findOne: async ({ where }: { where: Partial<CopilotCostCounter> }) =>
      counters.find((c) => {
        const w = where as Partial<CopilotCostCounter>;
        if (w.tenantId && c.tenantId !== w.tenantId) return false;
        if (w.date) {
          const a =
            (c.date as unknown as Date).getTime?.() ??
            new Date(c.date as unknown as string).getTime();
          const b =
            (w.date as unknown as Date).getTime?.() ??
            new Date(w.date as unknown as string).getTime();
          if (a !== b) return false;
        }
        return true;
      }) ?? null,
    save: async (c: CopilotCostCounter) => {
      const i = counters.findIndex((x) => x.id === c.id);
      if (i >= 0) counters[i] = c;
      else {
        if (!c.id) c.id = `c-${counters.length + 1}`;
        counters.push(c);
      }
      return c;
    },
    create: (partial: Partial<CopilotCostCounter>) =>
      ({
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        turnsCount: 0,
        capRejectionsCount: 0,
        ...partial,
      }) as CopilotCostCounter,
  };
  const tenantRepo = {
    findOne: async ({ where }: { where: { id: string } }) =>
      tenants.find((t) => t.id === where.id) ?? null,
  };

  const module = await Test.createTestingModule({
    providers: [
      CopilotService,
      { provide: AnthropicClient, useValue: new AnthropicClient() },
      {
        provide: ToolRegistry,
        useValue: { forPersona: () => [] },
      },
      {
        provide: getRepositoryToken(CopilotCostCounter),
        useValue: counterRepo,
      },
      { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
    ],
  }).compile();
  return { svc: module.get(CopilotService), counters };
}

describe('CopilotService (Sprint 25)', () => {
  it('records per-tenant per-day usage on each ask', async () => {
    const { svc, counters } = await build('professionale');
    const r1 = await svc.ask(TENANT, 'Mostra le ultime 5 fatture');
    expect(r1.output).toContain('synthetic');
    expect(counters).toHaveLength(1);
    expect(Number(counters[0].turnsCount)).toBe(1);
  });

  it('rejects when the daily token cap is reached', async () => {
    const { svc } = await build('base', 10);
    // First call records a small usage but exceeds the cap on the second.
    await svc.ask(TENANT, 'short');
    await expect(svc.ask(TENANT, 'second')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
