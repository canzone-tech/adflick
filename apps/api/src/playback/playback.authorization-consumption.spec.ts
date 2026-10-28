import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'node:crypto';
import { PlaybackService } from './playback.service';

describe('Playback authorization single-consumption race', () => {
  const secret = 'batch32-device-secret-long-enough-123';
  const startedAt = new Date(Date.now() - 15_000).toISOString();
  const completedAt = new Date(Date.now() - 2_000).toISOString();
  const screen = {
    id: 'screen-a', organizationId: 'org-a',
    deviceKeyHash: createHash('sha256').update(secret).digest('hex'), status: 'ONLINE',
  };
  const makeEvent = (eventId: string) => ({
    eventId, eventType: 'PLAY_COMPLETED' as const, assetId: 'asset-a',
    authorizationId: 'grant-a', authorizationToken: 'raw-token',
    startedAt, completedAt, durationMs: 13_000, expectedDurationMs: 13_000,
  });
  const prisma = {
    $transaction: jest.fn(),
    screen: { findUnique: jest.fn(), update: jest.fn() },
    playbackEvent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    playbackAuthorization: { findFirst: jest.fn(), updateMany: jest.fn() },
    mediaAsset: { findFirst: jest.fn() }, campaign: { findFirst: jest.fn() }, playlist: { findFirst: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.screen.findUnique.mockResolvedValue(screen);
    prisma.screen.update.mockResolvedValue({});
    prisma.playbackEvent.findUnique.mockResolvedValue(null);
    prisma.playbackEvent.create.mockImplementation(async ({ data }: { data: { eventId: string } }) => ({ id: `saved-${data.eventId}` }));
    prisma.playbackAuthorization.findFirst.mockResolvedValue({ id: 'grant-a' });
    prisma.playbackAuthorization.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.mediaAsset.findFirst.mockResolvedValue({ id: 'asset-a', durationMs: 13_000 });
    prisma.$transaction.mockImplementation(async (callback: (trx: { playbackEvent: typeof prisma.playbackEvent; playbackAuthorization: typeof prisma.playbackAuthorization; $executeRaw: jest.Mock }) => Promise<unknown>) => callback({
      playbackEvent: prisma.playbackEvent,
      playbackAuthorization: prisma.playbackAuthorization,
      $executeRaw: jest.fn().mockResolvedValue(1),
    }));
  });

  it('counts no more than one completed event against the same one-use authorization', async () => {
    const service = new PlaybackService(prisma as unknown as PrismaService);
    const result = await service.ingestBatch(screen.id, secret, [makeEvent('event-a'), makeEvent('event-b')] as Parameters<PlaybackService['ingestBatch']>[2]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.playbackAuthorization.updateMany).toHaveBeenCalledTimes(2);
    expect(result.results.filter((r) => r.countedForEligibility)).toHaveLength(1);
    expect(result.results.filter((r) => r.reason === 'PLAYBACK_AUTHORIZATION_ALREADY_CONSUMED')).toHaveLength(1);
    expect(prisma.playbackEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'saved-event-b' },
      data: { status: 'REJECTED', validationReason: 'PLAYBACK_AUTHORIZATION_ALREADY_CONSUMED' },
    }));
  });
});
