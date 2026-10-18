import { BadRequestException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('CampaignsService nested tenant associations', () => {
  const actor: AuthenticatedUser = {
    sub: 'admin-a', email: 'admin-a@example.test', organizationId: 'org-a',
    roles: ['ORGANIZATION_ADMIN'], sessionId: 'session-a',
  };
  const prisma = {
    campaign: { findFirst: jest.fn(), update: jest.fn() },
    mediaAsset: { findMany: jest.fn() },
    screen: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects a foreign-organization creative before association writes', async () => {
    prisma.campaign.findFirst.mockResolvedValue({
      id: 'campaign-a', organizationId: 'org-a', createdById: actor.sub,
      status: 'DRAFT', creatives: [], screenTargets: [],
    });
    prisma.mediaAsset.findMany.mockResolvedValue([]);
    const service = new CampaignsService(prisma as any);
    await expect(service.update(actor, 'campaign-a', { creativeAssetIds: ['asset-org-b'] } as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['asset-org-b'] }, organizationId: 'org-a', status: 'READY' },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a foreign-organization screen target before association writes', async () => {
    prisma.campaign.findFirst.mockResolvedValue({
      id: 'campaign-a', organizationId: 'org-a', createdById: actor.sub,
      status: 'DRAFT', creatives: [], screenTargets: [],
    });
    prisma.screen.findMany.mockResolvedValue([]);
    const service = new CampaignsService(prisma as any);
    await expect(service.update(actor, 'campaign-a', { screenIds: ['screen-org-b'] } as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.screen.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['screen-org-b'] }, organizationId: 'org-a', status: { not: 'RETIRED' } },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
