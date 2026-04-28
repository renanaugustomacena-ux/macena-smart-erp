import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { MembershipsService } from './memberships.service';
import {
  InviteMembershipDto,
  ListTenantMembershipsQueryDto,
  SwitchTenantDto,
} from './memberships.dto';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('Memberships')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(AuthGuard('jwt'))
export class MembershipsController {
  constructor(private readonly svc: MembershipsService) {}

  // ─── Subject-side endpoints (no tenant guard) ────────────────

  @Get('memberships/me')
  @ApiOperation({
    summary: 'List memberships for the calling user (across all tenants)',
  })
  async listMine(@Req() req: RequestWithUser) {
    return this.svc.listMine(req.user.id);
  }

  @Post('memberships/switch')
  @ApiOperation({
    summary:
      'Switch active tenant — re-mint JWT for the requested tenant if the user has an active membership (S16.3, plan §3.1.6)',
  })
  async switchTenant(
    @Req() req: RequestWithUser,
    @Body() dto: SwitchTenantDto,
  ) {
    return this.svc.switchTenant(req.user.id, dto.tenantId);
  }

  @Post('memberships/:id/consent')
  @ApiOperation({ summary: 'Subject consents to a pending membership' })
  async consent(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.consent(id, req.user.id);
  }

  @Delete('memberships/:id')
  @ApiOperation({
    summary:
      'Revoke a membership — subject revokes own membership, or tenant admin revokes membership into their tenant',
  })
  async revoke(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.revoke(
      id,
      req.user.id,
      // The JWT carries the active tenant role; cast through the
      // service-side wider union.
      req.user.role as 'admin' | 'manager' | 'operator' | 'viewer' | 'commercialista',
      req.user.tenantId,
    );
  }

  // ─── Tenant-side endpoints (tenant-scope guarded) ────────────

  @Get('tenants/:tenantId/memberships')
  @ApiOperation({
    summary:
      'List memberships into the current tenant (tenant admin / commercialista cockpit owner)',
  })
  @UseGuards(TenantScopeGuard)
  async listForTenant(
    @Req() req: RequestWithUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query() query: ListTenantMembershipsQueryDto,
  ) {
    void req;
    return this.svc.listForTenant(tenantId, query);
  }

  @Post('tenants/:tenantId/memberships')
  @ApiOperation({
    summary:
      'Invite a user to the current tenant with a per-tenant role (e.g., commercialista)',
  })
  @UseGuards(TenantScopeGuard)
  async invite(
    @Req() req: RequestWithUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: InviteMembershipDto,
  ) {
    return this.svc.invite(tenantId, req.user.id, dto.userId, dto.role);
  }
}
