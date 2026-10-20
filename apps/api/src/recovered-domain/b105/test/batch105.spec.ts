import { assertPayoutTransition, canSubmitToProvider } from '../src/finance/payout-state-machine';
import { validateBatchApproval } from '../src/finance/maker-checker';
import { reconcilePayout } from '../src/finance/payout-reconciliation';

describe('Batch 105 payout controls', () => {
  it('blocks maker approving their own batch', () => {
    expect(() => validateBatchApproval({
      makerUserId: 'u1', checkerUserId: 'u1', batchStatus: 'PENDING_APPROVAL',
      expectedValidationHash: 'abc', currentValidationHash: 'abc', organizationScopeMatches: true,
      checkerHasFinanceApprovalPermission: true,
    })).toThrow('MAKER_CHECKER_SEPARATION_VIOLATION');
  });
  it('blocks approval if the batch changed after validation', () => {
    expect(() => validateBatchApproval({
      makerUserId: 'u1', checkerUserId: 'u2', batchStatus: 'PENDING_APPROVAL',
      expectedValidationHash: 'abc', currentValidationHash: 'def', organizationScopeMatches: true,
      checkerHasFinanceApprovalPermission: true,
    })).toThrow('PAYOUT_BATCH_CHANGED_AFTER_VALIDATION');
  });
  it('blocks submission unless approved, unchanged and ready', () => {
    expect(canSubmitToProvider({ batchApproved: false, batchHashMatches: true, itemState: 'READY', financeHold: false })).toBe(false);
    expect(canSubmitToProvider({ batchApproved: true, batchHashMatches: true, itemState: 'READY', financeHold: false })).toBe(true);
  });
  it('rejects invalid payout state transitions', () => {
    expect(() => assertPayoutTransition('PAID', 'READY')).toThrow('PAYOUT_TRANSITION_NOT_ALLOWED');
  });
  it('does not mark payout paid if amount differs', () => {
    const result = reconcilePayout(
      { id: 'p1', amountMinor: 10000n, currency: 'INR', status: 'SUBMITTED', providerReference: 'ref1' },
      { amountMinor: 9999n, currency: 'INR', status: 'SUCCESS', providerReference: 'ref1' },
    );
    expect(result.resultCode).toBe('AMOUNT_MISMATCH');
    expect(result.mayMarkPaid).toBe(false);
  });
  it('marks only a settled, matching provider record eligible for paid transition', () => {
    const result = reconcilePayout(
      { id: 'p1', amountMinor: 10000n, currency: 'INR', status: 'SUBMITTED', providerReference: 'ref1' },
      { amountMinor: 10000n, currency: 'INR', status: 'SUCCESS', providerReference: 'ref1' },
    );
    expect(result.resultCode).toBe('MATCHED_SETTLED');
    expect(result.mayMarkPaid).toBe(true);
  });
  it('does not mark provider pending state as paid', () => {
    const result = reconcilePayout(
      { id: 'p1', amountMinor: 10000n, currency: 'INR', status: 'SUBMITTED', providerReference: 'ref1' },
      { amountMinor: 10000n, currency: 'INR', status: 'PROCESSING', providerReference: 'ref1' },
    );
    expect(result.mayMarkPaid).toBe(false);
  });
});
