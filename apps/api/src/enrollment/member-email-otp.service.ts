import {
  BadRequestException, ConflictException, ForbiddenException, HttpException,
  Injectable, ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import {
  MemberEmailOtpStatus, MemberOtpPurpose, Prisma, UserRole, UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { requireOrganizationId, TenantScopeError } from '../auth/tenant-scope';
import { SmtpMailService } from './smtp-mail.service';
import { UpdateMemberOtpPolicyDto, VerifyMemberEmailOtpDto } from './member-email-otp.dto';

const purpose = MemberOtpPurpose.MEMBER_ENROLLMENT;
const defaultPolicy = { emailEnabled: false, digits: 6, ttlSeconds: 300, resendSeconds: 60, maxAttempts: 5, version: 0 };
const tooMany = () => new HttpException('Verification request cooldown or hourly limit applies.', 429);

@Injectable()
export class MemberEmailOtpService {
  constructor(private readonly prisma: PrismaService, private readonly mail: SmtpMailService) {}

  private org(actor: AuthenticatedUser): string {
    try { return requireOrganizationId(actor); }
    catch (e) {
      if (e instanceof TenantScopeError) throw new ForbiddenException('Organization context required.');
      throw e;
    }
  }

  private hash(id: string, org: string, userId: string, code: string) {
    const key = process.env.ADFLICK_MEMBER_OTP_HASH_PEPPER;
    if (!key || key.length < 32) throw new ServiceUnavailableException('OTP signing secret is missing.');
    return createHmac('sha256', key).update([purpose, org, userId, id, code].join(':')).digest('hex');
  }

  private hourlyCap(): number {
    const value = Number(process.env.ADFLICK_MEMBER_OTP_HOURLY_CAP ?? '10');
    if (!Number.isInteger(value) || value < 1 || value > 20) throw new ServiceUnavailableException('OTP hourly limit is invalid.');
    return value;
  }

  private active() {
    if (process.env.ADFLICK_MEMBER_EMAIL_OTP_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Email OTP verification is not activated.');
    }
  }

  async policy(actor: AuthenticatedUser) {
    const organizationId = this.org(actor);
    const p = await this.prisma.memberOtpPolicy.findUnique({
      where: { organizationId },
      select: { emailEnabled: true, digits: true, ttlSeconds: true, resendSeconds: true, maxAttempts: true, version: true, updatedAt: true },
    });
    return {
      ...(p ?? defaultPolicy),
      smtpReady: this.mail.configurationReady(),
      platformEnabled: process.env.ADFLICK_MEMBER_EMAIL_OTP_ENABLED === 'true',
      smsEnabled: false,
    };
  }

  async updatePolicy(actor: AuthenticatedUser, dto: UpdateMemberOtpPolicyDto) {
    if (process.env.ADFLICK_MEMBER_OTP_POLICY_ENABLED !== 'true') {
      throw new ServiceUnavailableException('OTP settings changes are not enabled.');
    }
    const organizationId = this.org(actor);
    if (dto.emailEnabled && !this.mail.configurationReady()) {
      throw new ServiceUnavailableException('Configure TLS-protected SMTP before enabling email OTP.');
    }
    try {
      return await this.prisma.$transaction(async tx => {
        const old = await tx.memberOtpPolicy.findUnique({ where: { organizationId }, select: { version: true } });
        if (old ? old.version !== dto.expectedVersion : dto.expectedVersion !== 0) {
          throw new ConflictException('OTP settings were changed by another administrator.');
        }
        const values = {
          emailEnabled: dto.emailEnabled, digits: dto.digits, ttlSeconds: dto.ttlSeconds,
          resendSeconds: dto.resendSeconds, maxAttempts: dto.maxAttempts,
          updatedByUserId: actor.sub,
        };
        const record = old
          ? await (async () => {
            const updated = await tx.memberOtpPolicy.updateMany({
              where: { organizationId, version: dto.expectedVersion },
              data: { ...values, version: { increment: 1 } },
            });
            if (updated.count !== 1) throw new ConflictException('OTP settings update conflicted.');
            return tx.memberOtpPolicy.findUniqueOrThrow({ where: { organizationId } });
          })()
          : await tx.memberOtpPolicy.create({ data: { organizationId, ...values, version: 1 } });
        await tx.auditEvent.create({ data: {
          actorUserId: actor.sub, organizationId, action: 'MEMBER_OTP_POLICY_UPDATED',
          entityType: 'MemberOtpPolicy', entityId: organizationId,
          metadataJson: { version: record.version, emailEnabled: record.emailEnabled,
            digits: record.digits, ttlSeconds: record.ttlSeconds,
            resendSeconds: record.resendSeconds, maxAttempts: record.maxAttempts },
        } });
        return { emailEnabled: record.emailEnabled, digits: record.digits, ttlSeconds: record.ttlSeconds,
          resendSeconds: record.resendSeconds, maxAttempts: record.maxAttempts, version: record.version,
          smtpReady: this.mail.configurationReady(), platformEnabled: process.env.ADFLICK_MEMBER_EMAIL_OTP_ENABLED === 'true',
          smsEnabled: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(e.code)) {
        throw new ConflictException('Concurrent OTP settings update.');
      }
      throw e;
    }
  }

  private async eligibleMember(org: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId, organizationId: org, status: UserStatus.ACTIVE,
        roleAssignments: { some: { role: UserRole.MEMBER } },
      },
      select: { id: true, email: true, memberProfile: { select: { id: true } } },
    });
    if (!user || user.memberProfile) throw new ConflictException('Account is not eligible for enrollment verification.');
    return user;
  }

  async request(actor: AuthenticatedUser) {
    this.active();
    const organizationId = this.org(actor);
    const settings = await this.prisma.memberOtpPolicy.findUnique({ where: { organizationId } });
    if (!settings?.emailEnabled || !this.mail.configurationReady()) {
      throw new ServiceUnavailableException('Email verification provider/policy is disabled.');
    }
    const user = await this.eligibleMember(organizationId, actor.sub);
    const now = new Date();
    const id = 'otp_' + randomBytes(12).toString('hex');
    const code = randomInt(0, 10 ** settings.digits).toString().padStart(settings.digits, '0');
    const expiresAt = new Date(now.getTime() + settings.ttlSeconds * 1000);
    const nextAllowedAt = new Date(now.getTime() + settings.resendSeconds * 1000);
    const hourlyCap = this.hourlyCap();
    try {
      await this.prisma.$transaction(async tx => {
        const key = { organizationId, userId: user.id, purpose };
        const throttle = await tx.memberEmailOtpThrottle.findUnique({
          where: { organizationId_userId_purpose: key },
        });
        if (throttle) {
          const rolling = now.getTime() - throttle.windowStart.getTime() >= 60 * 60 * 1000;
          if (throttle.nextAllowedAt > now || (!rolling && throttle.requestCount >= hourlyCap)) throw tooMany();
          const claim = await tx.memberEmailOtpThrottle.updateMany({
            where: { ...key, nextAllowedAt: { lte: now }, requestCount: throttle.requestCount },
            data: { nextAllowedAt, windowStart: rolling ? now : throttle.windowStart,
              requestCount: rolling ? 1 : { increment: 1 } },
          });
          if (claim.count !== 1) throw tooMany();
        } else {
          await tx.memberEmailOtpThrottle.create({ data: {
            ...key, nextAllowedAt, windowStart: now, requestCount: 1,
          } });
        }
        // Earlier codes are invalid from the instant a new challenge is queued.
        await tx.memberEmailOtp.updateMany({
          where: { organizationId, userId: user.id, purpose,
            status: { in: [MemberEmailOtpStatus.QUEUED, MemberEmailOtpStatus.SENT, MemberEmailOtpStatus.VERIFIED] } },
          data: { status: MemberEmailOtpStatus.FAILED },
        });
        await tx.memberEmailOtp.create({ data: {
          id, organizationId, userId: user.id, purpose, codeHash: this.hash(id, organizationId, user.id, code),
          maxAttempts: settings.maxAttempts, expiresAt,
        } });
        await tx.auditEvent.create({ data: {
          organizationId, actorUserId: user.id, action: 'MEMBER_EMAIL_OTP_REQUESTED',
          entityType: 'MemberEmailOtp', entityId: id,
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(e.code)) throw tooMany();
      throw e;
    }

    try {
      await this.mail.sendEnrollmentOtp(user.email, code, Math.ceil(settings.ttlSeconds / 60));
      const delivered = await this.prisma.memberEmailOtp.updateMany({
        where: { id, organizationId, userId: user.id, status: MemberEmailOtpStatus.QUEUED, expiresAt: { gt: new Date() } },
        data: { status: MemberEmailOtpStatus.SENT, sentAt: new Date() },
      });
      if (delivered.count !== 1) throw new ServiceUnavailableException('OTP delivery expired before confirmation.');
    } catch {
      await this.prisma.memberEmailOtp.updateMany({
        where: { id, organizationId, userId: user.id, status: MemberEmailOtpStatus.QUEUED },
        data: { status: MemberEmailOtpStatus.FAILED },
      });
      throw new ServiceUnavailableException('Verification email could not be sent. Try again after the cooldown.');
    }
    return { challengeId: id, expiresAt, resendAfter: nextAllowedAt,
      message: 'SMTP server accepted a verification email for the authenticated account.' };
  }

  async verify(actor: AuthenticatedUser, input: VerifyMemberEmailOtpDto) {
    this.active();
    const organizationId = this.org(actor);
    const now = new Date();
    const otp = await this.prisma.memberEmailOtp.findFirst({
      where: { id: input.challengeId, organizationId, userId: actor.sub, purpose },
    });
    if (!otp || otp.status !== MemberEmailOtpStatus.SENT || otp.expiresAt <= now || otp.attempts >= otp.maxAttempts) {
      throw new BadRequestException('Verification challenge is invalid or expired.');
    }
    const candidate = Buffer.from(this.hash(otp.id, organizationId, actor.sub, input.code), 'hex');
    const expected = Buffer.from(otp.codeHash, 'hex');
    const matches = candidate.length === expected.length && timingSafeEqual(candidate, expected);
    if (!matches) {
      await this.prisma.memberEmailOtp.updateMany({
        where: { id: otp.id, organizationId, userId: actor.sub, status: MemberEmailOtpStatus.SENT,
          attempts: otp.attempts, expiresAt: { gt: now } },
        data: { attempts: { increment: 1 },
          ...(otp.attempts + 1 >= otp.maxAttempts ? { status: MemberEmailOtpStatus.FAILED } : {}) },
      });
      throw new BadRequestException('Verification code is invalid or expired.');
    }
    const claim = await this.prisma.memberEmailOtp.updateMany({
      where: { id: otp.id, organizationId, userId: actor.sub, status: MemberEmailOtpStatus.SENT,
        attempts: otp.attempts, expiresAt: { gt: now } },
      data: { status: MemberEmailOtpStatus.VERIFIED, verifiedAt: now },
    });
    if (claim.count !== 1) throw new ConflictException('Verification challenge already used.');
    await this.prisma.auditEvent.create({ data: {
      organizationId, actorUserId: actor.sub, action: 'MEMBER_EMAIL_OTP_VERIFIED',
      entityType: 'MemberEmailOtp', entityId: otp.id,
    } });
    return { verified: true, expiresAt: otp.expiresAt };
  }

  async status(actor: AuthenticatedUser) {
    const organizationId = this.org(actor);
    const now = new Date();
    const [verified, pending, throttle] = await Promise.all([
      this.prisma.memberEmailOtp.findFirst({
        where: { organizationId, userId: actor.sub, purpose,
          status: MemberEmailOtpStatus.VERIFIED, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
        select: { expiresAt: true },
      }),
      this.prisma.memberEmailOtp.findFirst({
        where: { organizationId, userId: actor.sub, purpose,
          status: MemberEmailOtpStatus.SENT, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, expiresAt: true },
      }),
      this.prisma.memberEmailOtpThrottle.findUnique({
        where: { organizationId_userId_purpose: { organizationId, userId: actor.sub, purpose } },
        select: { nextAllowedAt: true },
      }),
    ]);
    return { verified: !!verified, expiresAt: verified?.expiresAt ?? pending?.expiresAt ?? null,
      pendingChallengeId: pending?.id ?? null, resendAfter: throttle?.nextAllowedAt ?? null,
      channel: 'EMAIL' };
  }
}
