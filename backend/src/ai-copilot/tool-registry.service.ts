import { Injectable, NotFoundException } from '@nestjs/common';
import { CopilotToolDefinition } from './anthropic.client';

/**
 * CopilotTool — every Copilot tool implements this contract.
 *
 * Tools execute server-side after the model emits a `tool_use`
 * response. The result is sent back to the model in the next
 * iteration of the conversation.
 */
export interface CopilotTool {
  readonly definition: CopilotToolDefinition;
  /** Persona that the tool primarily serves (drives default tool sets). */
  readonly persona: 'sara' | 'marco' | 'luca' | 'giulia' | 'andrea';
  execute(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
}

/**
 * ToolRegistry — central catalogue of every Copilot tool
 * (plan §31.2 Sprint 25 / S25.4).
 *
 * v1 ships 10 tools targeting Sara (the admin/contabilità persona).
 * Subsequent sprints add Marco / Luca / Giulia / Andrea persona sets.
 */
@Injectable()
export class ToolRegistry {
  private readonly map = new Map<string, CopilotTool>();

  constructor(tools: CopilotTool[]) {
    for (const t of tools) {
      if (this.map.has(t.definition.name)) {
        throw new Error(`Duplicate Copilot tool '${t.definition.name}'`);
      }
      this.map.set(t.definition.name, t);
    }
  }

  get(name: string): CopilotTool {
    const t = this.map.get(name);
    if (!t) throw new NotFoundException(`Copilot tool '${name}' not found`);
    return t;
  }

  list(): CopilotTool[] {
    return Array.from(this.map.values());
  }

  forPersona(
    persona: 'sara' | 'marco' | 'luca' | 'giulia' | 'andrea',
  ): CopilotTool[] {
    return this.list().filter((t) => t.persona === persona);
  }
}
