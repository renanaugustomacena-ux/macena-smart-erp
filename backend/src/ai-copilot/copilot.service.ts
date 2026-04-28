import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnthropicClient } from './anthropic.client';
import { ToolRegistry } from './tool-registry.service';
import { CopilotCostCounter } from './entities/copilot-cost-counter.entity';
import { Tenant } from '../tenants/tenant.entity';

const DEFAULT_DAILY_TOKEN_CAP = {
  base: 50_000,
  professionale: 250_000,
  enterprise: 1_000_000,
};

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);
  private readonly systemPrompt =
    'Sei l\'assistente AI di SmartERP. Rispondi sempre in italiano. ' +
    'Quando l\'utente chiede dati operativi, chiama lo strumento ' +
    'piu adatto invece di rispondere direttamente. Non inventare ' +
    'numeri.';

  constructor(
    private readonly client: AnthropicClient,
    private readonly registry: ToolRegistry,
    @InjectRepository(CopilotCostCounter)
    private readonly counterRepo: Repository<CopilotCostCounter>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async ask(
    tenantId: string,
    userMessage: string,
    persona: 'sara' | 'marco' | 'luca' | 'giulia' | 'andrea' = 'sara',
  ): Promise<{
    output: string;
    toolCalls: Array<{ name: string; input: Record<string, unknown> }>;
    usage: { inputTokens: number; outputTokens: number; turnsCount: number };
  }> {
    await this.assertWithinCap(tenantId);

    const tools = this.registry
      .forPersona(persona)
      .map((t) => t.definition);

    const response = await this.client.send({
      systemPrompt: this.systemPrompt,
      userMessage,
      tools,
    });

    const toolCalls = response.content
      .filter(
        (b): b is Extract<typeof b, { type: 'tool_use' }> =>
          b.type === 'tool_use',
      )
      .map((b) => ({ name: b.name, input: b.input }));
    const textBlocks = response.content
      .filter(
        (b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text',
      )
      .map((b) => b.text);

    await this.recordUsage(tenantId, response.usage);

    return {
      output: textBlocks.join('\n').trim(),
      toolCalls,
      usage: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        turnsCount: 1,
      },
    };
  }

  async dailyCounter(
    tenantId: string,
    date: Date = new Date(),
  ): Promise<CopilotCostCounter> {
    const day = new Date(date);
    day.setUTCHours(0, 0, 0, 0);
    let row = await this.counterRepo.findOne({
      where: { tenantId, date: day },
    });
    if (!row) {
      row = this.counterRepo.create({
        tenantId,
        date: day,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        turnsCount: 0,
        capRejectionsCount: 0,
      });
      row = await this.counterRepo.save(row);
    }
    return row;
  }

  // ─── Private ──────────────────────────────────────────

  private async assertWithinCap(tenantId: string): Promise<void> {
    const cap = await this.resolveDailyCap(tenantId);
    const counter = await this.dailyCounter(tenantId);
    const totalTokens =
      Number(counter.inputTokens) + Number(counter.outputTokens);
    if (totalTokens >= cap) {
      counter.capRejectionsCount += 1;
      await this.counterRepo.save(counter);
      throw new ForbiddenException(
        `Copilot daily token cap reached (${cap}). Try again tomorrow or upgrade tier.`,
      );
    }
  }

  private async recordUsage(
    tenantId: string,
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens: number;
      cacheReadTokens: number;
    },
  ): Promise<void> {
    const counter = await this.dailyCounter(tenantId);
    counter.inputTokens =
      Number(counter.inputTokens) + Number(usage.inputTokens);
    counter.outputTokens =
      Number(counter.outputTokens) + Number(usage.outputTokens);
    counter.cacheCreationTokens =
      Number(counter.cacheCreationTokens) + Number(usage.cacheCreationTokens);
    counter.cacheReadTokens =
      Number(counter.cacheReadTokens) + Number(usage.cacheReadTokens);
    counter.turnsCount += 1;
    await this.counterRepo.save(counter);
  }

  private async resolveDailyCap(tenantId: string): Promise<number> {
    // eslint-disable-next-line no-untenanted-query
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) return DEFAULT_DAILY_TOKEN_CAP.base;
    const settings = (tenant.settings as Record<string, unknown> | null) ?? {};
    const aiSettings = settings.aiCopilot as
      | { dailyTokenCap?: number }
      | undefined;
    if (typeof aiSettings?.dailyTokenCap === 'number') {
      return aiSettings.dailyTokenCap;
    }
    return (
      DEFAULT_DAILY_TOKEN_CAP[
        tenant.plan as keyof typeof DEFAULT_DAILY_TOKEN_CAP
      ] ?? DEFAULT_DAILY_TOKEN_CAP.base
    );
  }
}
