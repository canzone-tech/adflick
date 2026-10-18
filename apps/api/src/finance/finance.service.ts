import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FinanceApprovalStatus, LedgerEntryType, PlaybackEventStatus, PlaybackEventType, RewardCalculationStatus, RewardDeviceType, ScreenStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UpsertRewardPolicyDto } from './dto/upsert-reward-policy.dto';
import { CalculateRewardsDto } from './dto/calculate-rewards.dto';
import { DecisionDto } from './dto/decision.dto';

const READ_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR_COMPLIANCE];
const WRITE_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.FINANCE_MANAGER];
@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}
  private org(actor: AuthenticatedUser, write = false) {
    if (!(write ? WRITE_ROLES : READ_ROLES).some((r) => actor.roles.includes(r))) throw new ForbiddenException('Your role cannot access finance controls.');
    if (!actor.organizationId) throw new ForbiddenException('Select an organization context before using finance controls.');
    return actor.organizationId;
  }
  async getPolicy(actor: AuthenticatedUser) {
    const organizationId = this.org(actor);
    return this.prisma.rewardPolicy.findUnique({ where: { organizationId } });
  }
  async upsertPolicy(actor: AuthenticatedUser, dto: UpsertRewardPolicyDto) {
    const organizationId = this.org(actor, true);
    const existing = await this.prisma.rewardPolicy.findUnique({ where: { organizationId } });
    const data = { ...dto };
    const result = existing
      ? await this.prisma.rewardPolicy.update({ where: { organizationId }, data })
      : await this.prisma.rewardPolicy.create({ data: { organizationId, ...data } });
    await this.prisma.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: 'REWARD_POLICY_UPDATED', entityType: 'RewardPolicy', entityId: result.id, metadataJson: { enabled: result.enabled, tvMinimumValidPlays: result.tvMinimumValidPlays, smartphoneMinimumValidPlays: result.smartphoneMinimumValidPlays, tvMonthlyAmountPaise: result.tvMonthlyAmountPaise, smartphoneMonthlyAmountPaise: result.smartphoneMonthlyAmountPaise } } });
    return result;
  }
  async calculate(actor: AuthenticatedUser, dto: CalculateRewardsDto) {
    const organizationId = this.org(actor, true);
    const start = new Date(dto.periodStart); const end = new Date(dto.periodEnd);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) throw new BadRequestException('periodStart must be earlier than periodEnd.');
    const policy = await this.prisma.rewardPolicy.findUnique({ where: { organizationId } });
    if (!policy || !policy.enabled) throw new ConflictException('Reward policy is missing or disabled. Configure and enable it before calculating eligibility.');
    if (start < policy.effectiveFrom) throw new BadRequestException('Reward period starts before the current policy effective date.');
    const screens = await this.prisma.screen.findMany({ where: { organizationId, status: { notIn: [ScreenStatus.RETIRED, ScreenStatus.SUSPENDED] } }, select: { id: true, name: true, ownerUserId: true, platform: true, devicePlatform: true, status: true, lastHeartbeatAt: true } });
    const output: any[] = [];
    for (const screen of screens) {
      const platform = `${screen.platform} ${screen.devicePlatform ?? ''}`.toLowerCase();
      const isSmartphone = /(phone|mobile|smartphone|android handheld|ios)/.test(platform);
      const isTv = /(tv|television|tizen|webos|android tv|smart tv|signage display)/.test(platform);
      const deviceType = isSmartphone ? RewardDeviceType.SMARTPHONE : RewardDeviceType.TV;
      const required = deviceType === RewardDeviceType.TV ? policy.tvMinimumValidPlays : policy.smartphoneMinimumValidPlays;
      const amount = deviceType === RewardDeviceType.TV ? policy.tvMonthlyAmountPaise : policy.smartphoneMonthlyAmountPaise;
      const events = await this.prisma.playbackEvent.findMany({ where: { organizationId, screenId: screen.id, status: PlaybackEventStatus.ACCEPTED, eventType: PlaybackEventType.PLAY_COMPLETED, completedAt: { gte: start, lt: end } }, select: { campaignId: true } });
      const plays = events.length;
      const campaignPlays = events.filter((e) => Boolean(e.campaignId)).length;
      const coverage = plays ? Math.floor(campaignPlays * 100 / plays) : 0;
      let reasonCode = 'ELIGIBLE'; let reasonDetail = 'Playback count and configured campaign coverage thresholds were met; manual fraud review and finance approval are still required.';
      let status: RewardCalculationStatus = RewardCalculationStatus.ELIGIBLE; let payable = amount;
      if (!screen.ownerUserId) { status = RewardCalculationStatus.INELIGIBLE; reasonCode = 'NO_OWNER'; reasonDetail = 'Screen has no assigned owner.'; payable = 0; }
      else if (!isSmartphone && !isTv) { status = RewardCalculationStatus.ON_HOLD; reasonCode = 'DEVICE_TYPE_UNVERIFIED'; reasonDetail = 'Device platform cannot be confidently classified as TV or smartphone; verify device type before reward review.'; payable = 0; }
      else if (plays < required) { status = RewardCalculationStatus.INELIGIBLE; reasonCode = 'PLAY_TARGET_NOT_MET'; reasonDetail = `Observed ${plays} accepted completed plays; ${required} required.`; payable = 0; }
      else if (coverage < policy.minimumCampaignCoveragePercent) { status = RewardCalculationStatus.INELIGIBLE; reasonCode = 'CAMPAIGN_COVERAGE_NOT_MET'; reasonDetail = `Campaign-linked play coverage ${coverage}% is below required ${policy.minimumCampaignCoveragePercent}%.`; payable = 0; }
      else if (policy.minimumDeviceUptimePercent > 0) { status = RewardCalculationStatus.ON_HOLD; reasonCode = 'UPTIME_EVIDENCE_UNAVAILABLE'; reasonDetail = 'Reliable period-wide uptime evidence is not implemented; manual review required. No reward is approved.'; payable = 0; }
      const prior = await this.prisma.rewardCalculation.findUnique({ where: { screenId_periodStart_periodEnd: { screenId: screen.id, periodStart: start, periodEnd: end } } });
      if (prior && [RewardCalculationStatus.PENDING_APPROVAL, RewardCalculationStatus.APPROVED, RewardCalculationStatus.REJECTED, RewardCalculationStatus.REVERSED].includes(prior.status)) {
        output.push(prior);
        continue;
      }
      const policySnapshotJson = { policyId: policy.id, policyEffectiveFrom: policy.effectiveFrom.toISOString(), tvMonthlyAmountPaise: policy.tvMonthlyAmountPaise, smartphoneMonthlyAmountPaise: policy.smartphoneMonthlyAmountPaise, tvMinimumValidPlays: policy.tvMinimumValidPlays, smartphoneMinimumValidPlays: policy.smartphoneMinimumValidPlays, minimumCampaignCoveragePercent: policy.minimumCampaignCoveragePercent, minimumDeviceUptimePercent: policy.minimumDeviceUptimePercent };
      const record = await this.prisma.rewardCalculation.upsert({ where: { screenId_periodStart_periodEnd: { screenId: screen.id, periodStart: start, periodEnd: end } }, create: { organizationId, screenId: screen.id, ownerUserId: screen.ownerUserId, periodStart: start, periodEnd: end, deviceType, validCompletedPlays: plays, requiredCompletedPlays: required, campaignCoveragePercent: coverage, amountPaise: payable, status, reasonCode, reasonDetail, policySnapshotJson, createdById: actor.sub }, update: { ownerUserId: screen.ownerUserId, deviceType, validCompletedPlays: plays, requiredCompletedPlays: required, campaignCoveragePercent: coverage, amountPaise: payable, status, reasonCode, reasonDetail, policySnapshotJson, createdById: actor.sub } });
      output.push(record);
    }
    await this.prisma.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: 'REWARD_ELIGIBILITY_CALCULATED', entityType: 'RewardCalculationPeriod', entityId: `${start.toISOString()}_${end.toISOString()}`.slice(0, 80), metadataJson: { periodStart: start.toISOString(), periodEnd: end.toISOString(), records: output.length, eligible: output.filter((r) => r.status === 'ELIGIBLE').length, totalCandidatePaise: output.filter((r) => r.status === 'ELIGIBLE').reduce((sum, r) => sum + r.amountPaise, 0) } } });
    return { periodStart: start, periodEnd: end, records: output.length, eligible: output.filter((r) => r.status === 'ELIGIBLE').length, held: output.filter((r) => r.status === 'ON_HOLD').length, ineligible: output.filter((r) => r.status === 'INELIGIBLE').length, calculations: output };
  }
  listRewards(actor: AuthenticatedUser) { const organizationId = this.org(actor); return this.prisma.rewardCalculation.findMany({ where: { organizationId }, orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }], take: 300, include: { screen: { select: { id: true, name: true, platform: true, ownerUserId: true } }, approvals: { orderBy: { createdAt: 'desc' }, take: 3 } } }); }
  async requestApproval(actor: AuthenticatedUser, id: string) {
    const organizationId = this.org(actor, true);
    const calc = await this.prisma.rewardCalculation.findFirst({ where: { id, organizationId } });
    if (!calc) throw new NotFoundException('Reward calculation not found.');
    if (calc.status !== RewardCalculationStatus.ELIGIBLE || calc.amountPaise <= 0) throw new ConflictException('Only positive eligible calculations can be submitted for approval.');
    const existing = await this.prisma.financeApproval.findFirst({ where: { organizationId, rewardCalculationId: id, status: FinanceApprovalStatus.PENDING } });
    if (existing) return existing;
    const requestKey = `reward-approval:${id}`;
    const approval = await this.prisma.financeApproval.create({ data: { organizationId, rewardCalculationId: id, requestedById: actor.sub, requestKey } });
    await this.prisma.rewardCalculation.update({ where: { id, organizationId }, data: { status: RewardCalculationStatus.PENDING_APPROVAL } });
    await this.prisma.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: 'REWARD_APPROVAL_REQUESTED', entityType: 'RewardCalculation', entityId: id, metadataJson: { approvalId: approval.id, amountPaise: calc.amountPaise } } });
    return approval;
  }
  listApprovals(actor: AuthenticatedUser) { const organizationId = this.org(actor); return this.prisma.financeApproval.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 300, include: { calculation: { include: { screen: { select: { id: true, name: true } } } }, requestedBy: { select: { id: true, displayName: true, email: true } }, decidedBy: { select: { id: true, displayName: true, email: true } } } }); }
  async decide(actor: AuthenticatedUser, id: string, dto: DecisionDto) {
    const organizationId = this.org(actor, true);
    const approval = await this.prisma.financeApproval.findFirst({ where: { id, organizationId }, include: { calculation: true } });
    if (!approval) throw new NotFoundException('Finance approval request not found.');
    if (approval.status !== FinanceApprovalStatus.PENDING) throw new ConflictException('This approval request has already been decided.');
    if (approval.requestedById === actor.sub) throw new ForbiddenException('Maker-checker rule: the requester cannot approve or reject their own request.');
    if (dto.status === 'APPROVED' && approval.calculation.status !== RewardCalculationStatus.PENDING_APPROVAL) throw new ConflictException('Reward calculation is not pending approval.');
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedApproval = await tx.financeApproval.update({ where: { id, organizationId }, data: { status: dto.status === 'ON_HOLD' ? FinanceApprovalStatus.CANCELLED : dto.status, decidedById: actor.sub, decisionNote: dto.note?.trim(), decidedAt: new Date() } });
      let calculationStatus: RewardCalculationStatus = dto.status === 'APPROVED' ? RewardCalculationStatus.APPROVED : dto.status === 'REJECTED' ? RewardCalculationStatus.REJECTED : RewardCalculationStatus.ON_HOLD;
      await tx.rewardCalculation.update({ where: { id: approval.rewardCalculationId, organizationId }, data: { status: calculationStatus, ...(dto.status === 'APPROVED' ? { approvedAt: new Date() } : {}) } });
      if (dto.status === 'APPROVED') {
        await tx.rewardLedgerEntry.create({ data: { organizationId, rewardCalculationId: approval.rewardCalculationId, entryType: LedgerEntryType.REWARD_ACCRUAL, amountPaise: approval.calculation.amountPaise, idempotencyKey: `reward-accrual:${approval.rewardCalculationId}`, description: `Approved owner reward accrual for ${approval.calculation.periodStart.toISOString()} to ${approval.calculation.periodEnd.toISOString()}`, createdById: actor.sub } });
      }
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: `REWARD_APPROVAL_${dto.status}`, entityType: 'FinanceApproval', entityId: id, metadataJson: { rewardCalculationId: approval.rewardCalculationId, amountPaise: approval.calculation.amountPaise, note: dto.note?.trim() ?? null } } });
      return updatedApproval;
    });
    return result;
  }
  ledger(actor: AuthenticatedUser) { const organizationId = this.org(actor); return this.prisma.rewardLedgerEntry.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 500, include: { calculation: { select: { id: true, screenId: true, ownerUserId: true, periodStart: true, periodEnd: true, status: true } } } }); }
}
