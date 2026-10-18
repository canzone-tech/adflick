import { NotFoundException } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('PayoutsService tenant-scoped exports', () => {
  const actor: AuthenticatedUser = {
    sub: 'finance-a', email: 'finance-a@example.test', organizationId: 'org-a',
    roles: ['FINANCE_MANAGER'], sessionId: 'session-a',
  };
  const prisma = {
    payoutBatch: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('does not export another organization batch or its items', async () => {
    prisma.payoutBatch.findFirst.mockResolvedValue(null);
    const service = new PayoutsService(prisma as any);
    await expect(service.exportBatch(actor, 'batch-org-b')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.payoutBatch.findFirst).toHaveBeenCalledWith({
      where: { id: 'batch-org-b', organizationId: 'org-a' },
      include: { items: { where: { organizationId: 'org-a' } } },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
