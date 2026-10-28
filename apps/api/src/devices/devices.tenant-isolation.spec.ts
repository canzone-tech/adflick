import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from './devices.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('DevicesService tenant isolation contract', () => {
  const actor: AuthenticatedUser = {
    sub: 'ops-org-a', email: 'ops@example.test', organizationId: 'org-a',
    roles: ['ORGANIZATION_ADMIN'], sessionId: 'session-a',
  };
  const prisma = {
    screen: { findFirst: jest.fn(), update: jest.fn() },
    devicePairingCode: { updateMany: jest.fn() },
    auditEvent: { create: jest.fn() },
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects cross-tenant status change before mutation', async () => {
    prisma.screen.findFirst.mockResolvedValue(null);
    const service = new DevicesService(prisma as unknown as PrismaService);
    await expect(service.setScreenStatus(actor, 'screen-org-b', 'SUSPENDED'))
      .rejects.toThrow('Screen not found.');
    expect(prisma.screen.findFirst).toHaveBeenCalledWith({
      where: { id: 'screen-org-b', organizationId: 'org-a' },
    });
    expect(prisma.screen.update).not.toHaveBeenCalled();
    expect(prisma.devicePairingCode.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('includes organization scope in the mutation after a successful scoped lookup', async () => {
    prisma.screen.findFirst.mockResolvedValue({ id: 'screen-org-a', name: 'Lobby', status: 'ONLINE' });
    prisma.screen.update.mockResolvedValue({ id: 'screen-org-a', name: 'Lobby', status: 'SUSPENDED' });
    const service = new DevicesService(prisma as unknown as PrismaService);
    await service.setScreenStatus(actor, 'screen-org-a', 'SUSPENDED');
    expect(prisma.screen.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'screen-org-a', organizationId: 'org-a' },
    }));
  });
});
