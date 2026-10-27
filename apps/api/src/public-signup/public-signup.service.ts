import {
  BadRequestException, ConflictException, ForbiddenException, HttpException,
  Injectable, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';
import { MemberConsentDocumentStatus, Prisma, PublicSignupStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { requireOrganizationId, TenantScopeError } from '../auth/tenant-scope';
import { SmtpMailService } from '../enrollment/smtp-mail.service';
import { PublicSignupPolicyDto, PublicSignupStartDto, PublicSignupVerifyDto } from './public-signup.dto';

const throttleError = () => new HttpException('Registration request cooldown or hourly limit applies.', 429);
const genericStatus = 'If the account is eligible, an email verification code has been sent.';
const verifiedStatus = 'Email account verified. Sign in to continue approved e-PIN enrollment; membership remains inactive.';
const maxHourly = 6;
const timeoutSeconds = 600;
const resendSeconds = 90;

@Injectable()
export class PublicSignupService {
  constructor(private readonly prisma: PrismaService, private readonly smtp: SmtpMailService) {}

  private operatorOrg(actor: AuthenticatedUser): string {
    try { return requireOrganizationId(actor); }
    catch (e) {
      if (e instanceof TenantScopeError) throw new ForbiddenException('Organization context required.');
      throw e;
    }
  }

  private policyEnabled() {
    if (process.env.ADFLICK_PUBLIC_SIGNUP_ENABLED !== 'true' ||
        process.env.ADFLICK_MEMBER_EMAIL_OTP_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Public email account creation is not enabled.');
    }
  }

  private digest(label: string, data: string) {
    const secret = process.env.ADFLICK_PUBLIC_SIGNUP_HMAC_SECRET;
    if (!secret || secret.length < 32) throw new ServiceUnavailableException('Public signup signing secret is not configured.');
    return createHmac('sha256', secret).update(label + ':' + data).digest('hex');
  }

  private async activeOrg(slug: string) {
    if (!/^[a-z0-9-]{3,180}$/.test(slug)) throw new NotFoundException('Registration is unavailable.');
    const org = await this.prisma.organization.findFirst({
      where: {
        slug, isActive: true,
        publicSignupPolicy: { is: { enabled: true } },
        memberOtpPolicy: { is: { emailEnabled: true } },
      },
      select: { id: true, name: true, slug: true },
    });
    if (!org) throw new NotFoundException('Registration is unavailable.');
    return org;
  }

  private async approvedConsent(organizationId: string) {
    const consent = await this.prisma.memberConsentDocument.findFirst({
      where: { organizationId, status: MemberConsentDocumentStatus.APPROVED },
      orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, version: true, documentSha256: true, documentText: true },
    });
    if (!consent) throw new ServiceUnavailableException('Approved registration consent is unavailable.');
    return consent;
  }

  async organization(slug: string) {
    this.policyEnabled();
    if (!this.smtp.configurationReady()) throw new ServiceUnavailableException('Email delivery is not configured.');
    const org = await this.activeOrg(slug);
    const consent = await this.approvedConsent(org.id);
    return {
      organizationSlug: org.slug, organizationName: org.name,
      consentVersion: consent.version, consentDocumentSha256: consent.documentSha256,
      consentText: consent.documentText,
      emailOnlyAccountBootstrap: true, mobileOtpVerified: false, memberActivated: false,
    };
  }

  async readPolicy(actor: AuthenticatedUser) {
    const organizationId = this.operatorOrg(actor);
    const existing = await this.prisma.publicSignupPolicy.findUnique({ where: { organizationId } });
    return {
      enabled: existing?.enabled ?? false, version: existing?.version ?? 0,
      platformEnabled: process.env.ADFLICK_PUBLIC_SIGNUP_ENABLED === 'true',
      otpEnabled: process.env.ADFLICK_MEMBER_EMAIL_OTP_ENABLED === 'true',
      smtpReady: this.smtp.configurationReady(),
      memberActivationEnabled: false,
    };
  }

  async updatePolicy(actor: AuthenticatedUser, dto: PublicSignupPolicyDto) {
    if (process.env.ADFLICK_PUBLIC_SIGNUP_POLICY_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Public signup policy editing is disabled.');
    }
    const organizationId = this.operatorOrg(actor);
    if (dto.enabled && !this.smtp.configurationReady()) {
      throw new ServiceUnavailableException('Configure secure SMTP before approving the tenant public signup policy.');
    }
    try {
      return await this.prisma.$transaction(async tx => {
        const old = await tx.publicSignupPolicy.findUnique({ where: { organizationId } });
        if ((old?.version ?? 0) !== dto.expectedVersion) throw new ConflictException('Public signup policy changed concurrently.');
        if (old) {
          const claim = await tx.publicSignupPolicy.updateMany({
            where: { organizationId, version: dto.expectedVersion },
            data: { enabled: dto.enabled, version: { increment: 1 }, updatedByUserId: actor.sub },
          });
          if (claim.count !== 1) throw new ConflictException('Concurrent public signup policy update.');
        } else {
          await tx.publicSignupPolicy.create({
            data: { organizationId, enabled: dto.enabled, version: 1, updatedByUserId: actor.sub },
          });
        }
        await tx.auditEvent.create({ data: {
          organizationId, actorUserId: actor.sub, action: 'PUBLIC_SIGNUP_POLICY_CHANGED',
          entityType: 'PublicSignupPolicy', entityId: organizationId,
          metadataJson: { enabled: dto.enabled, version: dto.expectedVersion + 1 },
        } });
        return { enabled: dto.enabled, version: dto.expectedVersion + 1,
          platformEnabled: process.env.ADFLICK_PUBLIC_SIGNUP_ENABLED === 'true',
          otpEnabled: process.env.ADFLICK_MEMBER_EMAIL_OTP_ENABLED === 'true',
          smtpReady: this.smtp.configurationReady(), memberActivationEnabled: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(e.code)) {
        throw new ConflictException('Concurrent public signup policy update.');
      }
      throw e;
    }
  }

  async start(dto: PublicSignupStartDto) {
    this.policyEnabled();
    if (!this.smtp.configurationReady()) throw new ServiceUnavailableException('Email delivery is unavailable.');
    const org = await this.activeOrg(dto.organizationSlug);
    const consent = await this.approvedConsent(org.id);
    if (consent.version !== dto.consentVersion ||
        consent.documentSha256.toLowerCase() !== dto.consentDocumentSha256.toLowerCase() ||
        !dto.consentAccepted) {
      throw new BadRequestException('Current approved registration consent must be accepted.');
    }
    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName.trim();
    if (displayName.length < 2) throw new BadRequestException('Full name is required.');
    const emailHash = this.digest('registration-email', email);
    const id = 'ps_' + randomBytes(12).toString('hex');
    const otpCode = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = this.digest('signup-code', id + ':' + otpCode);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeoutSeconds * 1000);
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
    });

    // Existing emails get the same response shape, without revealing whether
    // that address already has an account. No login/member is created here.
    const existingUser = Boolean(await this.prisma.user.findUnique({
      where: { email }, select: { id: true },
    }));
    try {
      await this.prisma.$transaction(async tx => {
        const key = { organizationId: org.id, emailHash };
        const throttle = await tx.publicSignupThrottle.findUnique({
          where: { organizationId_emailHash: key },
        });
        const nextAllowedAt = new Date(now.getTime() + resendSeconds * 1000);
        if (throttle) {
          const newHour = now.getTime() - throttle.windowStart.getTime() >= 3_600_000;
          if (throttle.nextAllowedAt > now || (!newHour && throttle.requestCount >= maxHourly)) throw throttleError();
          const changed = await tx.publicSignupThrottle.updateMany({
            where: { ...key, requestCount: throttle.requestCount, nextAllowedAt: { lte: now } },
            data: { nextAllowedAt, windowStart: newHour ? now : throttle.windowStart,
              requestCount: newHour ? 1 : { increment: 1 } },
          });
          if (changed.count !== 1) throw throttleError();
        } else {
          await tx.publicSignupThrottle.create({ data: {
            ...key, nextAllowedAt, windowStart: now, requestCount: 1,
          } });
        }
        // Existing-account requests consume the SAME durable cooldown budget.
        // Never allow a 201-vs-429 difference to disclose account existence.
        if (existingUser) return;
        await tx.publicSignupIntent.updateMany({
          where: { organizationId: org.id, emailHash,
            status: { in: [PublicSignupStatus.QUEUED, PublicSignupStatus.SENT] } },
          data: { status: PublicSignupStatus.FAILED },
        });
        await tx.publicSignupIntent.create({ data: {
          id, organizationId: org.id, email, emailHash, displayName, passwordHash,
          consentDocumentId: consent.id, codeHash,
          status: PublicSignupStatus.QUEUED, maxAttempts: 5, expiresAt,
        } });
        await tx.auditEvent.create({ data: {
          organizationId: org.id, action: 'PUBLIC_SIGNUP_EMAIL_REQUESTED',
          entityType: 'PublicSignupIntent', entityId: id,
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(e.code)) throw throttleError();
      throw e;
    }
    if (existingUser) return { requestId: id, expiresAt, message: genericStatus };
    try {
      await this.smtp.sendEnrollmentOtp(email, otpCode, timeoutSeconds / 60);
      const accepted = await this.prisma.publicSignupIntent.updateMany({
        where: { id, organizationId: org.id, status: PublicSignupStatus.QUEUED, expiresAt: { gt: new Date() } },
        data: { status: PublicSignupStatus.SENT, sentAt: new Date() },
      });
      if (accepted.count !== 1) throw new ServiceUnavailableException('Verification request expired.');
    } catch {
      await this.prisma.publicSignupIntent.updateMany({
        where: { id, organizationId: org.id, status: PublicSignupStatus.QUEUED },
        data: { status: PublicSignupStatus.FAILED },
      });
      throw new ServiceUnavailableException('Verification email could not be accepted by SMTP. Retry after cooldown.');
    }
    return { requestId: id, expiresAt, message: genericStatus };
  }

  async verify(dto: PublicSignupVerifyDto) {
    this.policyEnabled();
    const now = new Date();
    const request = await this.prisma.publicSignupIntent.findUnique({ where: { id: dto.requestId } });
    if (!request || request.status !== PublicSignupStatus.SENT ||
        request.expiresAt <= now || request.attempts >= request.maxAttempts) {
      throw new BadRequestException('Verification request is invalid or expired.');
    }
    const expected = Buffer.from(request.codeHash, 'hex');
    const got = Buffer.from(this.digest('signup-code', request.id + ':' + dto.code), 'hex');
    const valid = expected.length === got.length && timingSafeEqual(expected, got);
    if (!valid) {
      await this.prisma.publicSignupIntent.updateMany({
        where: { id: request.id, status: PublicSignupStatus.SENT,
          attempts: request.attempts, expiresAt: { gt: now } },
        data: { attempts: { increment: 1 }, ...(request.attempts + 1 >= request.maxAttempts
          ? { status: PublicSignupStatus.FAILED } : {}) },
      });
      throw new BadRequestException('Verification request is invalid or expired.');
    }
    try {
      return await this.prisma.$transaction(async tx => {
        const claimed = await tx.publicSignupIntent.updateMany({
          where: { id: request.id, organizationId: request.organizationId,
            status: PublicSignupStatus.SENT, attempts: request.attempts, expiresAt: { gt: now } },
          data: { status: PublicSignupStatus.CONSUMED, consumedAt: now },
        });
        if (claimed.count !== 1) throw new ConflictException('Verification request already consumed.');
        const org = await tx.organization.findFirst({
          where: { id: request.organizationId, isActive: true,
            publicSignupPolicy: { is: { enabled: true } },
            memberOtpPolicy: { is: { emailEnabled: true } } },
          select: { id: true },
        });
        if (!org) throw new ConflictException('Registration is no longer available.');
        const consent = await tx.memberConsentDocument.findFirst({
          where: { organizationId: org.id, status: MemberConsentDocumentStatus.APPROVED },
          orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
          select: { id: true },
        });
        if (!consent || consent.id !== request.consentDocumentId) {
          throw new ConflictException('Registration consent has changed. Start again.');
        }
        const user = await tx.user.create({
          data: {
            organizationId: org.id, email: request.email, displayName: request.displayName,
            passwordHash: request.passwordHash, status: 'ACTIVE',
            roleAssignments: { create: [{ role: UserRole.MEMBER }] },
          },
          select: { id: true },
        });
        await tx.accountConsentRecord.create({ data: {
          organizationId: org.id, userId: user.id, documentId: consent.id, acceptedAt: now,
        } });
        await tx.auditEvent.create({ data: {
          organizationId: org.id, actorUserId: user.id,
          action: 'PUBLIC_SIGNUP_EMAIL_VERIFIED_ACCOUNT_CREATED',
          entityType: 'User', entityId: user.id,
          metadataJson: { consentDocumentId: consent.id, memberProfileCreated: false },
        } });
        // Delete sensitive staged credential/OTP material atomically; immutable
        // signed consent record + user-scoped audit survive.
        await tx.publicSignupIntent.deleteMany({
          where: { organizationId: org.id, emailHash: request.emailHash },
        });
        return { emailVerified: true, memberActivated: false, profileCreated: false,
          message: verifiedStatus };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(e.code)) {
        throw new ConflictException('Registration already completed or conflicted.');
      }
      throw e;
    }
  }
}
