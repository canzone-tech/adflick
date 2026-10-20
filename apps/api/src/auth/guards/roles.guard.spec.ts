import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextFor(request: Record<string, unknown>) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('RolesGuard privileged MFA boundary', () => {
  it('fails closed when a privileged mutation has no MFA step-up', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.ORGANIZATION_ADMIN]) } as unknown as Reflector;
    const mfa = { assertStepUp: jest.fn().mockRejectedValue(new Error('MFA required')) };
    const guard = new RolesGuard(reflector, mfa as never);
    await expect(guard.canActivate(contextFor({ method: 'POST', user: { sub: 'u1', roles: [UserRole.ORGANIZATION_ADMIN] } }))).rejects.toThrow('MFA required');
    expect(mfa.assertStepUp).toHaveBeenCalledTimes(1);
  });

  it('does not require step-up for privileged reads', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.ORGANIZATION_ADMIN]) } as unknown as Reflector;
    const mfa = { assertStepUp: jest.fn() };
    const guard = new RolesGuard(reflector, mfa as never);
    await expect(guard.canActivate(contextFor({ method: 'GET', user: { sub: 'u1', roles: [UserRole.ORGANIZATION_ADMIN] } }))).resolves.toBe(true);
    expect(mfa.assertStepUp).not.toHaveBeenCalled();
  });

  it('does not require privileged MFA for non-privileged roles', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADVERTISER]) } as unknown as Reflector;
    const mfa = { assertStepUp: jest.fn() };
    const guard = new RolesGuard(reflector, mfa as never);
    await expect(guard.canActivate(contextFor({ method: 'POST', user: { sub: 'u1', roles: [UserRole.ADVERTISER] } }))).resolves.toBe(true);
    expect(mfa.assertStepUp).not.toHaveBeenCalled();
  });
});
