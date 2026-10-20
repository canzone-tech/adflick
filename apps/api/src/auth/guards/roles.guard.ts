import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { MfaService } from '../mfa.service';
import { hasPrivilegedRole } from '../mfa.policy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly mfa: MfaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser; method?: string }>();
    const actor = request.user;
    const roles = actor?.roles ?? [];
    const allowed = required.some((role) => roles.includes(role));
    if (!allowed) throw new ForbiddenException('Your account does not have permission for this action.');

    if (actor && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method ?? '') && hasPrivilegedRole(roles)) {
      await this.mfa.assertStepUp(actor);
    }
    return true;
  }
}
