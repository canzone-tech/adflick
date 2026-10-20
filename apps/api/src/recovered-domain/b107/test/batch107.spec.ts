import { summarizePayoutRows } from '../src/finance/operations-metrics';
import { selectRecoveryAction } from '../src/finance/recovery-policy';

describe('Batch 107 operations metrics and recovery', () => {
  it('keeps paid and unresolved amounts separate', () => {
    const result = summarizePayoutRows([
      { status: 'PAID', amountMinor: 10000n },
      { status: 'UNKNOWN_OUTCOME', amountMinor: 2000n },
      { status: 'HELD', amountMinor: 500n },
    ]);
    expect(result.paidAmountMinor).toBe(10000n);
    expect(result.unresolvedAmountMinor).toBe(2500n);
  });
  it('rejects negative payout rows', () => {
    expect(() => summarizePayoutRows([{ status: 'PAID', amountMinor: -1n }])).toThrow('PAYOUT_ROW_AMOUNT_NEGATIVE');
  });
  it('queries provider for unknown outcomes before retry', () => {
    expect(selectRecoveryAction({
      status: 'UNKNOWN_OUTCOME', providerReferencePresent: false, providerStatusChecked: false,
      providerGuaranteesIdempotency: true, retryLimitReached: false, financeHold: false,
    })).toBe('QUERY_PROVIDER');
  });
  it('escalates finance-held payout', () => {
    expect(selectRecoveryAction({
      status: 'FAILED', providerReferencePresent: false, providerStatusChecked: false,
      providerGuaranteesIdempotency: true, retryLimitReached: false, financeHold: true,
    })).toBe('ESCALATE');
  });
  it('does not reopen a paid payout', () => {
    expect(selectRecoveryAction({
      status: 'PAID', providerReferencePresent: true, providerStatusChecked: true,
      providerGuaranteesIdempotency: true, retryLimitReached: false, financeHold: false,
    })).toBe('NO_ACTION');
  });
});
