import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function contextFor(user?: { roles?: string[] }) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard authorization contract', () => {
  function guard(required: UserRole[] | undefined) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return { instance: new RolesGuard(reflector), reflector };
  }

  it('allows a user when at least one required role matches', () => {
    const { instance } = guard([UserRole.FINANCE_MANAGER, UserRole.ORGANIZATION_ADMIN]);
    expect(instance.canActivate(contextFor({ roles: [UserRole.ORGANIZATION_ADMIN] }))).toBe(true);
  });

  it('rejects a user whose role is not explicitly allowed', () => {
    const { instance } = guard([UserRole.FINANCE_MANAGER]);
    expect(() => instance.canActivate(contextFor({ roles: [UserRole.ADVERTISER] })))
      .toThrow(ForbiddenException);
  });

  it('fails closed when the request has no authenticated user', () => {
    const { instance } = guard([UserRole.ORGANIZATION_ADMIN]);
    expect(() => instance.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });

  it('preserves public-by-role behavior when no role metadata is declared', () => {
    const { instance } = guard(undefined);
    expect(instance.canActivate(contextFor(undefined))).toBe(true);
  });

  it('reads required role metadata from handler and controller in priority order', () => {
    const { instance, reflector } = guard([UserRole.AUDITOR_COMPLIANCE]);
    instance.canActivate(contextFor({ roles: [UserRole.AUDITOR_COMPLIANCE] }));
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, ['handler', 'controller']);
  });
});
