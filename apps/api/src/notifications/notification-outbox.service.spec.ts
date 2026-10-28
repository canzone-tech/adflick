import { PrismaService } from '../prisma/prisma.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { AlertNotifierService } from './alert-notifier.service';

const event = {
  incidentId: 'incident_123', organizationId: 'org_123', title: 'Screen offline',
  severity: 'HIGH', category: 'SCREEN_OFFLINE', description: 'Heartbeat missing', source: 'manual' as const,
};

describe('NotificationOutboxService', () => {
  const prisma = {
    notificationOutbox: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
  const notifier = { notifyIncident: jest.fn() } as unknown as AlertNotifierService;
  let service: NotificationOutboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationOutboxService(prisma as unknown as PrismaService, notifier);
  });

  it('enqueues an incident with a deterministic idempotency key', async () => {
    prisma.notificationOutbox.create.mockResolvedValue({ id: 'outbox_1' });
    await expect(service.enqueueIncident(event)).resolves.toEqual({ queued: true, duplicate: false });
    expect(prisma.notificationOutbox.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventKey: 'incident.created:incident_123', eventType: 'adflick.incident.created' }),
    }));
  });

  it('treats a unique-key conflict as an already queued event', async () => {
    prisma.notificationOutbox.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.enqueueIncident(event)).resolves.toEqual({ queued: true, duplicate: true });
  });

  it('does not attempt a drain when there are no due outbox rows', async () => {
    prisma.notificationOutbox.findFirst.mockResolvedValue(null);
    await service.drain();
    expect(prisma.notificationOutbox.updateMany).not.toHaveBeenCalled();
  });
});
