import { PlaybackService } from './playback.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('PlaybackService report tenant boundary', () => {
  const actor: AuthenticatedUser = {
    sub: 'finance-org-a', email: 'finance@example.test', organizationId: 'org-a',
    roles: ['FINANCE_MANAGER'], sessionId: 'session-a',
  };
  const prisma = {
    playbackEvent: { count: jest.fn(), groupBy: jest.fn() },
  };

  beforeEach(() => jest.clearAllMocks());

  it('always binds a screen-specific report to the authenticated organization', async () => {
    prisma.playbackEvent.count.mockResolvedValue(0);
    prisma.playbackEvent.groupBy.mockResolvedValue([]);
    const service = new PlaybackService(prisma as any);
    const result = await service.report(actor, 'screen-org-b');
    const expectedWhere = {
      organizationId: 'org-a',
      status: 'ACCEPTED',
      eventType: 'PLAY_COMPLETED',
      screenId: 'screen-org-b',
    };
    expect(prisma.playbackEvent.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(prisma.playbackEvent.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
    expect(result).toEqual({ organizationId: 'org-a', acceptedCompletedPlays: 0, byScreen: [] });
  });

  it('fails closed before querying without organization context', async () => {
    const service = new PlaybackService(prisma as any);
    await expect(service.report({ ...actor, organizationId: null })).rejects.toThrow();
    expect(prisma.playbackEvent.count).not.toHaveBeenCalled();
    expect(prisma.playbackEvent.groupBy).not.toHaveBeenCalled();
  });
});
