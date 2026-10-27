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
