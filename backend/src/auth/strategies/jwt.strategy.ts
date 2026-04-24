import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * JWT authentication strategy used by every `@UseGuards(AuthGuard('jwt'))`
 * decorator across the controller surface.
 *
 * The access token payload (claims) carries:
 *   - sub        UUID of the user (subject)
 *   - email      user email
 *   - role       RBAC role (admin | manager | operator | viewer)
 *   - tenantId   UUID of the tenant the user belongs to (multi-tenancy key)
 *
 * The strategy maps the validated JWT payload to `req.user`, so controllers
 * can safely read `req.user.tenantId` and pass it through to services for
 * tenant-scoped queries. Tenant scoping is enforced by `TenantScopeGuard`
 * (see ../guards/tenant-scope.guard.ts).
 */
export interface JwtUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret || secret.length < 16) {
      throw new Error(
        'JWT_SECRET missing or too short. Set a cryptographically strong ' +
          'secret (>= 32 bytes base64) in your environment.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      issuer: 'smarterp',
      audience: 'smarterp-client',
      algorithms: ['HS256'],
    });
  }

  async validate(payload: {
    sub?: string;
    email?: string;
    role?: string;
    tenantId?: string;
  }): Promise<JwtUser> {
    if (!payload?.sub || !payload?.tenantId) {
      throw new UnauthorizedException('Token missing sub or tenantId claim');
    }
    return {
      id: payload.sub,
      email: payload.email ?? '',
      role: payload.role ?? 'viewer',
      tenantId: payload.tenantId,
    };
  }
}
