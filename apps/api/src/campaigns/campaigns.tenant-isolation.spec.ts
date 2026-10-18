import { CampaignsService } from './campaigns.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('CampaignsService tenant isolation contract', () => {
  const actor: AuthenticatedUser = {
    sub: 'user-org-a', email: 'a@example.test', organizationId: 'org-a',
    roles: ['ORGANIZATION_ADMIN'], sessionId: 'session-a',
  };
  const prisma = {
    campaign: { findFirst: jest.fn(), update: jest.fn() },
    mediaAsset: { findMany: jest.fn() },
    screen: { findMany: jest.fn() },
  };

  beforeEach(() => jest.clearAllMocks());

  it('does not mutate a campaign that is not visible in the authenticated organization', async () => {
    prisma.campaign.findFirst.mockResolvedValue(null);
    const service = new CampaignsService(prisma as any);
    await expect(service.update(actor, 'campaign-org-b', { name: 'attempted change' } as any))
      .rejects.toThrow('Campaign not found.');
    expect(prisma.campaign.findFirst).toHaveBeenCalledWith({
      where: { id: 'campaign-org-b', organizationId: 'org-a' },
    });
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('does not read campaigns when organization context is absent', async () => {
    const service = new CampaignsService(prisma as any);
    await expect(service.get({ ...actor, organizationId: null }, 'campaign-id'))
      .rejects.toThrow();
    expect(prisma.campaign.findFirst).not.toHaveBeenCalled();
  });
});
