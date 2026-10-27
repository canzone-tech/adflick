import {
  BadRequestException, ConflictException, ForbiddenException, Injectable,
  NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
  BinarySide, EnrollmentPinStatus, MemberConsentDocumentStatus, MemberEmailOtpStatus,
  MemberPackageStatus, Prisma, UserRole, UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { requireOrganizationId, TenantScopeError } from '../auth/tenant-scope';
import {
  CreateMemberPackageDto, CreateMemberConsentDto, IssueEnrollmentPinDto,
  EnrollExistingMemberDto,
} from './enrollment.dto';

@Injectable()
export class EnrollmentService {
  constructor(private readonly prisma: PrismaService) {}

  private organization(actor: AuthenticatedUser): string {
    try { return requireOrganizationId(actor); }
    catch (e) {
      if (e instanceof TenantScopeError) throw new ForbiddenException('Organization context is required.');
      throw e;
    }
  }

  private enabled(name: string) {
    if (process.env[name] !== 'true') throw new ServiceUnavailableException('Member enrollment workflow is not approved for activation.');
  }

  private pinHash(token: string) {
    const pepper = process.env.ADFLICK_EPIN_HASH_PEPPER;
    if (!pepper || pepper.length < 32) throw new ServiceUnavailableException('Enrollment PIN signing key is not configured.');
    return createHmac('sha256', pepper).update(token, 'utf8').digest('hex');
  }

  private audit(org: string, actor: AuthenticatedUser, action: string, type: string, id: string, metadataJson?: Prisma.InputJsonObject) {
    return {
      actorUserId: actor.sub, organizationId: org, action, entityType: type,
      entityId: id, ...(metadataJson ? { metadataJson } : {}),
    };
  }

  private convertCollision(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2003', 'P2011', 'P2034'].includes(error.code)) {
      throw new ConflictException('Enrollment request conflicts with a current record or occupied placement.');
    }
    throw error;
  }

  async packages(actor: AuthenticatedUser) {
    const organizationId = this.organization(actor);
    return this.prisma.memberPackage.findMany({
      where: { organizationId }, orderBy: [{ code: 'asc' }],
      take: 100, select: { id: true, code: true, name: true, status: true, createdAt: true, approvedAt: true },
    });
  }

  async createPackage(actor: AuthenticatedUser, dto: CreateMemberPackageDto) {
    this.enabled('ADFLICK_MEMBER_CONFIG_ENABLED');
    const organizationId = this.organization(actor);
    try {
      return await this.prisma.$transaction(async tx => {
        const item = await tx.memberPackage.create({
          data: { organizationId, code: dto.code.trim(), name: dto.name.trim(), createdByUserId: actor.sub },
          select: { id: true, code: true, name: true, status: true },
        });
        await tx.auditEvent.create({ data: this.audit(organizationId, actor, 'MEMBER_PACKAGE_DRAFT_CREATED', 'MemberPackage', item.id) });
        return item;
      });
    } catch (e) { return this.convertCollision(e); }
  }

  async approvePackage(actor: AuthenticatedUser, id: string, reference: string) {
    this.enabled('ADFLICK_MEMBER_CONFIG_ENABLED');
    const organizationId = this.organization(actor);
    const item = await this.prisma.memberPackage.findFirst({
      where: { id, organizationId }, select: { id: true, createdByUserId: true, status: true },
    });
    if (!item) throw new NotFoundException('Package not found.');
    if (item.createdByUserId === actor.sub) throw new ForbiddenException('Independent package approver required.');
    if (item.status !== MemberPackageStatus.DRAFT) throw new ConflictException('Package is no longer a draft.');
    return this.prisma.$transaction(async tx => {
      const updated = await tx.memberPackage.updateMany({
        where: { id, organizationId, status: MemberPackageStatus.DRAFT, approvedByUserId: null },
        data: { status: MemberPackageStatus.ENABLED, approvedByUserId: actor.sub, approvedAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictException('Concurrent package review conflict.');
      await tx.auditEvent.create({ data: this.audit(organizationId, actor, 'MEMBER_PACKAGE_REVIEW_APPROVED', 'MemberPackage', id, { approvalReference: reference.trim() }) });
      return { id, status: MemberPackageStatus.ENABLED };
    });
  }

  async createConsent(actor: AuthenticatedUser, dto: CreateMemberConsentDto) {
    this.enabled('ADFLICK_MEMBER_CONFIG_ENABLED');
    const organizationId = this.organization(actor);
    const documentText = dto.documentText.trim();
    const documentSha256 = createHash('sha256').update(documentText, 'utf8').digest('hex');
    try {
      return await this.prisma.$transaction(async tx => {
        const item = await tx.memberConsentDocument.create({
          data: {
            organizationId, version: dto.version.trim(), documentText, documentSha256,
            createdByUserId: actor.sub,
          },
          select: { id: true, version: true, documentSha256: true, status: true },
        });
        await tx.auditEvent.create({ data: this.audit(organizationId, actor, 'MEMBER_CONSENT_DRAFT_CREATED', 'MemberConsentDocument', item.id, { documentSha256 }) });
        return item;
      });
    } catch (e) { return this.convertCollision(e); }
  }

  async approveConsent(actor: AuthenticatedUser, id: string, reference: string) {
    this.enabled('ADFLICK_MEMBER_CONFIG_ENABLED');
    const organizationId = this.organization(actor);
    const item = await this.prisma.memberConsentDocument.findFirst({
      where: { id, organizationId }, select: { id: true, createdByUserId: true, status: true, documentSha256: true },
    });
    if (!item) throw new NotFoundException('Consent document not found.');
    if (item.createdByUserId === actor.sub) throw new ForbiddenException('Independent consent reviewer required.');
    if (item.status !== MemberConsentDocumentStatus.DRAFT) throw new ConflictException('Consent version is not a draft.');
    return this.prisma.$transaction(async tx => {
      const updated = await tx.memberConsentDocument.updateMany({
        where: { id, organizationId, status: MemberConsentDocumentStatus.DRAFT, approvedByUserId: null },
        data: { status: MemberConsentDocumentStatus.APPROVED, approvedByUserId: actor.sub, approvedAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictException('Concurrent consent review conflict.');
      await tx.auditEvent.create({ data: this.audit(organizationId, actor, 'MEMBER_CONSENT_REVIEW_APPROVED', 'MemberConsentDocument', id, {
        approvalReference: reference.trim(), documentSha256: item.documentSha256,
      }) });
      return { id, status: MemberConsentDocumentStatus.APPROVED };
    });
  }

  async currentConsent(actor: AuthenticatedUser) {
    const organizationId = this.organization(actor);
    const latest = await this.prisma.memberConsentDocument.findFirst({
      where: { organizationId, status: MemberConsentDocumentStatus.APPROVED },
      orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
      select: { version: true, documentSha256: true, documentText: true, approvedAt: true },
    });
    if (!latest) throw new NotFoundException('No approved registration consent is available.');
    return latest;
  }

  async listPins(actor: AuthenticatedUser, take: number, skip: number) {
    const organizationId = this.organization(actor);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.enrollmentPin.findMany({
        where: { organizationId }, orderBy: { createdAt: 'desc' }, take, skip,
        select: { id: true, packageId: true, recipientUserId: true, status: true, expiresAt: true, redeemedAt: true, revokedAt: true, createdAt: true },
      }),
      this.prisma.enrollmentPin.count({ where: { organizationId } }),
    ]);
    return { items, total, take, skip };
  }

  async issuePin(actor: AuthenticatedUser, dto: IssueEnrollmentPinDto) {
    this.enabled('ADFLICK_MEMBER_EPIN_ISSUANCE_ENABLED');
    const organizationId = this.organization(actor);
    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt.getTime() <= Date.now() || expiresAt.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('PIN expiry must be in the future and within one year.');
    }
    const [recipient, pkg] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: dto.recipientUserId, organizationId, status: UserStatus.ACTIVE, roleAssignments: { some: { role: UserRole.MEMBER } }, memberProfile: { is: null } },
        select: { id: true },
      }),
      this.prisma.memberPackage.findUnique({
        where: { organizationId_code: { organizationId, code: dto.packageCode } },
        select: { id: true, status: true },
      }),
    ]);
    if (!recipient || !pkg || pkg.status !== MemberPackageStatus.ENABLED) {
      throw new BadRequestException('Active recipient and independently approved package required.');
    }
    // 256-bit random bearer secret shown once; only keyed HMAC is persisted.
    const pin = randomBytes(32).toString('base64url');
    const tokenHash = this.pinHash(pin);
    const item = await this.prisma.$transaction(async tx => {
      const created = await tx.enrollmentPin.create({
        data: {
          organizationId, packageId: pkg.id, recipientUserId: recipient.id, tokenHash,
          issuedByUserId: actor.sub, expiresAt,
        },
        select: { id: true, expiresAt: true, status: true },
      });
      await tx.auditEvent.create({ data: this.audit(organizationId, actor, 'MEMBER_EPIN_ISSUED', 'EnrollmentPin', created.id, { recipientUserId: recipient.id, packageId: pkg.id }) });
      return created;
    });
    return { ...item, pin, notice: 'One-time e-PIN. Store securely; it cannot be recovered from the database.' };
  }

  async revokePin(actor: AuthenticatedUser, id: string, reason: string) {
    const organizationId = this.organization(actor);
    return this.prisma.$transaction(async tx => {
      const result = await tx.enrollmentPin.updateMany({
        where: { id, organizationId, status: EnrollmentPinStatus.ISSUED },
        data: { status: EnrollmentPinStatus.REVOKED, revokedAt: new Date() },
      });
      if (result.count !== 1) throw new ConflictException('PIN is already consumed, revoked, or inaccessible.');
      await tx.auditEvent.create({ data: this.audit(organizationId, actor, 'MEMBER_EPIN_REVOKED', 'EnrollmentPin', id, { reason: reason.trim() }) });
      return { id, status: EnrollmentPinStatus.REVOKED };
    });
  }

  /** Existing authenticated account only. Public email/OTP registration is separately blocked. */
  async enrollExistingMember(actor: AuthenticatedUser, dto: EnrollExistingMemberDto) {
    this.enabled('ADFLICK_MEMBER_ENROLLMENT_ENABLED');
    const organizationId = this.organization(actor);
    const hash = this.pinHash(dto.pin);
    const now = new Date();
    try {
      return await this.prisma.$transaction(async tx => {
        const [user, pin, sponsor, parent, consent, root] = await Promise.all([
          tx.user.findFirst({ where: {
            id: actor.sub, organizationId, status: UserStatus.ACTIVE,
            roleAssignments: { some: { role: UserRole.MEMBER } },
          }, select: { id: true } }),
          tx.enrollmentPin.findUnique({ where: { tokenHash: hash }, select: {
            id: true, organizationId: true, recipientUserId: true, packageId: true, status: true, expiresAt: true,
            package: { select: { status: true } },
          } }),
          tx.memberProfile.findUnique({
            where: { organizationId_memberCode: { organizationId, memberCode: dto.sponsorMemberCode } },
            select: { id: true, status: true },
          }),
          tx.memberProfile.findUnique({
            where: { organizationId_memberCode: { organizationId, memberCode: dto.placementParentMemberCode } },
            select: { id: true, status: true },
          }),
          tx.memberConsentDocument.findUnique({
            where: { organizationId_version: { organizationId, version: dto.consentVersion } },
            select: { id: true, status: true, documentSha256: true },
          }),
          tx.binaryTreeRoot.findUnique({ where: { organizationId }, select: { memberId: true } }),
        ]);
        if (!user || await tx.memberProfile.count({ where: { organizationId, userId: actor.sub } }) > 0) {
          throw new ConflictException('Authenticated user is not eligible for a second enrollment.');
        }
        if (!pin || pin.organizationId !== organizationId || pin.recipientUserId !== actor.sub ||
            pin.status !== EnrollmentPinStatus.ISSUED || pin.expiresAt <= now ||
            pin.package.status !== MemberPackageStatus.ENABLED) {
          throw new ConflictException('PIN is invalid, expired, revoked or not assigned to this member.');
        }
        if (!sponsor || !parent || sponsor.status !== 'ACTIVE' || parent.status !== 'ACTIVE' || !root) {
          throw new BadRequestException('Sponsor, placement parent and approved organization tree must exist and be active.');
        }
        const currentConsent = await tx.memberConsentDocument.findFirst({
          where: { organizationId, status: MemberConsentDocumentStatus.APPROVED },
          orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
          select: { id: true },
        });
        if (!consent || consent.status !== MemberConsentDocumentStatus.APPROVED ||
            consent.documentSha256.toLowerCase() !== dto.consentDocumentSha256.toLowerCase() ||
            !dto.consentAccepted || consent.id !== currentConsent?.id) {
          throw new BadRequestException('Current independently approved consent must be accepted.');
        }

        // Validate connectivity of BOTH sponsor and parent to the same existing root.
        // No arbitrary spillover or sponsor-reassignment policy is invented.
        for (const start of [sponsor.id, parent.id]) {
          let cursor = start;
          const seen = new Set<string>();
          let rooted = false;
          for (let i = 0; i < 512; i++) {
            if (cursor === root.memberId) { rooted = true; break; }
            if (seen.has(cursor)) break;
            seen.add(cursor);
            const edge = await tx.placementNode.findFirst({
              where: { memberId: cursor, organizationId },
              select: { parentMemberId: true },
            });
            if (!edge) break;
            cursor = edge.parentMemberId;
          }
          if (!rooted) throw new ConflictException('Sponsor/placement graph is disconnected or cyclic.');
        }

        // Email OTP is mandatory. Its consumption rolls back together with PIN,
        // placement, member profile and consent if any downstream write fails.
        const verifiedOtp = await tx.memberEmailOtp.findFirst({
          where: { organizationId, userId: actor.sub, purpose: 'MEMBER_ENROLLMENT',
            status: MemberEmailOtpStatus.VERIFIED, expiresAt: { gt: now }, verifiedAt: { not: null } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true },
        });
        if (!verifiedOtp) throw new ConflictException('Email OTP verification is required for member enrollment.');
        const consumedOtp = await tx.memberEmailOtp.updateMany({
          where: { id: verifiedOtp.id, organizationId, userId: actor.sub,
            status: MemberEmailOtpStatus.VERIFIED, expiresAt: { gt: now } },
          data: { status: MemberEmailOtpStatus.CONSUMED, consumedAt: now },
        });
        if (consumedOtp.count !== 1) throw new ConflictException('Email OTP has already been consumed.');

        // Atomic CAS prevents PIN replay. On any later failure (including occupied side)
        // MySQL rolls this claim and all member/consent/placement writes back together.
        const claimed = await tx.enrollmentPin.updateMany({
          where: { id: pin.id, organizationId, recipientUserId: actor.sub,
            status: EnrollmentPinStatus.ISSUED, expiresAt: { gt: now } },
          data: { status: EnrollmentPinStatus.REDEEMED, redeemedAt: now },
        });
        if (claimed.count !== 1) throw new ConflictException('PIN has already been redeemed.');
        const member = await tx.memberProfile.create({
          data: {
            organizationId, userId: actor.sub,
            memberCode: 'M-' + randomBytes(12).toString('hex').toUpperCase(),
            // No payout/commission eligibility; email OTP was required above.
            status: 'PENDING_ACTIVATION',
          },
          select: { id: true, memberCode: true, status: true },
        });
        await tx.sponsorRelationship.create({ data: {
          organizationId, memberId: member.id, sponsorMemberId: sponsor.id,
        } });
        await tx.placementNode.create({ data: {
          organizationId, memberId: member.id, parentMemberId: parent.id, side: dto.side as BinarySide,
        } });
        await tx.memberConsentRecord.create({ data: {
          organizationId, memberId: member.id, documentId: consent.id, acceptedAt: now,
        } });
        await tx.enrollmentPin.update({
          where: { id: pin.id },
          data: { redeemedByMemberId: member.id },
        });
        await tx.auditEvent.create({ data: this.audit(organizationId, actor, 'MEMBER_EPIN_ENROLLMENT_PENDING', 'MemberProfile', member.id, {
          packageId: pin.packageId, enrollmentPinId: pin.id, consentDocumentId: consent.id,
          sponsorMemberId: sponsor.id, placementParentMemberId: parent.id, side: dto.side,
        }) });
        return { memberCode: member.memberCode, status: member.status, placementSide: dto.side,
          message: 'Verified-email enrollment recorded; separate identity/KYC checks and activation remain pending.' };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
    } catch (e) { return this.convertCollision(e); }
  }
}
