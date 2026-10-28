import { PrismaReconciliationImportStore } from './prisma-reconciliation-import-store';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ReconciliationImportService } from './reconciliation-import.service';

describe('ReconciliationImportService', () => {
  const store = { create: jest.fn(), findByKey: jest.fn() };
  const service = new ReconciliationImportService(store as unknown as PrismaReconciliationImportStore);
  const dto = { providerName: 'SANDBOX', idempotencyKey: 'statement-1', payload: 'header\\nrow' };

  beforeEach(() => jest.clearAllMocks());

  it('requires an authorized finance role and organization context', async () => {
    await expect(service.reserve({
      sub: 'user-1', email: 'user@example.test', organizationId: 'org-1', roles: [UserRole.ADVERTISER], sessionId: 'session-1',
    }, dto)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reserve({
      sub: 'user-1', email: 'user@example.test', organizationId: null, roles: [UserRole.FINANCE_MANAGER], sessionId: 'session-1',
    }, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(store.create).not.toHaveBeenCalled();
  });

  it('passes authenticated organization and actor to the durable store', async () => {
    store.create.mockResolvedValue({ id: 'import-1', status: 'RECEIVED' });
    await expect(service.reserve({
      sub: 'user-1', email: 'finance@example.test', organizationId: 'org-1', roles: [UserRole.FINANCE_MANAGER], sessionId: 'session-1',
    }, dto)).resolves.toEqual({ outcome: 'CREATED', importId: 'import-1' });
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1', providerName: 'SANDBOX', idempotencyKey: 'statement-1', createdById: 'user-1',
    }));
  });
});
