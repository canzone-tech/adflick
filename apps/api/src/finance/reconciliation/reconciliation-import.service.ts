import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/decorators/current-user.decorator';
import { ReserveReconciliationImportDto } from '../dto/reserve-reconciliation-import.dto';
import { reserveReconciliationImport } from './reconciliation-import-idempotency';
import { PrismaReconciliationImportStore } from './prisma-reconciliation-import-store';
import { parseReconciliationCsv } from '../providers/provider-safety';
import { matchStatementRows } from '../providers/reconciliation-match';
import { classifyReconciliationFailure } from './reconciliation-import-observability';

const IMPORT_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.FINANCE_MANAGER];

@Injectable()
export class ReconciliationImportService {
  constructor(private readonly store: PrismaReconciliationImportStore) {}

  private readOrganization(actor: AuthenticatedUser) {
    const readRoles = [...IMPORT_ROLES, UserRole.AUDITOR_COMPLIANCE];
    if (!readRoles.some(role => actor.roles.includes(role))) throw new ForbiddenException('Your role cannot read reconciliation imports.');
    if (!actor.organizationId) throw new ForbiddenException('Organization context is required.');
    return actor.organizationId;
  }

  async getImport(actor: AuthenticatedUser, importId: string) {
    const organizationId = this.readOrganization(actor);
    const record = await this.store.prisma.reconciliationImport.findFirst({
      where: { id: importId, organizationId },
      select: {
        id: true, organizationId: true, providerName: true, idempotencyKey: true,
        status: true, rowCount: true, matchedCount: true, discrepancyCount: true,
        lastErrorCode: true, attemptCount: true, createdAt: true, updatedAt: true, completedAt: true,
      },
    });
    if (!record) throw new NotFoundException('Reconciliation import not found.');
    return record;
  }

  async getImportRows(actor: AuthenticatedUser, importId: string, rawLimit?: string, rawOffset?: string) {
    const organizationId = this.readOrganization(actor);
    const limit = rawLimit === undefined ? 100 : Number(rawLimit);
    const offset = rawOffset === undefined ? 0 : Number(rawOffset);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new BadRequestException('limit must be an integer between 1 and 200.');
    if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) throw new BadRequestException('offset must be an integer between 0 and 100000.');
    const exists = await this.store.prisma.reconciliationImport.findFirst({
      where: { id: importId, organizationId }, select: { id: true },
    });
    if (!exists) throw new NotFoundException('Reconciliation import not found.');
    const [rows, total] = await Promise.all([
      this.store.prisma.reconciliationImportRow.findMany({
        where: { importId, organizationId }, orderBy: { rowNumber: 'asc' }, skip: offset, take: limit,
        select: { id: true, rowNumber: true, providerReference: true, payoutReference: true, amountPaise: true, currency: true, statementStatus: true, outcome: true, detail: true, createdAt: true },
      }),
      this.store.prisma.reconciliationImportRow.count({ where: { importId, organizationId } }),
    ]);
    return { importId, limit, offset, total, rows };
  }

  async reserve(actor: AuthenticatedUser, dto: ReserveReconciliationImportDto) {
    if (!IMPORT_ROLES.some(role => actor.roles.includes(role))) throw new ForbiddenException('Your role cannot import reconciliation statements.');
    if (!actor.organizationId) throw new ForbiddenException('Organization context is required.');
    if (Buffer.byteLength(dto.payload, 'utf8') > 10_000_000) throw new BadRequestException('Statement exceeds 10 MB limit.');
    const result = await reserveReconciliationImport(this.store, {
      organizationId: actor.organizationId,
      providerName: dto.providerName,
      idempotencyKey: dto.idempotencyKey,
      rawPayload: dto.payload,
      createdById: actor.sub,
    });
    if (result.outcome === 'PAYLOAD_CONFLICT') throw new ConflictException('IDEMPOTENCY_KEY_PAYLOAD_CONFLICT');
    if (result.outcome === 'IN_PROGRESS') throw new ConflictException({ code: 'RECONCILIATION_IMPORT_IN_PROGRESS', importId: result.importId });
    return result;
  }

  async process(actor: AuthenticatedUser, dto: ReserveReconciliationImportDto) {
    const reservation = await this.reserve(actor, dto);
    if (reservation.outcome !== 'CREATED' && reservation.outcome !== 'RECOVERABLE') return reservation;

    const organizationId = actor.organizationId!;
    const importId = reservation.importId;
    const processingToken = randomUUID();
    const now = new Date();
    const claimed = await this.store.prisma.reconciliationImport.updateMany({
      where: { id: importId, organizationId, OR: [
        { status: 'RECEIVED' },
        { status: 'PROCESSING', processingLeaseUntil: { lte: now } },
      ] },
      data: { status: 'PROCESSING', processingToken, processingLeaseUntil: new Date(now.getTime() + 5 * 60_000), attemptCount: { increment: 1 }, lastErrorCode: null },
    });
    if (claimed.count !== 1) return { outcome: 'IN_PROGRESS', importId };
    try {
      const rows = parseReconciliationCsv(dto.payload);
      const payoutIds = [...new Set(rows.map(row => row.payoutReference))];
      const expectedItems = await this.store.prisma.payoutItem.findMany({
        where: { organizationId, id: { in: payoutIds } },
        select: { id: true, providerReference: true, amountPaise: true, currency: true, status: true },
      });
      const expected = expectedItems.map(item => ({
        payoutReference: item.id,
        providerReference: item.providerReference,
        amountPaise: item.amountPaise,
        currency: item.currency,
        status: item.status as 'SUBMITTED' | 'PENDING' | 'PAID' | 'FAILED' | 'HELD' | 'REVERSED',
      }));
      const outcomes = matchStatementRows(expected, rows);

      await this.store.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.reconciliationImportRow.createMany({
          data: outcomes.map((outcome, index: number) => {
            const sourceRow = rows[index];
            if (!sourceRow) throw new Error('Reconciliation outcome has no source statement row.');
            return {
            organizationId,
            importId,
            rowNumber: index + 2,
            providerReference: sourceRow.providerReference,
            payoutReference: sourceRow.payoutReference,
            amountPaise: sourceRow.amountPaise,
            currency: sourceRow.currency,
            statementStatus: sourceRow.status,
            outcome: outcome.outcome,
            detail: 'detail' in outcome ? outcome.detail : null,
            };
          }),
        });
        const completed = await tx.reconciliationImport.updateMany({
          where: { id: importId, organizationId, status: 'PROCESSING', processingToken },
          data: {
            status: 'COMPLETED',
            processingToken: null,
            processingLeaseUntil: null,
            rowCount: rows.length,
            matchedCount: outcomes.filter((item) => item.outcome === 'MATCH').length,
            discrepancyCount: outcomes.filter((item: any) => item.outcome !== 'MATCH').length,
            completedAt: new Date(),
          },
        });
        if (completed.count !== 1) throw new ConflictException('RECONCILIATION_IMPORT_CLAIM_LOST');
      });
      return {
        outcome: 'PROCESSED',
        importId,
        rowCount: rows.length,
        matchedCount: outcomes.filter((item: any) => item.outcome === 'MATCH').length,
        discrepancyCount: outcomes.filter((item: any) => item.outcome !== 'MATCH').length,
      };
    } catch (error) {
      await this.store.prisma.reconciliationImport.updateMany({
        where: { id: importId, organizationId, status: 'PROCESSING', processingToken },
        data: { status: 'FAILED', processingToken: null, processingLeaseUntil: null, lastErrorCode: classifyReconciliationFailure(error) },
      }).catch(() => undefined);
      throw error;
    }
  }

}
