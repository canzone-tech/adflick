import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, AssetStatus, ScreenStatus, UserRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

const reviewRoles = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER];
const manageRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.ADVERTISER, UserRole.CONTENT_MANAGER, UserRole.OPERATIONS_MANAGER];

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  private org(actor: AuthenticatedUser) {
    if (!actor.organizationId) throw new ForbiddenException('Select an organization context before managing campaigns.');
    return actor.organizationId;
  }
  private has(actor: AuthenticatedUser, roles: UserRole[]) { return actor.roles.some((r) => roles.includes(r as UserRole)); }
  private canReview(actor: AuthenticatedUser) { return this.has(actor, reviewRoles); }
  private async validateSchedule(startsAt?: string | Date | null, endsAt?: string | Date | null) {
    if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      throw new BadRequestException('Campaign end time must be after its start time.');
    }
  }
  private async validateAssets(orgId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length || unique.length !== ids.length) throw new BadRequestException('At least one unique creative asset is required.');
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: unique }, organizationId: orgId, status: AssetStatus.READY },
      select: { id: true },
    });
    if (assets.length !== unique.length) throw new BadRequestException('Every creative must be READY and belong to this organization.');
    return unique;
  }
  private async validateScreens(orgId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) throw new BadRequestException('Duplicate screen targets are not allowed.');
    if (!unique.length) return unique;
    const screens = await this.prisma.screen.findMany({
      where: { id: { in: unique }, organizationId: orgId, status: { not: ScreenStatus.RETIRED } },
      select: { id: true },
    });
    if (screens.length !== unique.length) throw new BadRequestException('Every target screen must exist in this organization and not be retired.');
    return unique;
  }
  private async replaceAssociations(campaignId: string, orgId: string, creativeIds?: string[], screenIds?: string[]) {
    if (creativeIds) {
      const ids = await this.validateAssets(orgId, creativeIds);
      await this.prisma.$transaction([
        this.prisma.campaignCreative.deleteMany({ where: { campaignId } }),
        this.prisma.campaignCreative.createMany({ data: ids.map((assetId, sortOrder) => ({ campaignId, assetId, sortOrder })) }),
      ]);
    }
    if (screenIds) {
      const ids = await this.validateScreens(orgId, screenIds);
      await this.prisma.$transaction([
        this.prisma.campaignScreenTarget.deleteMany({ where: { campaignId } }),
        ...(ids.length ? [this.prisma.campaignScreenTarget.createMany({ data: ids.map((screenId) => ({ campaignId, screenId })) })] : []),
      ]);
    }
  }
  private visibility(actor: AuthenticatedUser, orgId: string): Prisma.CampaignWhereInput {
    const where: Prisma.CampaignWhereInput = { organizationId: orgId };
    if (actor.roles.includes(UserRole.ADVERTISER) && !this.has(actor, [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER])) {
      where.createdById = actor.sub;
    }
    return where;
  }
  async list(actor: AuthenticatedUser) {
    if (!this.has(actor, manageRoles.concat([UserRole.FINANCE_MANAGER, UserRole.AUDITOR_COMPLIANCE]))) throw new ForbiddenException();
    const orgId = this.org(actor);
    const where = this.visibility(actor, orgId);
    return this.prisma.campaign.findMany({
      where, orderBy: { updatedAt: 'desc' }, take: 200,
      include: { creatives: { include: { asset: { select: { id: true, title: true, mimeType: true, durationMs: true, status: true } } }, orderBy: { sortOrder: 'asc' } }, screenTargets: { include: { screen: { select: { id: true, name: true, status: true, platform: true } } } } },
    });
  }
  async get(actor: AuthenticatedUser, id: string) {
    const orgId = this.org(actor);
    const row = await this.prisma.campaign.findFirst({
      where: { id, ...this.visibility(actor, orgId) },
      include: { creatives: { include: { asset: { select: { id: true, title: true, mimeType: true, durationMs: true, status: true } } }, orderBy: { sortOrder: 'asc' } }, screenTargets: { include: { screen: { select: { id: true, name: true, status: true, platform: true } } } } },
    });
    if (!row) throw new NotFoundException('Campaign not found.');
    return row;
  }
  async create(actor: AuthenticatedUser, dto: CreateCampaignDto) {
    if (!this.has(actor, manageRoles)) throw new ForbiddenException();
    const orgId = this.org(actor);
    if (actor.roles.includes(UserRole.ADVERTISER) && !this.has(actor, [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.CONTENT_MANAGER, UserRole.OPERATIONS_MANAGER])) {
      // Advertisers may create campaigns, but review is still required.
    }
    await this.validateSchedule(dto.startsAt, dto.endsAt);
    if (dto.currency && !/^[A-Z]{3}$/.test(dto.currency)) throw new BadRequestException('Currency must be a three-letter uppercase code.');
    const creativeIds = await this.validateAssets(orgId, dto.creativeAssetIds);
    const screenIds = await this.validateScreens(orgId, dto.screenIds ?? []);
    const campaign = await this.prisma.campaign.create({
      data: {
        organizationId: orgId, createdById: actor.sub, name: dto.name.trim(), description: dto.description?.trim(),
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined, endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        budgetPaise: dto.budgetPaise === undefined ? undefined : BigInt(dto.budgetPaise), currency: dto.currency ?? 'INR',
        status: CampaignStatus.DRAFT,
        creatives: { create: creativeIds.map((assetId, sortOrder) => ({ assetId, sortOrder })) },
        ...(screenIds.length ? { screenTargets: { create: screenIds.map((screenId) => ({ screenId })) } } : {}),
      },
      include: { creatives: { include: { asset: { select: { id: true, title: true, mimeType: true, durationMs: true } } } }, screenTargets: { include: { screen: { select: { id: true, name: true, status: true } } } } },
    });
    return campaign;
  }
  async update(actor: AuthenticatedUser, id: string, dto: UpdateCampaignDto) {
    if (!this.has(actor, manageRoles)) throw new ForbiddenException();
    const orgId = this.org(actor);
    const current = await this.prisma.campaign.findFirst({ where: { id, ...this.visibility(actor, orgId) } });
    if (!current) throw new NotFoundException('Campaign not found.');
    if (!new Set<CampaignStatus>([CampaignStatus.DRAFT, CampaignStatus.REJECTED]).has(current.status)) throw new BadRequestException('Only draft or rejected campaigns can be edited.');
    const startsAt = dto.startsAt === undefined ? current.startsAt : new Date(dto.startsAt);
    const endsAt = dto.endsAt === undefined ? current.endsAt : new Date(dto.endsAt);
    await this.validateSchedule(startsAt, endsAt);
    if (dto.currency && !/^[A-Z]{3}$/.test(dto.currency)) throw new BadRequestException('Currency must be a three-letter uppercase code.');
    if (dto.creativeAssetIds) await this.validateAssets(orgId, dto.creativeAssetIds);
    if (dto.screenIds) await this.validateScreens(orgId, dto.screenIds);
    const data: Prisma.CampaignUpdateInput = {
      name: dto.name?.trim(), description: dto.description?.trim(),
      startsAt: dto.startsAt === undefined ? undefined : new Date(dto.startsAt),
      endsAt: dto.endsAt === undefined ? undefined : new Date(dto.endsAt),
      budgetPaise: dto.budgetPaise === undefined ? undefined : BigInt(dto.budgetPaise),
      currency: dto.currency, status: current.status === CampaignStatus.REJECTED ? CampaignStatus.DRAFT : undefined,
      reviewNote: current.status === CampaignStatus.REJECTED ? null : undefined,
    };
    await this.prisma.campaign.update({ where: { id, organizationId: orgId }, data });
    await this.replaceAssociations(id, orgId, dto.creativeAssetIds, dto.screenIds);
    return this.get(actor, id);
  }
  async submit(actor: AuthenticatedUser, id: string) {
    if (!this.has(actor, manageRoles)) throw new ForbiddenException();
    const current = await this.prisma.campaign.findFirst({ where: { id, ...this.visibility(actor, this.org(actor)) }, include: { creatives: true } });
    if (!current) throw new NotFoundException('Campaign not found.');
    if (!new Set<CampaignStatus>([CampaignStatus.DRAFT, CampaignStatus.REJECTED]).has(current.status)) throw new BadRequestException('Only draft or rejected campaigns can be submitted.');
    if (!current.creatives.length) throw new BadRequestException('Add at least one approved media asset before submitting.');
    await this.validateSchedule(current.startsAt, current.endsAt);
    return this.prisma.campaign.update({ where: { id, organizationId: current.organizationId }, data: { status: CampaignStatus.PENDING_REVIEW, submittedAt: new Date(), reviewNote: null } });
  }
  async approve(actor: AuthenticatedUser, id: string, note: string) {
    if (!this.canReview(actor)) throw new ForbiddenException('Only authorized campaign reviewers may approve campaigns.');
    const current = await this.prisma.campaign.findFirst({ where: { id, organizationId: this.org(actor) } });
    if (!current) throw new NotFoundException('Campaign not found.');
    if (current.status !== CampaignStatus.PENDING_REVIEW) throw new BadRequestException('Campaign must be pending review.');
    return this.prisma.campaign.update({ where: { id, organizationId: current.organizationId }, data: { status: CampaignStatus.APPROVED, reviewedAt: new Date(), reviewedById: actor.sub, reviewNote: note.trim() || 'Approved' } });
  }
  async reject(actor: AuthenticatedUser, id: string, note: string) {
    if (!this.canReview(actor)) throw new ForbiddenException('Only authorized campaign reviewers may reject campaigns.');
    if (!note.trim()) throw new BadRequestException('A rejection reason is required.');
    const current = await this.prisma.campaign.findFirst({ where: { id, organizationId: this.org(actor) } });
    if (!current) throw new NotFoundException('Campaign not found.');
    if (current.status !== CampaignStatus.PENDING_REVIEW) throw new BadRequestException('Campaign must be pending review.');
    return this.prisma.campaign.update({ where: { id, organizationId: current.organizationId }, data: { status: CampaignStatus.REJECTED, reviewedAt: new Date(), reviewedById: actor.sub, reviewNote: note.trim() } });
  }
  async schedule(actor: AuthenticatedUser, id: string) {
    if (!this.has(actor, [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER])) throw new ForbiddenException();
    const current = await this.prisma.campaign.findFirst({ where: { id, organizationId: this.org(actor) } });
    if (!current) throw new NotFoundException('Campaign not found.');
    if (current.status !== CampaignStatus.APPROVED) throw new BadRequestException('Only approved campaigns can be scheduled.');
    if (!current.startsAt || !current.endsAt) throw new BadRequestException('Set both start and end times before scheduling.');
    await this.validateSchedule(current.startsAt, current.endsAt);
    if (current.endsAt <= new Date()) throw new BadRequestException('Campaign end time must be in the future.');
    return this.prisma.campaign.update({ where: { id, organizationId: current.organizationId }, data: { status: current.startsAt <= new Date() ? CampaignStatus.ACTIVE : CampaignStatus.SCHEDULED } });
  }
  async transition(actor: AuthenticatedUser, id: string, action: 'pause'|'resume'|'complete') {
    if (!this.has(actor, [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER])) throw new ForbiddenException();
    const current = await this.prisma.campaign.findFirst({ where: { id, organizationId: this.org(actor) } });
    if (!current) throw new NotFoundException('Campaign not found.');
    const now = new Date();
    let status: CampaignStatus;
    if (action === 'pause' && new Set<CampaignStatus>([CampaignStatus.ACTIVE, CampaignStatus.SCHEDULED]).has(current.status)) status = CampaignStatus.PAUSED;
    else if (action === 'resume' && current.status === CampaignStatus.PAUSED) status = current.startsAt && current.startsAt > now ? CampaignStatus.SCHEDULED : CampaignStatus.ACTIVE;
    else if (action === 'complete' && new Set<CampaignStatus>([CampaignStatus.ACTIVE, CampaignStatus.PAUSED, CampaignStatus.SCHEDULED]).has(current.status)) status = CampaignStatus.COMPLETED;
    else throw new BadRequestException(`Cannot ${action} a campaign in ${current.status} state.`);
    return this.prisma.campaign.update({ where: { id, organizationId: current.organizationId }, data: { status } });
  }
}
