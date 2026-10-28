import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'node:crypto';
import { PlaybackService } from './playback.service';

describe('PlaybackService duplicate ingestion safety', () => {
  const secret = 'test-device-secret-that-is-long-enough';
  const screen = {
    id: 'screen-a', organizationId: 'org-a',
    deviceKeyHash: createHash('sha256').update(secret).digest('hex'),
    status: 'ONLINE',
  };
  const event = {
    eventId: 'event-duplicate-1', eventType: 'PLAY_COMPLETED' as const,
    assetId: 'asset-a', authorizationId: 'grant-a', authorizationToken: 'token-a',
  };
  const prisma = {
    $transaction: jest.fn(),
    screen: { findUnique: jest.fn(), update: jest.fn() },
    playbackEvent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    playbackAuthorization: { findFirst: jest.fn(), updateMany: jest.fn() },
    mediaAsset: { findFirst: jest.fn() },
    campaign: { findFirst: jest.fn() },
    playlist: { findFirst: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.screen.findUnique.mockResolvedValue(screen);
    prisma.screen.update.mockResolvedValue({});
    prisma.playbackEvent.findUnique.mockResolvedValue(null);
    prisma.playbackAuthorization.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback: (trx: { playbackEvent: typeof prisma.playbackEvent; playbackAuthorization: typeof prisma.playbackAuthorization; $executeRaw: jest.Mock }) => Promise<unknown>) => callback({
      playbackEvent: prisma.playbackEvent,
      playbackAuthorization: prisma.playbackAuthorization,
      $executeRaw: jest.fn(),
    }));
  });

  it('marks a previously persisted event as duplicate and never reward eligible', async () => {
    prisma.playbackEvent.findUnique.mockResolvedValue({
      id: 'existing-event', status: 'ACCEPTED', validationReason: null,
    });
    const service = new PlaybackService(prisma as unknown as PrismaService);
    const result = await service.ingestBatch(screen.id, secret, [event] as Parameters<PlaybackService['ingestBatch']>[2]);
    expect(result.duplicates).toBe(1);
    expect(result.results[0]).toMatchObject({
      eventId: event.eventId, status: 'DUPLICATE',
      countedForEligibility: false,
    });
    expect(prisma.playbackEvent.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('handles the database unique-key race as a duplicate and not an eligible play', async () => {
    prisma.playbackEvent.create.mockRejectedValue({ code: 'P2002' });
    const service = new PlaybackService(prisma as unknown as PrismaService);
    const result = await service.ingestBatch(screen.id, secret, [event] as Parameters<PlaybackService['ingestBatch']>[2]);
    expect(result.duplicates).toBe(1);
    expect(result.results[0]).toMatchObject({
      eventId: event.eventId, status: 'DUPLICATE',
      countedForEligibility: false,
    });
    expect(prisma.playbackEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.screen.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: screen.id },
    }));
  });

  it('rejects invalid device credentials before querying event IDs', async () => {
    const service = new PlaybackService(prisma as unknown as PrismaService);
    await expect(service.ingestBatch(screen.id, 'wrong-device-secret-which-is-long-enough', [event] as Parameters<PlaybackService['ingestBatch']>[2]))
      .rejects.toThrow();
    expect(prisma.playbackEvent.findUnique).not.toHaveBeenCalled();
  });
});
