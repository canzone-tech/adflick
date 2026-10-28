import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './decorators/current-user.decorator';

describe('AuthService security and session rotation', () => {
  const password = 'correct-test-password-123';
  const actor: AuthenticatedUser = {
    sub: 'user-1', email: 'user@example.test', organizationId: 'org-1',
    roles: [UserRole.ORGANIZATION_ADMIN], sessionId: 'session-1',
  };
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    refreshSession: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    auditEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const jwt = { signAsync: jest.fn() };
  const service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService);
  let passwordHash: string;

  const activeUser = () => ({
    id: actor.sub, email: actor.email, displayName: 'Test user',
    passwordHash, status: 'ACTIVE', organizationId: actor.organizationId,
    roleAssignments: [{ role: UserRole.ORGANIZATION_ADMIN }],
  });
  const currentRefresh = () => ({
    id: actor.sessionId, userId: actor.sub, revokedAt: null,
    expiresAt: new Date(Date.now() + 600_000),
    user: activeUser(),
  });

  beforeAll(async () => {
    passwordHash = await argon2.hash(password, {
      type: argon2.argon2id, memoryCost: 4096, timeCost: 2, parallelism: 1,
    });
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue(activeUser());
    prisma.refreshSession.create.mockResolvedValue({
      id: actor.sessionId, expiresAt: new Date(Date.now() + 600_000),
    });
    prisma.refreshSession.findUnique.mockResolvedValue(currentRefresh());
    prisma.refreshSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
    jwt.signAsync.mockResolvedValue('signed-access-token');
    prisma.$transaction.mockImplementation(async (callback: (tx: {
      refreshSession: { updateMany: typeof prisma.refreshSession.updateMany; create: typeof prisma.refreshSession.create };
    }) => Promise<unknown>) => callback({ refreshSession: prisma.refreshSession }));
  });

  it('rejects unknown, disabled and passwordless accounts without creating sessions or auditing success', async () => {
    for (const record of [null, { ...activeUser(), status: 'SUSPENDED' }, { ...activeUser(), passwordHash: null }]) {
      prisma.user.findUnique.mockResolvedValueOnce(record);
      await expect(service.login('user@example.test', password, {}))
        .rejects.toThrow('Invalid email or password.');
    }
    expect(prisma.refreshSession.create).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('uses the same public error for an incorrect password', async () => {
    await expect(service.login('user@example.test', 'invalid-password', {}))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshSession.create).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('normalizes identity, persists only a hashed refresh token and scopes the success audit', async () => {
    const result = await service.login('  USER@EXAMPLE.TEST ', password, {
      ipAddress: '1'.repeat(70), userAgent: 'a'.repeat(600),
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'user@example.test' },
    }));
    const input = prisma.refreshSession.create.mock.calls[0][0].data;
    expect(input.tokenHash).toBe(createHash('sha256').update(result.refreshToken).digest('hex'));
    expect(input.tokenHash).not.toBe(result.refreshToken);
    expect(input.userAgent).toHaveLength(512);
    expect(input.ipAddress).toHaveLength(45);
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({
      sub: actor.sub, sid: actor.sessionId, organizationId: 'org-1',
      roles: [UserRole.ORGANIZATION_ADMIN], typ: 'access',
    }), expect.objectContaining({ expiresIn: expect.any(Number) }));
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-1', action: 'AUTH_LOGIN_SUCCESS' }),
    }));
  });

  it('rejects empty and oversized refresh tokens before database access', async () => {
    await expect(service.refresh('', {})).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh('x'.repeat(257), {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshSession.findUnique).not.toHaveBeenCalled();
  });

  it('rejects revoked, expired and disabled refresh sessions without issuing tokens', async () => {
    const stale = [
      { ...currentRefresh(), revokedAt: new Date() },
      { ...currentRefresh(), expiresAt: new Date(Date.now() - 1000) },
      { ...currentRefresh(), user: { ...activeUser(), status: 'SUSPENDED' } },
    ];
    for (const record of stale) {
      prisma.refreshSession.findUnique.mockResolvedValueOnce(record);
      await expect(service.refresh('raw-token', {})).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('atomically rotates a refresh token and binds the new access JWT to its new session', async () => {
    const result = await service.refresh('old-refresh-token', { ipAddress: '127.0.0.1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const mutation = prisma.refreshSession.updateMany.mock.calls[0][0];
    const created = prisma.refreshSession.create.mock.calls[0][0].data;
    expect(mutation.where).toMatchObject({
      id: actor.sessionId, revokedAt: null, expiresAt: { gt: expect.any(Date) },
    });
    expect(created.id).toBe(mutation.data.replacedById);
    expect(created.userId).toBe(actor.sub);
    expect(created.tokenHash).toBe(createHash('sha256').update(result.refreshToken).digest('hex'));
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({
      sid: created.id, typ: 'access', organizationId: 'org-1',
    }), expect.any(Object));
  });

  it('fails a concurrent rotation when its conditional write loses the race', async () => {
    prisma.refreshSession.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refresh('stale-refresh-token', {}))
      .rejects.toThrow('Refresh token has already been used.');
    expect(prisma.refreshSession.create).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('revokes the supplied and authenticated sessions within their scoped predicates', async () => {
    await expect(service.logout('raw-refresh', actor, { ipAddress: '127.0.0.1' }))
      .resolves.toEqual({ success: true });
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.refreshSession.updateMany).toHaveBeenNthCalledWith(1, {
      where: { tokenHash: createHash('sha256').update('raw-refresh').digest('hex'), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshSession.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: actor.sessionId, userId: actor.sub, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'AUTH_LOGOUT', actorUserId: actor.sub }),
    }));
  });

  it('rejects invalid new-password lengths before any account write', async () => {
    for (const invalid of ['short', 'x'.repeat(129)]) {
      await expect(service.changePassword(actor, password, invalid)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
