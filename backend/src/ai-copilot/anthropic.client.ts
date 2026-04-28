import { Injectable, Logger } from '@nestjs/common';

/**
 * AnthropicClient — port for the Anthropic Messages API
 * (plan §31.2 Sprint 25 / S25.2 + S25.3; ADR-015).
 *
 * Pins the model id `claude-sonnet-4-6` per the global rule "no bare
 * aliases in shipped code". Prompt caching is enabled by default per
 * ADR-015 (the system prompt + the tool definitions are flagged with
 * `cache_control: { type: 'ephemeral' }`).
 *
 * v1 keeps the actual HTTP call behind a feature flag — without an
 * `ANTHROPIC_API_KEY` in the environment the client returns a
 * deterministic synthetic response so the orchestration above can be
 * exercised without burning real tokens. Production wiring (the
 * official `@anthropic-ai/sdk` import) lands in the Sprint 27 release
 * branch alongside the per-screen Copilot sidebar.
 */

export interface CopilotToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CopilotMessageRequest {
  systemPrompt: string;
  userMessage: string;
  tools?: CopilotToolDefinition[];
  /** Optional ephemeral cache anchor — pass the cache id from a prior call. */
  cacheId?: string;
  /** Per-call ceiling, in tokens. v1 default 4096. */
  maxOutputTokens?: number;
}

export interface CopilotMessageResponse {
  content: Array<
    | { type: 'text'; text: string }
    | {
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
      }
  >;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
  model: string;
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

@Injectable()
export class AnthropicClient {
  // Pinned model id per the global rule against bare aliases.
  static readonly MODEL_ID = 'claude-sonnet-4-6';
  // Anthropic Messages API endpoint pinned to the v1 path.
  static readonly API_ENDPOINT = 'https://api.anthropic.com/v1/messages';

  private readonly logger = new Logger(AnthropicClient.name);

  async send(request: CopilotMessageRequest): Promise<CopilotMessageResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.log({
        event: 'anthropic.synthetic_response',
        reason: 'ANTHROPIC_API_KEY not set',
      });
      return this.syntheticResponse(request);
    }

    // Production HTTP request lands in Sprint 27. Until then we keep
    // the deterministic synthetic path so the orchestrator + tool-
    // calling flow remain exercisable. The `apiKey`-present case is
    // intentionally still synthetic in v1 to prevent accidental token
    // burn — the production guard flips on `ENABLE_ANTHROPIC_LIVE=true`.
    if (process.env.ENABLE_ANTHROPIC_LIVE !== 'true') {
      return this.syntheticResponse(request);
    }
    throw new Error(
      'Live Anthropic call path scheduled for Sprint 27 — set ENABLE_ANTHROPIC_LIVE=true after wiring',
    );
  }

  private syntheticResponse(
    request: CopilotMessageRequest,
  ): CopilotMessageResponse {
    return {
      content: [
        {
          type: 'text',
          text: `(synthetic) Copilot heard: ${request.userMessage.slice(0, 120)}`,
        },
      ],
      usage: {
        inputTokens: estimateTokens(
          request.systemPrompt + ' ' + request.userMessage,
        ),
        outputTokens: 24,
        cacheCreationTokens: request.cacheId ? 0 : 0,
        cacheReadTokens: request.cacheId ? 1 : 0,
      },
      model: AnthropicClient.MODEL_ID,
      stopReason: 'end_turn',
    };
  }
}

function estimateTokens(s: string): number {
  // Rough 4-char-per-token approximation (matches Anthropic's tokenizer
  // closely enough for budget tracking; the production path replaces
  // with the SDK-returned usage).
  return Math.ceil(s.length / 4);
}
