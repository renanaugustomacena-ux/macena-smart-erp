import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SsoService } from './sso.service';

interface ScimUser {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  displayName?: string;
  active: boolean;
  emails: Array<{ value: string; primary?: boolean }>;
}

/**
 * SCIM 2.0 controller (plan §31.1 Sprint 22 / S22.3).
 *
 * Implements the SCIM /Users surface that an external IdP (Okta /
 * Azure AD / Google Workspace) expects. Authenticates via an opaque
 * bearer token issued per-tenant (rotated by the tenant admin in the
 * SSO config screen — S22.5). The token-hash comparison runs in
 * constant time.
 *
 * v1 returns synthetic responses for the user lifecycle so the IdP can
 * complete its onboarding handshake; the user-mutation side wires into
 * the existing `users` table in S22 release.
 */
@ApiTags('SCIM 2.0')
@Controller('scim/v2/tenants/:tenantId')
export class ScimController {
  constructor(private readonly ssoSvc: SsoService) {}

  @Get('Users')
  async listUsers(
    @Param('tenantId') tenantId: string,
    @Headers('authorization') auth: string | undefined,
    @Query('startIndex') startIndex = '1',
    @Query('count') count = '100',
  ) {
    await this.assertBearer(tenantId, auth);
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 0,
      startIndex: Number(startIndex),
      itemsPerPage: Number(count),
      Resources: [],
    };
  }

  @Post('Users')
  async createUser(
    @Param('tenantId') tenantId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: ScimUser,
    @Req() req: { ip?: string },
  ) {
    await this.assertBearer(tenantId, auth);
    void req;
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: body.userName,
      userName: body.userName,
      active: body.active ?? true,
      emails: body.emails ?? [],
      meta: {
        resourceType: 'User',
        location: `/scim/v2/tenants/${tenantId}/Users/${body.userName}`,
      },
    };
  }

  @Put('Users/:userId')
  async replaceUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: ScimUser,
  ) {
    await this.assertBearer(tenantId, auth);
    return {
      ...body,
      id: userId,
    };
  }

  @Delete('Users/:userId')
  async deleteUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Headers('authorization') auth: string | undefined,
  ) {
    await this.assertBearer(tenantId, auth);
    void userId;
    return { ok: true };
  }

  @Get('ServiceProviderConfig')
  serviceProviderConfig(@Param('tenantId') tenantId: string) {
    void tenantId;
    return {
      schemas: [
        'urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig',
      ],
      patch: { supported: false },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          name: 'OAuth Bearer Token',
          description: 'Opaque per-tenant bearer token rotated via the SSO config screen.',
          specUri: 'https://datatracker.ietf.org/doc/html/rfc6750',
          type: 'oauthbearertoken',
          primary: true,
        },
      ],
    };
  }

  private async assertBearer(
    tenantId: string,
    auth: string | undefined,
  ): Promise<void> {
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = auth.slice(7).trim();
    const ok = await this.ssoSvc.verifyScimToken(tenantId, token);
    if (!ok) {
      throw new UnauthorizedException('Invalid SCIM bearer token');
    }
  }
}
