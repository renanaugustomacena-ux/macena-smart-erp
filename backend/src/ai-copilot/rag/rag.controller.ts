import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../../auth/guards/tenant-scope.guard';
import { RagService } from './rag.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('AI Copilot — RAG')
@ApiBearerAuth('JWT-auth')
@Controller('ai-copilot/rag')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Post('ingest')
  @ApiOperation({ summary: 'Run a full ingest pass for the calling tenant.' })
  ingest(@Req() req: RequestWithUser) {
    return this.rag.ingestAll(req.user.tenantId);
  }

  @Get('retrieve')
  @ApiOperation({
    summary: 'Tenant-scoped retrieval by substring (pgvector ANN lands in M-026).',
  })
  retrieve(
    @Req() req: RequestWithUser,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.rag.retrieve(req.user.tenantId, q ?? '', limit ? Number(limit) : 10);
  }
}
