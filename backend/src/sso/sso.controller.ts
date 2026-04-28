import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { SsoService } from './sso.service';
import { SamlStrategy } from './saml.strategy';
import { SsoProtocol } from './entities/sso-config.entity';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('SSO')
@ApiBearerAuth('JWT-auth')
@Controller('sso')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class SsoController {
  constructor(
    private readonly svc: SsoService,
    private readonly saml: SamlStrategy,
  ) {}

  @Get('configs')
  list(@Req() req: RequestWithUser) {
    return this.svc.list(req.user.tenantId);
  }

  @Put('saml')
  @ApiOperation({ summary: 'Upsert the SAML 2.0 config for the tenant (S22.5).' })
  upsertSaml(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      idpEntityId?: string;
      idpSsoUrl?: string;
      idpX509Cert?: string;
      attributeMappingEmail?: string;
      attributeMappingName?: string;
      defaultRole?: string;
    },
  ) {
    return this.svc.upsert(req.user.tenantId, 'saml2', body);
  }

  @Put('scim')
  @ApiOperation({ summary: 'Upsert the SCIM 2.0 config (status flips to active on first token rotation).' })
  upsertScim(@Req() req: RequestWithUser, @Body() body: { defaultRole?: string }) {
    return this.svc.upsert(req.user.tenantId, 'scim2', body);
  }

  @Post(':protocol/activate')
  activate(
    @Req() req: RequestWithUser,
    @Param('protocol') protocol: SsoProtocol,
  ) {
    return this.svc.activate(req.user.tenantId, protocol);
  }

  @Post(':protocol/pause')
  pause(
    @Req() req: RequestWithUser,
    @Param('protocol') protocol: SsoProtocol,
  ) {
    return this.svc.pause(req.user.tenantId, protocol);
  }

  @Post('scim/rotate-token')
  @ApiOperation({
    summary:
      'Rotate the per-tenant SCIM bearer token. Plaintext returned once.',
  })
  rotateScimToken(@Req() req: RequestWithUser) {
    return this.svc.rotateScimToken(req.user.tenantId);
  }

  @Post('break-glass')
  @ApiOperation({
    summary: 'Set the break-glass admin email (S22.6). Rotated monthly per Compliance runbook.',
  })
  setBreakGlass(
    @Req() req: RequestWithUser,
    @Body() body: { email: string },
  ) {
    return this.svc.setBreakGlass(req.user.tenantId, body.email);
  }

  @Post('saml/:tenantId/acs')
  @ApiOperation({
    summary:
      'SAML Assertion Consumer Service (POST endpoint the IdP redirects to).',
  })
  async samlAcs(
    @Param('tenantId') tenantId: string,
    @Body() body: { SAMLResponse: string },
  ) {
    const assertion = await this.saml.validateAssertion(
      tenantId,
      body.SAMLResponse,
    );
    // Token mint + JIT user provisioning lives behind the AuthService;
    // returning the validated assertion here keeps the controller
    // testable and the auth integration layered.
    return { ok: true, assertion };
  }
}
