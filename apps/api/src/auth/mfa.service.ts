import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildOtpAuthUri,
  decryptSecret,
  encryptSecret,
  generateBase32Secret,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotp,
} from './mfa.crypto';
import {
  hasPrivilegedRole,
  MFA_CHALLENGE_MAX_ATTEMPTS,
  MFA_CHALLENGE_TTL_SECONDS,
  MFA_ENROLLMENT_TTL_SECONDS,
  MFA_RECOVERY_CODE_COUNT,
  MFA_STEP_UP_TTL_SECONDS,
} from './mfa.policy';

export type MfaStatus = {
  enabled: boolean;
  enrollmentPending: boolean;
  privileged: boolean;
  stepUpVerifiedUntil: string | null;
};

type RequestMeta = { ipAddress?: string };

@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

  private async audit(actor: AuthenticatedUser, action: string, meta: RequestMeta, severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO', metadataJson?: Prisma.InputJsonValue): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: actor.sub,
        organizationId: actor.organizationId,
        action,
        entityType: 'UserMfa',
        entityId: actor.sub,
        severity,
        ...(metadataJson === undefined ? {} : { metadataJson }),
        ipAddress: meta.ipAddress?.slice(0, 45),
      },
    });
  }

  async status(actor: AuthenticatedUser): Promise<MfaStatus> {
    const [enrollment, session] = await Promise.all([
      this.prisma.mfaEnrollment.findUnique({ where: { userId: actor.sub }, select: { enabled: true, enrollmentExpiresAt: true } }),
      this.prisma.refreshSession.findUnique({ where: { id: actor.sessionId }, select: { mfaVerifiedAt: true, revokedAt: true, expiresAt: true } }),
    ]);
    const now = Date.now();
    const stepUpVerifiedUntil = session?.mfaVerifiedAt && !session.revokedAt && session.expiresAt.getTime() > now
      ? new Date(Math.min(session.expiresAt.getTime(), session.mfaVerifiedAt.getTime() + MFA_STEP_UP_TTL_SECONDS * 1000)).toISOString()
      : null;
    return {
      enabled: enrollment?.enabled ?? false,
      enrollmentPending: Boolean(enrollment && !enrollment.enabled && enrollment.enrollmentExpiresAt && enrollment.enrollmentExpiresAt.getTime() > now),
      privileged: hasPrivilegedRole(actor.roles),
      stepUpVerifiedUntil: stepUpVerifiedUntil && new Date(stepUpVerifiedUntil).getTime() > now ? stepUpVerifiedUntil : null,
    };
  }

  async enroll(actor: AuthenticatedUser, currentPassword: string, meta: RequestMeta) {
    await this.auth.verifyCurrentPassword(actor.sub, currentPassword);
    const existing = await this.prisma.mfaEnrollment.findUnique({ where: { userId: actor.sub }, select: { enabled: true } });
    if (existing?.enabled) throw new BadRequestException('MFA is already enabled. Use rotation instead.');
    const secret = generateBase32Secret();
    const recoveryCodes = generateRecoveryCodes(MFA_RECOVERY_CODE_COUNT);
    const now = new Date();
    const enrollmentExpiresAt = new Date(now.getTime() + MFA_ENROLLMENT_TTL_SECONDS * 1000);
    await this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.mfaEnrollment.upsert({
        where: { userId: actor.sub },
        create: { userId: actor.sub, secretCiphertext: encryptSecret(secret), enabled: false, enrollmentExpiresAt, version: 1 },
        update: { secretCiphertext: encryptSecret(secret), enabled: false, enrollmentExpiresAt, lastAcceptedStep: null, version: { increment: 1 } },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { enrollmentId: enrollment.id } });
      await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((code) => ({ enrollmentId: enrollment.id, codeHash: hashRecoveryCode(code) })) });
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId: actor.organizationId, action: 'AUTH_MFA_ENROLLMENT_STARTED', entityType: 'UserMfa', entityId: actor.sub, ipAddress: meta.ipAddress?.slice(0, 45) } });
    });
    const identity = await this.auth.me(actor);
    return { enabled: false, secret, otpauthUri: buildOtpAuthUri(identity.email, secret), recoveryCodes, enrollmentExpiresAt, message: 'Store the authenticator secret and recovery codes securely. Recovery codes are shown only once.' };
  }

  async confirmEnrollment(actor: AuthenticatedUser, code: string, meta: RequestMeta) {
    const enrollment = await this.prisma.mfaEnrollment.findUnique({ where: { userId: actor.sub }, select: { id: true, secretCiphertext: true, enabled: true, enrollmentExpiresAt: true, version: true } });
    if (!enrollment || enrollment.enabled) throw new BadRequestException('MFA enrollment is not awaiting confirmation.');
    const now = new Date();
    if (!enrollment.enrollmentExpiresAt || enrollment.enrollmentExpiresAt <= now) throw new BadRequestException('MFA enrollment has expired. Start enrollment again.');
    const verification = verifyTotp(decryptSecret(enrollment.secretCiphertext), code, now.getTime());
    const matchedStepNumber = verification.matchedStep;
    if (!verification.valid || matchedStepNumber === undefined) {
      await this.audit(actor, 'AUTH_MFA_ENROLLMENT_FAILED', meta, 'WARNING');
      throw new UnauthorizedException('Invalid MFA code.');
    }
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.mfaEnrollment.updateMany({ where: { id: enrollment.id, enabled: false, version: enrollment.version }, data: { enabled: true, enrollmentExpiresAt: null, lastAcceptedStep: BigInt(matchedStepNumber), version: { increment: 1 } } });
      if (changed.count !== 1) throw new UnauthorizedException('MFA enrollment changed concurrently. Start again.');
      const sessionChanged = await tx.refreshSession.updateMany({ where: { id: actor.sessionId, userId: actor.sub, revokedAt: null, expiresAt: { gt: now } }, data: { mfaVerifiedAt: now } });
      if (sessionChanged.count !== 1) throw new UnauthorizedException('Session is expired or revoked.');
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId: actor.organizationId, action: 'AUTH_MFA_ENABLED', entityType: 'UserMfa', entityId: actor.sub, ipAddress: meta.ipAddress?.slice(0, 45) } });
    });
    return { success: true, message: 'MFA enabled and this session has been step-up verified.' };
  }

  async createChallenge(actor: AuthenticatedUser, meta: RequestMeta) {
    const enrollment = await this.prisma.mfaEnrollment.findUnique({ where: { userId: actor.sub }, select: { enabled: true } });
    if (!enrollment?.enabled) throw new BadRequestException('Enable MFA before requesting a step-up challenge.');
    const session = await this.prisma.refreshSession.findUnique({ where: { id: actor.sessionId }, select: { userId: true, revokedAt: true, expiresAt: true } });
    const now = new Date();
    if (!session || session.userId !== actor.sub || session.revokedAt || session.expiresAt <= now) throw new UnauthorizedException('Session is expired or revoked.');
    const recentCount = await this.prisma.mfaChallenge.count({ where: { sessionId: actor.sessionId, createdAt: { gt: new Date(now.getTime() - 60_000) } } });
    if (recentCount >= 5) throw new HttpException('Too many MFA challenges. Try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    const challengeId = randomBytes(24).toString('base64url');
    const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_TTL_SECONDS * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.mfaChallenge.create({ data: { id: challengeId, userId: actor.sub, sessionId: actor.sessionId, challengeHash: hashRecoveryCode(challengeId), expiresAt } });
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId: actor.organizationId, action: 'AUTH_MFA_STEP_UP_CHALLENGE_CREATED', entityType: 'MfaChallenge', entityId: challengeId, ipAddress: meta.ipAddress?.slice(0, 45) } });
    });
    return { challengeId, expiresAt };
  }

  async verifyChallenge(actor: AuthenticatedUser, challengeId: string, code: string, meta: RequestMeta) {
    const challenge = await this.prisma.mfaChallenge.findUnique({ where: { id: challengeId }, select: { id: true, userId: true, sessionId: true, expiresAt: true, attempts: true, consumedAt: true } });
    const now = new Date();
    if (!challenge || challenge.userId !== actor.sub || challenge.sessionId !== actor.sessionId || challenge.consumedAt || challenge.expiresAt <= now || challenge.attempts >= MFA_CHALLENGE_MAX_ATTEMPTS) throw new UnauthorizedException('MFA challenge is invalid, expired or already used.');
    const enrollment = await this.prisma.mfaEnrollment.findUnique({ where: { userId: actor.sub }, select: { id: true, secretCiphertext: true, enabled: true, version: true } });
    if (!enrollment?.enabled) throw new UnauthorizedException('MFA is not enabled.');
    const verification = verifyTotp(decryptSecret(enrollment.secretCiphertext), code, now.getTime());
    const matchedStepNumber = verification.matchedStep;
    if (!verification.valid || matchedStepNumber === undefined) {
      const incremented = await this.prisma.mfaChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: MFA_CHALLENGE_MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
      if (incremented.count === 1) await this.audit(actor, 'AUTH_MFA_STEP_UP_FAILED', meta, 'WARNING');
      throw new UnauthorizedException('Invalid MFA code.');
    }
    const matchedStep = BigInt(matchedStepNumber);
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.mfaChallenge.updateMany({ where: { id: challenge.id, userId: actor.sub, sessionId: actor.sessionId, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: MFA_CHALLENGE_MAX_ATTEMPTS } }, data: { consumedAt: now } });
      if (consumed.count !== 1) throw new UnauthorizedException('MFA challenge has already been used.');
      const accepted = await tx.mfaEnrollment.updateMany({ where: { id: enrollment.id, enabled: true, version: enrollment.version, OR: [{ lastAcceptedStep: null }, { lastAcceptedStep: { lt: matchedStep } }] }, data: { lastAcceptedStep: matchedStep, version: { increment: 1 } } });
      if (accepted.count !== 1) throw new UnauthorizedException('MFA code was already used or the enrollment changed.');
      const sessionChanged = await tx.refreshSession.updateMany({ where: { id: actor.sessionId, userId: actor.sub, revokedAt: null, expiresAt: { gt: now } }, data: { mfaVerifiedAt: now } });
      if (sessionChanged.count !== 1) throw new UnauthorizedException('Session is expired or revoked.');
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId: actor.organizationId, action: 'AUTH_MFA_STEP_UP_SUCCESS', entityType: 'MfaChallenge', entityId: challenge.id, ipAddress: meta.ipAddress?.slice(0, 45) } });
    });
    return { success: true, stepUpVerifiedUntil: new Date(now.getTime() + MFA_STEP_UP_TTL_SECONDS * 1000) };
  }

  async rotate(actor: AuthenticatedUser, currentPassword: string, code: string, meta: RequestMeta) {
    await this.auth.verifyCurrentPassword(actor.sub, currentPassword);
    const enrollment = await this.prisma.mfaEnrollment.findUnique({ where: { userId: actor.sub }, select: { id: true, secretCiphertext: true, enabled: true, version: true, lastAcceptedStep: true } });
    if (!enrollment?.enabled) throw new BadRequestException('MFA is not enabled.');
    const now = new Date();
    const verification = verifyTotp(decryptSecret(enrollment.secretCiphertext), code, now.getTime());
    const matchedStepNumber = verification.matchedStep;
    if (!verification.valid || matchedStepNumber === undefined) {
      await this.audit(actor, 'AUTH_MFA_ROTATION_FAILED', meta, 'WARNING');
      throw new UnauthorizedException('Invalid MFA code.');
    }
    const matchedStep = BigInt(matchedStepNumber);
    const secret = generateBase32Secret();
    const recoveryCodes = generateRecoveryCodes(MFA_RECOVERY_CODE_COUNT);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.mfaEnrollment.updateMany({ where: { id: enrollment.id, enabled: true, version: enrollment.version, OR: [{ lastAcceptedStep: null }, { lastAcceptedStep: { lt: matchedStep } }] }, data: { secretCiphertext: encryptSecret(secret), lastAcceptedStep: null, version: { increment: 1 } } });
      if (changed.count !== 1) throw new UnauthorizedException('MFA code was already used or the enrollment changed. Retry with a fresh code.');
      await tx.mfaRecoveryCode.deleteMany({ where: { enrollmentId: enrollment.id } });
      await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((recoveryCode) => ({ enrollmentId: enrollment.id, codeHash: hashRecoveryCode(recoveryCode) })) });
      await tx.refreshSession.updateMany({ where: { userId: actor.sub, id: { not: actor.sessionId }, revokedAt: null }, data: { revokedAt: now } });
      const currentSession = await tx.refreshSession.updateMany({ where: { id: actor.sessionId, userId: actor.sub, revokedAt: null, expiresAt: { gt: now } }, data: { mfaVerifiedAt: now } });
      if (currentSession.count !== 1) throw new UnauthorizedException('Session is expired or revoked.');
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId: actor.organizationId, action: 'AUTH_MFA_ROTATED', entityType: 'UserMfa', entityId: actor.sub, ipAddress: meta.ipAddress?.slice(0, 45) } });
    });
    const identity = await this.auth.me(actor);
    return { secret, otpauthUri: buildOtpAuthUri(identity.email, secret), recoveryCodes, message: 'MFA rotated. Previous sessions were revoked; store the new recovery codes securely.' };
  }

  async recover(actor: AuthenticatedUser, currentPassword: string, recoveryCode: string, meta: RequestMeta) {
    await this.auth.verifyCurrentPassword(actor.sub, currentPassword);
    const enrollment = await this.prisma.mfaEnrollment.findUnique({ where: { userId: actor.sub }, select: { id: true, enabled: true, version: true } });
    if (!enrollment?.enabled) throw new BadRequestException('MFA is not enabled.');
    const storedCode = await this.prisma.mfaRecoveryCode.findFirst({ where: { enrollmentId: enrollment.id, codeHash: hashRecoveryCode(normalizeRecoveryCode(recoveryCode)), usedAt: null }, select: { id: true } });
    if (!storedCode) throw new UnauthorizedException('Recovery code is invalid or already used.');
    const now = new Date();
    const secret = generateBase32Secret();
    const recoveryCodes = generateRecoveryCodes(MFA_RECOVERY_CODE_COUNT);
    await this.prisma.$transaction(async (tx) => {
      const used = await tx.mfaRecoveryCode.updateMany({ where: { id: storedCode.id, usedAt: null }, data: { usedAt: now } });
      if (used.count !== 1) throw new UnauthorizedException('Recovery code is invalid or already used.');
      const changed = await tx.mfaEnrollment.updateMany({ where: { id: enrollment.id, enabled: true, version: enrollment.version }, data: { secretCiphertext: encryptSecret(secret), lastAcceptedStep: null, version: { increment: 1 } } });
      if (changed.count !== 1) throw new UnauthorizedException('MFA enrollment changed concurrently. Retry.');
      await tx.mfaRecoveryCode.deleteMany({ where: { enrollmentId: enrollment.id } });
      await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((code) => ({ enrollmentId: enrollment.id, codeHash: hashRecoveryCode(code) })) });
      await tx.refreshSession.updateMany({ where: { userId: actor.sub, id: { not: actor.sessionId }, revokedAt: null }, data: { revokedAt: now } });
      const currentSession = await tx.refreshSession.updateMany({ where: { id: actor.sessionId, userId: actor.sub, revokedAt: null, expiresAt: { gt: now } }, data: { mfaVerifiedAt: now } });
      if (currentSession.count !== 1) throw new UnauthorizedException('Session is expired or revoked.');
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId: actor.organizationId, action: 'AUTH_MFA_RECOVERY_COMPLETED', entityType: 'UserMfa', entityId: actor.sub, ipAddress: meta.ipAddress?.slice(0, 45) } });
    });
    const identity = await this.auth.me(actor);
    return { secret, otpauthUri: buildOtpAuthUri(identity.email, secret), recoveryCodes, message: 'MFA recovery completed. The used recovery code is permanently invalid and previous sessions were revoked.' };
  }

  async assertStepUp(actor: AuthenticatedUser): Promise<void> {
    if (!hasPrivilegedRole(actor.roles)) return;
    const [enrollment, session] = await Promise.all([
      this.prisma.mfaEnrollment.findUnique({ where: { userId: actor.sub }, select: { enabled: true } }),
      this.prisma.refreshSession.findUnique({ where: { id: actor.sessionId }, select: { userId: true, revokedAt: true, expiresAt: true, mfaVerifiedAt: true } }),
    ]);
    const now = Date.now();
    if (!enrollment?.enabled) throw new ForbiddenException('MFA enrollment is required before privileged mutations.');
    if (!session || session.userId !== actor.sub || session.revokedAt || session.expiresAt.getTime() <= now) throw new UnauthorizedException('Session is expired or revoked.');
    if (!session.mfaVerifiedAt || session.mfaVerifiedAt.getTime() + MFA_STEP_UP_TTL_SECONDS * 1000 <= now) throw new ForbiddenException('MFA step-up is required before privileged mutations.');
  }
}
