import { PrismaService } from '../prisma/prisma.service';
import { NotificationOutboxService } from '../notifications/notification-outbox.service';
import { IncidentsService } from './incidents.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('IncidentsService tenant isolation contract', () => {
  const actor: AuthenticatedUser = {
    sub: 'user-org-a', email: 'a@example.test', organizationId: 'org-a',
    roles: ['ORGANIZATION_ADMIN'], sessionId: 'session-a',
  };
  const prisma = {
    incident: { findFirst: jest.fn(), update: jest.fn() },
    screen: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
  const notifications = { enqueueIncident: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('rejects cross-tenant incident update before any write', async () => {
    prisma.incident.findFirst.mockResolvedValue(null);
    const service = new IncidentsService(prisma as unknown as PrismaService, notifications as unknown as NotificationOutboxService);
    await expect(service.update(actor, 'incident-org-b', { status: 'RESOLVED' } as Parameters<IncidentsService['update']>[2]))
      .rejects.toThrow('Incident not found.');
    expect(prisma.incident.findFirst).toHaveBeenCalledWith({
      where: { id: 'incident-org-b', organizationId: 'org-a' },
    });
    expect(prisma.incident.update).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });
});
