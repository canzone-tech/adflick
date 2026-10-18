import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FinanceDisputeStatus, LedgerEntryType, PayoutBatchStatus, PayoutItemStatus, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePayoutBatchDto } from './dto/create-payout-batch.dto';
import { PayoutDecisionDto } from './dto/payout-decision.dto';
import { SubmitPayoutDto } from './dto/submit-payout.dto';
import { ReconcilePayoutDto } from './dto/reconcile-payout.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

const READ_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR_COMPLIANCE];
const WRITE_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.FINANCE_MANAGER];
@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}
  private org(actor: AuthenticatedUser, write = false) {
    if (!(write ? WRITE_ROLES : READ_ROLES).some((role) => actor.roles.includes(role))) throw new ForbiddenException('Your role cannot access payout controls.');
    if (!actor.organizationId) throw new ForbiddenException('Organization context is required.');
    return actor.organizationId;
  }
  listBatches(actor: AuthenticatedUser) {
    const organizationId = this.org(actor);
    return this.prisma.payoutBatch.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 200, include: { items: { select: { id: true, amountPaise: true, status: true, ownerUserId: true, ledgerEntryId: true } } } });
  }
  async createBatch(actor: AuthenticatedUser, dto: CreatePayoutBatchDto) {
    const organizationId = this.org(actor, true);
    const ids = dto.items.map((item) => item.ledgerEntryId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Duplicate ledger entry IDs are not allowed in one payout batch.');
    if (dto.items.some((item) => !item.ownerIdentityVerified || !item.kycReviewed || !item.fraudReviewed || !item.taxReviewCompleted)) throw new BadRequestException('Every payout item requires explicit owner identity, KYC, fraud and tax review confirmation.');
    const ledger = await this.prisma.rewardLedgerEntry.findMany({ where: { organizationId, id: { in: ids }, entryType: LedgerEntryType.REWARD_ACCRUAL, amountPaise: { gt: 0 } }, include: { calculation: { select: { status: true, ownerUserId: true } }, payoutItem: true, disputes: { where: { status: { in: [FinanceDisputeStatus.OPEN, FinanceDisputeStatus.UNDER_REVIEW] } }, select: { id: true } } } });
    if (ledger.length !== ids.length) throw new BadRequestException('One or more ledger entries are missing, outside this organization, non-accrual, or not payable.');
    for (const entry of ledger) {
      if (entry.calculation.status !== 'APPROVED' || !entry.calculation.ownerUserId) throw new ConflictException(`Ledger entry ${entry.id} does not have an approved reward and assigned owner.`);
      if (entry.payoutItem) throw new ConflictException(`Ledger entry ${entry.id} has already been assigned to a payout workflow.`);
      if (entry.disputes.length) throw new ConflictException(`Ledger entry ${entry.id} has an unresolved dispute.`);
    }
    const batchReference = `PAY-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${randomUUID().slice(0,8).toUpperCase()}`;
    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payoutBatch.create({ data: { organizationId, batchReference, createdById: actor.sub, providerName: dto.providerName.trim(), totalAmountPaise: ledger.reduce((sum, e) => sum + e.amountPaise, 0), itemCount: ledger.length } });
      await tx.payoutItem.createMany({ data: ledger.map((entry) => {
        const review = dto.items.find((item) => item.ledgerEntryId === entry.id)!;
        return { organizationId, payoutBatchId: created.id, ledgerEntryId: entry.id, ownerUserId: entry.calculation.ownerUserId!, amountPaise: entry.amountPaise, currency: entry.currency, ownerIdentityVerified: review.ownerIdentityVerified, kycReviewed: review.kycReviewed, fraudReviewed: review.fraudReviewed, taxReviewCompleted: review.taxReviewCompleted };
      }) });
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: 'PAYOUT_BATCH_CREATED', entityType: 'PayoutBatch', entityId: created.id, metadataJson: { batchReference, itemCount: ledger.length, totalAmountPaise: created.totalAmountPaise, providerName: dto.providerName } } });
      return created;
    });
    return batch;
  }
  async requestApproval(actor: AuthenticatedUser, id: string) {
    const organizationId = this.org(actor, true);
    const batch = await this.prisma.payoutBatch.findFirst({ where: { id, organizationId }, include: { items: { where: { organizationId } } } });
    if (!batch) throw new NotFoundException('Payout batch not found.');
    if (batch.createdById !== actor.sub) throw new ForbiddenException('Only the batch maker can submit this batch for independent approval.');
    if (batch.status !== PayoutBatchStatus.DRAFT || !batch.items.length) throw new ConflictException('Only a non-empty draft batch can request approval.');
    const unresolved = await this.prisma.financeDispute.count({ where: { organizationId, ledgerEntryId: { in: batch.items.map((i) => i.ledgerEntryId) }, status: { in: [FinanceDisputeStatus.OPEN, FinanceDisputeStatus.UNDER_REVIEW] } } });
    if (unresolved) throw new ConflictException('Payout batch contains unresolved disputes.');
    const updated = await this.prisma.payoutBatch.update({ where: { id, organizationId }, data: { status: PayoutBatchStatus.PENDING_APPROVAL } });
    await this.audit(actor, organizationId, 'PAYOUT_BATCH_APPROVAL_REQUESTED', 'PayoutBatch', id, { itemCount: batch.itemCount, totalAmountPaise: batch.totalAmountPaise });
    return updated;
  }
  async decide(actor: AuthenticatedUser, id: string, dto: PayoutDecisionDto) {
    const organizationId = this.org(actor, true);
    const batch = await this.prisma.payoutBatch.findFirst({ where: { id, organizationId } });
    if (!batch) throw new NotFoundException('Payout batch not found.');
    if (batch.status !== PayoutBatchStatus.PENDING_APPROVAL) throw new ConflictException('Payout batch is not awaiting approval.');
    if (batch.createdById === actor.sub) throw new ForbiddenException('Maker-checker rule: the batch creator cannot approve their own batch.');
    const status = dto.status === 'APPROVED' ? PayoutBatchStatus.APPROVED : PayoutBatchStatus.DRAFT;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payoutBatch.updateMany({ where: { id, organizationId, status: PayoutBatchStatus.PENDING_APPROVAL }, data: { status, approvedById: actor.sub, approvalNote: dto.note?.trim() ?? null } });
      if (result.count !== 1) throw new ConflictException('Payout batch was changed by another request. Refresh and retry.');
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: `PAYOUT_BATCH_${dto.status}`, entityType: 'PayoutBatch', entityId: id, metadataJson: { note: dto.note?.trim() ?? null, totalAmountPaise: batch.totalAmountPaise } } });
      return tx.payoutBatch.findUniqueOrThrow({ where: { id } });
    });
    return updated;
  }
  async exportBatch(actor: AuthenticatedUser, id: string) {
    const organizationId = this.org(actor, true);
    const batch = await this.prisma.payoutBatch.findFirst({ where: { id, organizationId }, include: { items: { where: { organizationId } } } });
    if (!batch) throw new NotFoundException('Payout batch not found.');
    if (![PayoutBatchStatus.APPROVED, PayoutBatchStatus.EXPORTED].some((status) => status === batch.status)) throw new ConflictException('Only an independently approved batch can be exported.');
    const items = await this.prisma.$transaction(async (tx) => {
      if (batch.status === PayoutBatchStatus.APPROVED) {
        await tx.payoutBatch.update({ where: { id, organizationId }, data: { status: PayoutBatchStatus.EXPORTED, exportedAt: new Date() } });
        await tx.payoutItem.updateMany({ where: { payoutBatchId: id, organizationId, status: PayoutItemStatus.PENDING }, data: { status: PayoutItemStatus.EXPORTED } });
        await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: 'PAYOUT_BATCH_EXPORTED', entityType: 'PayoutBatch', entityId: id, metadataJson: { itemCount: batch.itemCount, totalAmountPaise: batch.totalAmountPaise } } });
      }
      return tx.payoutItem.findMany({ where: { payoutBatchId: id, organizationId }, orderBy: { id: 'asc' }, select: { id: true, ownerUserId: true, amountPaise: true, currency: true, ledgerEntryId: true, status: true } });
    });
    // This is a provider-neutral file payload only; no bank/payment API is invoked.
    return { batchReference: batch.batchReference, currency: batch.currency, totalAmountPaise: batch.totalAmountPaise, items };
  }
  async submitToProvider(actor: AuthenticatedUser, id: string, dto: SubmitPayoutDto) {
    const organizationId = this.org(actor, true);
    const batch = await this.prisma.payoutBatch.findFirst({ where: { id, organizationId } });
    if (!batch) throw new NotFoundException('Payout batch not found.');
    if (batch.status !== PayoutBatchStatus.EXPORTED) throw new ConflictException('Export the approved batch before recording provider submission.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payoutBatch.updateMany({ where: { id, organizationId, status: PayoutBatchStatus.EXPORTED }, data: { status: PayoutBatchStatus.SUBMITTED_TO_PROVIDER, providerName: dto.providerName.trim(), providerBatchReference: dto.providerBatchReference.trim(), submittedAt: new Date() } });
      if (result.count !== 1) throw new ConflictException('Batch status changed concurrently.');
      await tx.payoutItem.updateMany({ where: { payoutBatchId: id, organizationId, status: PayoutItemStatus.EXPORTED }, data: { status: PayoutItemStatus.SUBMITTED } });
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: 'PAYOUT_PROVIDER_SUBMISSION_RECORDED', entityType: 'PayoutBatch', entityId: id, metadataJson: { providerName: dto.providerName, providerBatchReference: dto.providerBatchReference } } });
      return tx.payoutBatch.findUniqueOrThrow({ where: { id, organizationId } });
    });
    return updated;
  }
  async reconcile(actor: AuthenticatedUser, id: string, dto: ReconcilePayoutDto) {
    const organizationId = this.org(actor, true);
    const batch = await this.prisma.payoutBatch.findFirst({ where: { id, organizationId }, include: { items: { where: { organizationId } } } });
    if (!batch) throw new NotFoundException('Payout batch not found.');
    if (![PayoutBatchStatus.SUBMITTED_TO_PROVIDER, PayoutBatchStatus.RECONCILIATION_REQUIRED, PayoutBatchStatus.PARTIALLY_RECONCILED].some((status) => status === batch.status)) throw new ConflictException('Batch must be recorded as submitted to the provider before reconciliation.');
    if (new Set(dto.items.map((i) => i.payoutItemId)).size !== dto.items.length) throw new BadRequestException('Duplicate payout item IDs in reconciliation input.');
    const batchIds = new Set(batch.items.map((i) => i.id));
    if (dto.items.some((i) => !batchIds.has(i.payoutItemId))) throw new BadRequestException('Every reconciled item must belong to this payout batch.');
    const ledgerIds = batch.items.filter((i) => dto.items.some((submitted) => submitted.payoutItemId === i.id)).map((i) => i.ledgerEntryId);
    const activeDisputes = await this.prisma.financeDispute.findMany({ where: { organizationId, ledgerEntryId: { in: ledgerIds }, status: { in: [FinanceDisputeStatus.OPEN, FinanceDisputeStatus.UNDER_REVIEW] } }, select: { ledgerEntryId: true } });
    if (activeDisputes.length) throw new ConflictException('Resolve active finance disputes before reconciling affected payout items.');
    const result = await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const existing = batch.items.find((x) => x.id === item.payoutItemId)!;
        if ([PayoutItemStatus.PAID, PayoutItemStatus.REVERSED].some((status) => status === existing.status)) throw new ConflictException(`Payout item ${item.payoutItemId} is already terminal and cannot be overwritten.`);
        if (item.status === 'PAID' && !item.providerReference?.trim()) throw new BadRequestException('A provider transaction reference is required for a PAID reconciliation result.');
        // Stronger than the legacy tenant predicate `where: { id: item.payoutItemId, organizationId }`: also bind batch and exclude terminal states.
        const changed = await tx.payoutItem.updateMany({
          where: {
            id: item.payoutItemId, payoutBatchId: id, organizationId,
            status: { notIn: [PayoutItemStatus.PAID, PayoutItemStatus.REVERSED] },
          },
          data: { status: item.status, providerReference: item.providerReference?.trim(), reconciliationNote: item.note?.trim(), reconciledAt: new Date() },
        });
        if (changed.count !== 1) throw new ConflictException(`Payout item ${item.payoutItemId} changed concurrently or is already terminal. Refresh and retry.`);
      }
      const all = await tx.payoutItem.findMany({ where: { payoutBatchId: id, organizationId } });
      const done = all.every((i) => [PayoutItemStatus.PAID, PayoutItemStatus.FAILED, PayoutItemStatus.HELD, PayoutItemStatus.DISPUTED, PayoutItemStatus.REVERSED].some((status) => status === i.status));
      const paid = all.filter((i) => i.status === PayoutItemStatus.PAID).length;
      const anyUpdated = dto.items.length > 0;
      const next = done ? (paid === all.length ? PayoutBatchStatus.RECONCILED : PayoutBatchStatus.PARTIALLY_RECONCILED) : PayoutBatchStatus.RECONCILIATION_REQUIRED;
      // Do not let a stale reconciliation overwrite a batch transition committed by another request.
      // If this conditional transition loses the race, throwing rolls back the item updates and audit.
      const batchTransition = await tx.payoutBatch.updateMany({
        where: {
          id, organizationId,
          status: { in: [PayoutBatchStatus.SUBMITTED_TO_PROVIDER, PayoutBatchStatus.RECONCILIATION_REQUIRED, PayoutBatchStatus.PARTIALLY_RECONCILED] },
        },
        data: { status: next, reconciledAt: done ? new Date() : null },
      });
      if (batchTransition.count !== 1) throw new ConflictException('Payout batch changed concurrently during reconciliation. No reconciliation changes were committed.');
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: 'PAYOUT_BATCH_RECONCILED', entityType: 'PayoutBatch', entityId: id, metadataJson: { changedItems: dto.items.length, paidItems: paid, totalItems: all.length, complete: done, anyUpdated } } });
      return tx.payoutBatch.findUniqueOrThrow({ where: { id, organizationId } });
    });
    return result;
  }
  listDisputes(actor: AuthenticatedUser) {
    const organizationId = this.org(actor);
    return this.prisma.financeDispute.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 300, include: { ledgerEntry: { select: { id: true, amountPaise: true, currency: true, description: true, payoutItem: { select: { id: true, status: true } } } } } });
  }
  async createDispute(actor: AuthenticatedUser, dto: CreateDisputeDto) {
    const organizationId = this.org(actor, true);
    const ledger = await this.prisma.rewardLedgerEntry.findFirst({ where: { id: dto.ledgerEntryId, organizationId } });
    if (!ledger) throw new NotFoundException('Ledger entry not found.');
    const duplicate = await this.prisma.financeDispute.findFirst({ where: { organizationId, ledgerEntryId: ledger.id, status: { in: [FinanceDisputeStatus.OPEN, FinanceDisputeStatus.UNDER_REVIEW] } } });
    if (duplicate) throw new ConflictException('An unresolved dispute already exists for this ledger entry.');
    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.financeDispute.create({ data: { organizationId, ledgerEntryId: ledger.id, openedById: actor.sub, reasonCode: dto.reasonCode.trim(), description: dto.description.trim() } });
      await tx.payoutItem.updateMany({ where: { organizationId, ledgerEntryId: ledger.id, status: { in: [PayoutItemStatus.PENDING, PayoutItemStatus.EXPORTED, PayoutItemStatus.SUBMITTED, PayoutItemStatus.HELD] } }, data: { status: PayoutItemStatus.DISPUTED } });
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: 'FINANCE_DISPUTE_OPENED', entityType: 'FinanceDispute', entityId: created.id, metadataJson: { ledgerEntryId: ledger.id, reasonCode: dto.reasonCode } } });
      return created;
    });
    return dispute;
  }
  async resolveDispute(actor: AuthenticatedUser, id: string, dto: ResolveDisputeDto) {
    const organizationId = this.org(actor, true);
    const dispute = await this.prisma.financeDispute.findFirst({ where: { id, organizationId } });
    if (!dispute) throw new NotFoundException('Finance dispute not found.');
    if ([FinanceDisputeStatus.RESOLVED_OWNER_FAVOUR, FinanceDisputeStatus.RESOLVED_ORGANIZATION_FAVOUR, FinanceDisputeStatus.CLOSED].some((status) => status === dispute.status)) throw new ConflictException('Dispute is already resolved or closed.');
    if (dto.status !== 'UNDER_REVIEW' && dto.note.trim().length < 10) throw new BadRequestException('A resolution note of at least 10 characters is required.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.financeDispute.update({ where: { id, organizationId }, data: { status: dto.status, resolutionNote: dto.note.trim(), ...(dto.status === 'UNDER_REVIEW' ? {} : { resolvedById: actor.sub, resolvedAt: new Date() }) } });
      await tx.auditEvent.create({ data: { actorUserId: actor.sub, organizationId, action: `FINANCE_DISPUTE_${dto.status}`, entityType: 'FinanceDispute', entityId: id, metadataJson: { ledgerEntryId: dispute.ledgerEntryId, note: dto.note.trim() } } });
      return row;
    });
    return updated;
  }
}
