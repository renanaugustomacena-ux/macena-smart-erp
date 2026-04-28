import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { CopilotService } from './copilot.service';
import { CopilotEvalHarness } from './eval.harness';
import { ToolRegistry } from './tool-registry.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('AI Copilot')
@ApiBearerAuth('JWT-auth')
@Controller('ai-copilot')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class CopilotController {
  constructor(
    private readonly copilot: CopilotService,
    private readonly registry: ToolRegistry,
    private readonly evals: CopilotEvalHarness,
  ) {}

  @Post('ask')
  @ApiOperation({
    summary:
      'Ask the AI Copilot a question (synthetic responses until ENABLE_ANTHROPIC_LIVE=true in Sprint 27).',
  })
  ask(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      message: string;
      persona?: 'sara' | 'marco' | 'luca' | 'giulia' | 'andrea';
    },
  ) {
    return this.copilot.ask(
      req.user.tenantId,
      body.message,
      body.persona ?? 'sara',
    );
  }

  @Get('tools')
  @ApiOperation({ summary: 'List Copilot tools (filterable by persona).' })
  listTools(
    @Query('persona')
    persona?: 'sara' | 'marco' | 'luca' | 'giulia' | 'andrea',
  ) {
    return persona
      ? this.registry.forPersona(persona).map((t) => t.definition)
      : this.registry.list().map((t) => t.definition);
  }

  @Get('cost/today')
  @ApiOperation({ summary: 'Today\'s per-tenant Copilot token usage counter.' })
  todayUsage(@Req() req: RequestWithUser) {
    return this.copilot.dailyCounter(req.user.tenantId);
  }

  @Post('eval/run')
  @ApiOperation({ summary: 'Run the Copilot eval harness for the calling tenant.' })
  runEvals(@Req() req: RequestWithUser) {
    return this.evals.run(req.user.tenantId);
  }
}
