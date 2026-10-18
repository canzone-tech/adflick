import { PayoutsService } from './payouts.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('PayoutsService tenant isolation contract', () => {
  const actor: AuthenticatedUser = {
    sub: 'finance-org-a', email: 'finance@example.test', organizationId: 'org-a',
    roles: ['FINANCE_MANAGER'], sessionId: 'finance-session-a',
  };
  const prisma = {
    financeDispute: { findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects cross-tenant dispute resolution before opening a transaction', async () => {
    prisma.financeDispute.findFirst.mockResolvedValue(null);
    const service = new PayoutsService(prisma as any);
    await expect(service.resolveDispute(actor, 'dispute-org-b', {
      status: 'RESOLVED_ORGANIZATION_FAVOUR', note: 'Reviewed and resolved with evidence.',
    } as any)).rejects.toThrow('Finance dispute not found.');
    expect(prisma.financeDispute.findFirst).toHaveBeenCalledWith({
      where: { id: 'dispute-org-b', organizationId: 'org-a' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.financeDispute.update).not.toHaveBeenCalled();
  });

  it('fails closed without organization context', async () => {
    const service = new PayoutsService(prisma as any);
    await expect(service.listBatches({ ...actor, organizationId: null })).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
