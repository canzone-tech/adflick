import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReconciliationImportStore } from './reconciliation-import-idempotency';

@Injectable()
export class PrismaReconciliationImportStore implements ReconciliationImportStore {
  constructor(readonly prisma: PrismaService) {}

  async create(input: {
    organizationId: string;
    providerName: string;
    idempotencyKey: string;
    payloadSha256: string;
    createdById?: string;
  }) {
    return this.prisma.reconciliationImport.create({
      data: input,
      select: { id: true, status: true },
    });
  }

  async findByKey(input: { organizationId: string; providerName: string; idempotencyKey: string }) {
    return this.prisma.reconciliationImport.findFirst({
      where: {
        organizationId: input.organizationId,
        providerName: input.providerName,
        idempotencyKey: input.idempotencyKey,
      },
      select: { id: true, payloadSha256: true, status: true, processingLeaseUntil: true },
    });
  }
}
