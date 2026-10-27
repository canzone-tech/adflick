import { ForbiddenException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { MemberEnrollmentStatus, BinarySide } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { requireOrganizationId, TenantScopeError } from '../auth/tenant-scope';
import { MemberListQueryDto } from './members.dto';

type MemberNode = { memberCode: string; status: MemberEnrollmentStatus; side: BinarySide | null; parentMemberCode: string | null; depth: number };

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  private org(actor: AuthenticatedUser) {
    try { return requireOrganizationId(actor); }
    catch (error) {
      if (error instanceof TenantScopeError) throw new ForbiddenException('Organization context required.');
      throw error;
    }
  }

  private profileSelect = {
    id: true, memberCode: true, status: true, activatedAt: true, createdAt: true,
    user: { select: { displayName: true } },
    sponsorship: { select: { sponsor: { select: { memberCode: true } } } },
    placement: { select: { side: true, parent: { select: { memberCode: true } } } },
    treeRoot: { select: { memberId: true } },
  } as const;

  private present(profile: {
    id: string; memberCode: string; status: MemberEnrollmentStatus; activatedAt: Date | null; createdAt: Date;
    user: { displayName: string };
    sponsorship: { sponsor: { memberCode: string } } | null;
    placement: { side: BinarySide; parent: { memberCode: string } } | null;
    treeRoot: { memberId: string } | null;
  }) {
    return {
      memberCode: profile.memberCode, status: profile.status, displayName: profile.user.displayName,
      sponsorMemberCode: profile.sponsorship?.sponsor.memberCode ?? null,
      placementParentMemberCode: profile.placement?.parent.memberCode ?? null,
      placementSide: profile.placement?.side ?? null,
      isTreeRoot: !!profile.treeRoot, activatedAt: profile.activatedAt, createdAt: profile.createdAt,
    };
  }


  /**
   * Milestone 1 — owned account dashboard, never a commission or activation claim.
   * No member profile is a valid email-verified, not-yet-enrolled login state.
   */
  async myDashboard(actor: AuthenticatedUser) {
    const organizationId = this.org(actor);
    const profile = await this.prisma.memberProfile.findFirst({
      where: { organizationId, userId: actor.sub },
      select: this.profileSelect,
    });
    if (!profile) return {
      hasProfile: false, member: null, directReferrals: 0,
      directPlacement: { LEFT: null, RIGHT: null },
      financialEligibilityEstablished: false,
    };
    const [directReferrals, slots] = await Promise.all([
      this.prisma.sponsorRelationship.count({
        where: { organizationId, sponsorMemberId: profile.id },
      }),
      this.prisma.placementNode.findMany({
        where: { organizationId, parentMemberId: profile.id },
        select: { side: true, member: { select: { memberCode: true, status: true } } },
      }),
    ]);
    const directPlacement: {
      LEFT: { memberCode: string; status: MemberEnrollmentStatus } | null;
      RIGHT: { memberCode: string; status: MemberEnrollmentStatus } | null;
    } = { LEFT: null, RIGHT: null };
    for (const slot of slots) directPlacement[slot.side] = slot.member;
    return {
      hasProfile: true, member: this.present(profile), directReferrals,
      directPlacement, financialEligibilityEstablished: false,
    };
  }

  /** Milestone 2 — strictly own sponsor relationships, bounded MySQL pagination. */
  async myReferrals(actor: AuthenticatedUser, query: MemberListQueryDto) {
    const organizationId = this.org(actor);
    const profile = await this.prisma.memberProfile.findFirst({
      where: { organizationId, userId: actor.sub }, select: { id: true },
    });
    if (!profile) return { hasProfile: false, items: [], total: 0, take: query.take, skip: query.skip };
    const where = { organizationId, sponsorMemberId: profile.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sponsorRelationship.findMany({
        where, orderBy: [{ createdAt: 'desc' }, { memberId: 'desc' }],
        take: query.take, skip: query.skip,
        select: {
          createdAt: true,
          member: { select: { memberCode: true, status: true } },
        },
      }),
      this.prisma.sponsorRelationship.count({ where }),
    ]);
    return {
      hasProfile: true, total, take: query.take, skip: query.skip,
      items: rows.map(row => ({
        memberCode: row.member.memberCode, status: row.member.status,
        sponsoredAt: row.createdAt,
      })),
    };
  }

  /**
   * Milestone 3 — only nodes VISIBLE within requested depth. No full-network
   * or earning-volume claims; LEFT/RIGHT are the first edge below self.
   */
  async myTeamSummary(actor: AuthenticatedUser, depth: number) {
    const organizationId = this.org(actor);
    const profile = await this.prisma.memberProfile.findFirst({
      where: { organizationId, userId: actor.sub },
      select: { id: true, memberCode: true, status: true },
    });
    if (!profile) return {
      hasProfile: false, maxDepth: depth, totalVisibleDescendants: 0,
      left: this.emptyBranch(), right: this.emptyBranch(),
      bounded: true,
    };
    const tree = await this.buildTree(organizationId, profile, depth);
    const left = this.emptyBranch(), right = this.emptyBranch();
    const branchOf = new Map<string, BinarySide>();
    for (const node of tree.nodes) {
      if (node.depth === 0) continue;
      const side = node.depth === 1 ? node.side
        : branchOf.get(node.parentMemberCode ?? '');
      if (!side) throw new ConflictException('Genealogy parent path is inconsistent.');
      branchOf.set(node.memberCode, side);
      const branch = side === BinarySide.LEFT ? left : right;
      branch.visibleDescendants++;
      if (node.depth === 1) branch.directMemberCode = node.memberCode;
      switch (node.status) {
        case MemberEnrollmentStatus.ACTIVE: branch.active++; break;
        case MemberEnrollmentStatus.PENDING_ACTIVATION: branch.pendingActivation++; break;
        case MemberEnrollmentStatus.SUSPENDED: branch.suspended++; break;
      }
    }
    return {
      hasProfile: true, memberCode: profile.memberCode, maxDepth: depth,
      totalVisibleDescendants: tree.nodes.length - 1,
      left, right, bounded: true,
      note: 'Counts include only recorded descendants within the selected depth, not full team or commission volume.',
    };
  }

  private emptyBranch(): {
    directMemberCode: string | null; visibleDescendants: number;
    active: number; pendingActivation: number; suspended: number;
  } {
    return { directMemberCode: null, visibleDescendants: 0,
      active: 0, pendingActivation: 0, suspended: 0 };
  }

  /** Milestone 4 — non-financial, tenant-only staff operational snapshot. */
  async adminOverview(actor: AuthenticatedUser) {
    const organizationId = this.org(actor);
    const [profiles, pins, placements, approvedConsents, enabledPackages] = await Promise.all([
      this.prisma.memberProfile.groupBy({
        by: ['status'], where: { organizationId }, _count: { _all: true },
      }),
      this.prisma.enrollmentPin.groupBy({
        by: ['status'], where: { organizationId }, _count: { _all: true },
      }),
      this.prisma.placementNode.groupBy({
        by: ['side'], where: { organizationId }, _count: { _all: true },
      }),
      this.prisma.memberConsentDocument.count({
        where: { organizationId, status: 'APPROVED' },
      }),
      this.prisma.memberPackage.count({
        where: { organizationId, status: 'ENABLED' },
      }),
    ]);
    const memberCount = (status: MemberEnrollmentStatus) =>
      profiles.find(row => row.status === status)?._count._all ?? 0;
    const pinCount = (status: 'ISSUED'|'REDEEMED'|'REVOKED') =>
      pins.find(row => row.status === status)?._count._all ?? 0;
    const sideCount = (side: BinarySide) =>
      placements.find(row => row.side === side)?._count._all ?? 0;
    return {
      membership: {
        total: profiles.reduce((sum,row) => sum + row._count._all, 0),
        pendingActivation: memberCount(MemberEnrollmentStatus.PENDING_ACTIVATION),
        active: memberCount(MemberEnrollmentStatus.ACTIVE),
        suspended: memberCount(MemberEnrollmentStatus.SUSPENDED),
      },
      placement: { left: sideCount(BinarySide.LEFT), right: sideCount(BinarySide.RIGHT) },
      pins: { issued: pinCount('ISSUED'), redeemed: pinCount('REDEEMED'), revoked: pinCount('REVOKED') },
      approvedConsents, enabledPackages,
      financialBalancesIncluded: false,
      note: 'Tenant-scoped non-financial snapshot. Pending status is not payout or activation approval.',
    };
  }

  async list(actor: AuthenticatedUser, query: MemberListQueryDto) {
    const organizationId = this.org(actor);
    const where = { organizationId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.memberProfile.findMany({
        where, take: query.take, skip: query.skip,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: this.profileSelect,
      }),
      this.prisma.memberProfile.count({ where }),
    ]);
    return { items: rows.map((member) => this.present(member)), total, take: query.take, skip: query.skip };
  }

  private async getByCode(organizationId: string, memberCode: string) {
    if (!memberCode || memberCode.length > 40) throw new NotFoundException('Member not found.');
    const profile = await this.prisma.memberProfile.findUnique({
      where: { organizationId_memberCode: { organizationId, memberCode } },
      select: this.profileSelect,
    });
    if (!profile) throw new NotFoundException('Member not found.');
    return profile;
  }

  async detail(actor: AuthenticatedUser, memberCode: string) {
    const profile = await this.getByCode(this.org(actor), memberCode);
    return this.present(profile);
  }

  async myProfile(actor: AuthenticatedUser) {
    const profile = await this.prisma.memberProfile.findFirst({
      where: { organizationId: this.org(actor), userId: actor.sub },
      select: this.profileSelect,
    });
    if (!profile) throw new NotFoundException('Member profile not found.');
    return this.present(profile);
  }

  async myTree(actor: AuthenticatedUser, depth: number) {
    const organizationId = this.org(actor);
    const profile = await this.prisma.memberProfile.findFirst({
      where: { organizationId, userId: actor.sub },
      select: { id: true, memberCode: true, status: true },
    });
    if (!profile) throw new NotFoundException('Member profile not found.');
    return this.buildTree(organizationId, profile, depth);
  }

  async tree(actor: AuthenticatedUser, memberCode: string, depth: number) {
    const organizationId = this.org(actor);
    const profile = await this.prisma.memberProfile.findUnique({
      where: { organizationId_memberCode: { organizationId, memberCode } },
      select: { id: true, memberCode: true, status: true },
    });
    if (!profile) throw new NotFoundException('Member not found.');
    return this.buildTree(organizationId, profile, depth);
  }

  private async buildTree(organizationId: string, root: {
    id: string; memberCode: string; status: MemberEnrollmentStatus;
  }, depth: number) {
    // Bounded to four levels to prevent large genealogy dumps; a member
    // starts at their own node, never at another member/tenant.
    const nodes: MemberNode[] = [{
      memberCode: root.memberCode, status: root.status, parentMemberCode: null, side: null, depth: 0,
    }];
    const visited = new Set([root.id]);
    let frontier = new Map([[root.id, root.memberCode]]);
    for (let level = 1; level <= depth && frontier.size; level++) {
      const children = await this.prisma.placementNode.findMany({
        where: { organizationId, parentMemberId: { in: [...frontier.keys()] } },
        orderBy: [{ parentMemberId: 'asc' }, { side: 'asc' }],
        select: {
          memberId: true, parentMemberId: true, side: true,
          member: { select: { memberCode: true, status: true } },
        },
      });
      const next = new Map<string, string>();
      for (const row of children) {
        if (visited.has(row.memberId)) throw new ConflictException('Genealogy integrity check failed.');
        visited.add(row.memberId);
        nodes.push({
          memberCode: row.member.memberCode, status: row.member.status,
          parentMemberCode: frontier.get(row.parentMemberId) ?? null, side: row.side, depth: level,
        });
        next.set(row.memberId, row.member.memberCode);
      }
      frontier = next;
    }
    return { rootMemberCode: root.memberCode, maxDepth: depth, nodes };
  }
}
