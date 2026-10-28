import { PrismaReconciliationImportStore } from './prisma-reconciliation-import-store';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/decorators/current-user.decorator';
import { ReconciliationImportService } from './reconciliation-import.service';

const actor: AuthenticatedUser = {
  sub: 'user-a', email: 'finance@example.test', organizationId: 'org-a',
  roles: [UserRole.FINANCE_MANAGER], sessionId: 'session-a',
};

describe('ReconciliationImportService read APIs', () => {
  const record = {
    id: 'import-a', organizationId: 'org-a', providerName: 'SANDBOX', idempotencyKey: 'key-a',
    status: 'COMPLETED', rowCount: 2, matchedCount: 1, discrepancyCount: 1,
    lastErrorCode: null, attemptCount: 1, createdAt: new Date(0), updatedAt: new Date(0), completedAt: new Date(0),
  };
  const prisma = {
    reconciliationImport: { findFirst: jest.fn() },
    reconciliationImportRow: { findMany: jest.fn(), count: jest.fn() },
  };
  const service = new ReconciliationImportService({ prisma } as unknown as PrismaReconciliationImportStore);

  beforeEach(() => jest.clearAllMocks());

  it('returns import metadata scoped to the actor organization', async () => {
    prisma.reconciliationImport.findFirst.mockResolvedValue(record);
    await expect(service.getImport(actor, 'import-a')).resolves.toEqual(record);
    expect(prisma.reconciliationImport.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'import-a', organizationId: 'org-a' },
    }));
  });

  it('hides imports owned by another organization as not found', async () => {
    prisma.reconciliationImport.findFirst.mockResolvedValue(null);
    await expect(service.getImport(actor, 'foreign-import')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.reconciliationImport.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'foreign-import', organizationId: 'org-a' },
    }));
  });

  it('returns paginated rows with organization scope and stable row order', async () => {
    const rows = [{ id: 'row-2', rowNumber: 3, outcome: 'AMOUNT_MISMATCH' }];
    prisma.reconciliationImport.findFirst.mockResolvedValue({ id: 'import-a' });
    prisma.reconciliationImportRow.findMany.mockResolvedValue(rows);
    prisma.reconciliationImportRow.count.mockResolvedValue(2);
    await expect(service.getImportRows(actor, 'import-a', '1', '2')).resolves.toEqual({ importId: 'import-a', limit: 1, offset: 2, total: 2, rows });
    expect(prisma.reconciliationImportRow.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { importId: 'import-a', organizationId: 'org-a' }, orderBy: { rowNumber: 'asc' }, skip: 2, take: 1,
    }));
    expect(prisma.reconciliationImportRow.count).toHaveBeenCalledWith({ where: { importId: 'import-a', organizationId: 'org-a' } });
  });

  it('rejects unbounded or malformed pagination', async () => {
    await expect(service.getImportRows(actor, 'import-a', '201', '0')).rejects.toThrow('limit must be an integer between 1 and 200.');
    await expect(service.getImportRows(actor, 'import-a', '10', '-1')).rejects.toThrow('offset must be an integer between 0 and 100000.');
    expect(prisma.reconciliationImport.findFirst).not.toHaveBeenCalled();
  });

  it('allows auditor read access but rejects non-finance roles', async () => {
    prisma.reconciliationImport.findFirst.mockResolvedValue(record);
    await expect(service.getImport({ ...actor, roles: [UserRole.AUDITOR_COMPLIANCE] }, 'import-a')).resolves.toEqual(record);
    await expect(service.getImport({ ...actor, roles: [UserRole.ADVERTISER] }, 'import-a')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
