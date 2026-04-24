import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'smarterp.roles';

/**
 * @Roles(UserRole.ADMIN, UserRole.MANAGER)
 * Decorator to tag a controller or handler with the minimum RBAC roles
 * required. The `RolesGuard` reads these tags via Reflector and rejects
 * requests whose JWT `role` claim is not listed.
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{
      user?: { role?: string };
    }>();

    if (!user?.role) {
      throw new ForbiddenException('Role claim missing from token');
    }

    if (!required.includes(user.role)) {
      throw new ForbiddenException(
        `Insufficient role: need one of [${required.join(', ')}], have ${user.role}`,
      );
    }
    return true;
  }
}
