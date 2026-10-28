import { StorageService } from './storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CmsService } from './cms.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('CmsService tenant isolation contract', () => {
  const actor: AuthenticatedUser = {
    sub: 'content-org-a', email: 'content@example.test', organizationId: 'org-a',
    roles: ['ORGANIZATION_ADMIN'], sessionId: 'session-a',
  };
  const prisma = {
    screenLayout: { findFirst: jest.fn(), update: jest.fn() },
    mediaAsset: { findFirst: jest.fn(), update: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
  const storage = {};

  beforeEach(() => jest.clearAllMocks());

  it('rejects cross-tenant layout publication before mutation or audit', async () => {
    prisma.screenLayout.findFirst.mockResolvedValue(null);
    const service = new CmsService(prisma as unknown as PrismaService, storage as unknown as StorageService);
    await expect(service.publishLayout(actor, 'layout-org-b')).rejects.toThrow('Layout not found.');
    expect(prisma.screenLayout.findFirst).toHaveBeenCalledWith({
      where: { id: 'layout-org-b', organizationId: 'org-a' },
    });
    expect(prisma.screenLayout.update).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });
});
