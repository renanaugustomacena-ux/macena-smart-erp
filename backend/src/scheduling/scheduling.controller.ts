import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import {
  SchedulingJob,
  SchedulingResource,
  SchedulingService,
} from './scheduling.service';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Production Scheduling')
@ApiBearerAuth('JWT-auth')
@Controller('scheduling')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class SchedulingController {
  constructor(private readonly svc: SchedulingService) {}

  @Post('plan')
  @ApiOperation({
    summary:
      'Compute a production schedule (v1: greedy first-fit; CP-SAT sidecar lands in Sprint 30).',
  })
  plan(
    @Req() req: RequestWithUser,
    @Body() body: { jobs: SchedulingJob[]; resources: SchedulingResource[] },
  ) {
    void req;
    return this.svc.schedule(body.jobs ?? [], body.resources ?? []);
  }
}
