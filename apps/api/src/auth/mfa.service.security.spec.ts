import { ForbiddenException, HttpException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './decorators/current-user.decorator';
import { encryptSecret, generateBase32Secret, generateTotp } from './mfa.crypto';
import { MFA_CHALLENGE_MAX_ATTEMPTS, MFA_STEP_UP_TTL_SECONDS } from './mfa.policy';
import { MfaService } from './mfa.service';

describe('MfaService privileged session and challenge boundaries', () => {
  const actor: AuthenticatedUser = {
    sub: 'finance-1', email: 'finance@example.test', organizationId: 'org-a',
    roles: [UserRole.FINANCE_MANAGER], sessionId: 'session-a',
  };
  const prisma = {
    mfaEnrollment: { findUnique: jest.fn(), updateMany: jest.fn() },
    refreshSession: { findUnique: jest.fn(), updateMany: jest.fn() },
    mfaChallenge: { findUnique: jest.fn(), count: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    auditEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const auth = { verifyCurrentPassword: jest.fn(), me: jest.fn() };
  const service = new MfaService(
    prisma as unknown as PrismaService,
    auth as unknown as AuthService,
  );
  let secret: string;
  let priorKey: string | undefined;

  const session = () => ({
    userId: actor.sub, revokedAt: null, expiresAt: new Date(Date.now() + 600_000),
    mfaVerifiedAt: new Date(),
  });
  const challenge = () => ({
    id: 'challenge-1', userId: actor.sub, sessionId: actor.sessionId,
    consumedAt: null, expiresAt: new Date(Date.now() + 120_000), attempts: 0,
  });

  beforeAll(() => {
    priorKey = process.env.MFA_ENCRYPTION_KEY;
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64url');
    secret = generateBase32Secret();
  });
  afterAll(() => {
    if (priorKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = priorKey;
  });
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.mfaEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-a', enabled: true, version: 1, secretCiphertext: encryptSecret(secret),
    });
    prisma.refreshSession.findUnique.mockResolvedValue(session());
    prisma.mfaChallenge.findUnique.mockResolvedValue(challenge());
    prisma.mfaChallenge.count.mockResolvedValue(0);
    prisma.mfaChallenge.updateMany.mockResolvedValue({ count: 1 });
    prisma.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
    prisma.$transaction.mockImplementation(async (callback: (tx: {
      mfaChallenge: { updateMany: typeof prisma.mfaChallenge.updateMany; create: typeof prisma.mfaChallenge.create };
      mfaEnrollment: { updateMany: typeof prisma.mfaEnrollment.updateMany };
      refreshSession: { updateMany: typeof prisma.refreshSession.updateMany };
      auditEvent: { create: typeof prisma.auditEvent.create };
    }) => Promise<unknown>) => callback({
      mfaChallenge: prisma.mfaChallenge, mfaEnrollment: prisma.mfaEnrollment,
      refreshSession: prisma.refreshSession, auditEvent: prisma.auditEvent,
    }));
  });

  it('does not demand step-up from a non-privileged read actor', async () => {
    await expect(service.assertStepUp({ ...actor, roles: [UserRole.ADVERTISER] }))
      .resolves.toBeUndefined();
    expect(prisma.mfaEnrollment.findUnique).not.toHaveBeenCalled();
    expect(prisma.refreshSession.findUnique).not.toHaveBeenCalled();
  });

  it('denies privileged mutations when MFA is not enrolled', async () => {
    prisma.mfaEnrollment.findUnique.mockResolvedValue({ enabled: false });
    await expect(service.assertStepUp(actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies step-up from another user session even if MFA is enabled', async () => {
    prisma.refreshSession.findUnique.mockResolvedValue({ ...session(), userId: 'other-user' });
    await expect(service.assertStepUp(actor)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('denies revoked and expired sessions', async () => {
    prisma.refreshSession.findUnique.mockResolvedValueOnce({ ...session(), revokedAt: new Date() });
    await expect(service.assertStepUp(actor)).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.refreshSession.findUnique.mockResolvedValueOnce({ ...session(), expiresAt: new Date(Date.now() - 1000) });
    await expect(service.assertStepUp(actor)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects stale or absent verification and allows fresh step-up within the policy TTL', async () => {
    prisma.refreshSession.findUnique.mockResolvedValueOnce({ ...session(), mfaVerifiedAt: null });
    await expect(service.assertStepUp(actor)).rejects.toBeInstanceOf(ForbiddenException);
    prisma.refreshSession.findUnique.mockResolvedValueOnce({
      ...session(), mfaVerifiedAt: new Date(Date.now() - (MFA_STEP_UP_TTL_SECONDS + 1) * 1000),
    });
    await expect(service.assertStepUp(actor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertStepUp(actor)).resolves.toBeUndefined();
  });

  it('rate-limits challenge issuance before inserting another challenge or audit', async () => {
    prisma.mfaChallenge.count.mockResolvedValue(MFA_CHALLENGE_MAX_ATTEMPTS);
    await expect(service.createChallenge(actor, {})).rejects.toBeInstanceOf(HttpException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.mfaChallenge.create).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('rejects a cross-session challenge without attempting verification or mutation', async () => {
    prisma.mfaChallenge.findUnique.mockResolvedValue({ ...challenge(), sessionId: 'foreign-session' });
    await expect(service.verifyChallenge(actor, 'challenge-1', '000000', {}))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.mfaChallenge.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bounds invalid OTP attempts and audits only a successful conditional attempt increment', async () => {
    await expect(service.verifyChallenge(actor, 'challenge-1', 'not-a-code', {}))
      .rejects.toThrow('Invalid MFA code.');
    expect(prisma.mfaChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'challenge-1', consumedAt: null, attempts: { lt: MFA_CHALLENGE_MAX_ATTEMPTS },
      }),
      data: { attempts: { increment: 1 } },
    }));
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'AUTH_MFA_STEP_UP_FAILED', severity: 'WARNING' }),
    }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('never step-up verifies a session when another request consumes its challenge first', async () => {
    prisma.mfaChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.verifyChallenge(actor, 'challenge-1', generateTotp(secret), {}))
      .rejects.toThrow('MFA challenge has already been used.');
    expect(prisma.mfaChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'challenge-1', sessionId: actor.sessionId, consumedAt: null }),
    }));
    expect(prisma.mfaEnrollment.updateMany).not.toHaveBeenCalled();
    expect(prisma.refreshSession.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('rejects replay of an already consumed challenge without touching the database state', async () => {
    prisma.mfaChallenge.findUnique.mockResolvedValue({ ...challenge(), consumedAt: new Date() });
    await expect(service.verifyChallenge(actor, 'challenge-1', generateTotp(secret), {}))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.mfaChallenge.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
