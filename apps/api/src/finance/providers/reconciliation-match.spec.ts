import { matchStatementRows } from './reconciliation-match';

describe('matchStatementRows', () => {
  const expected = [{ payoutReference: 'PAY-1', providerReference: 'PROV-1', amountPaise: 10000, currency: 'INR', status: 'SUBMITTED' as const }];
  const row = { payoutReference: 'PAY-1', providerReference: 'PROV-1', amountPaise: 10000, currency: 'INR', status: 'PAID' as const };

  it('matches exact references, currency and paise amount', () => {
    expect(matchStatementRows(expected, [row])[0].outcome).toBe('MATCH');
  });
  it('flags amount mismatches instead of auto-settling', () => {
    expect(matchStatementRows(expected, [{ ...row, amountPaise: 10001 }])[0].outcome).toBe('AMOUNT_MISMATCH');
  });
  it('flags unknown payout references', () => {
    expect(matchStatementRows(expected, [{ ...row, payoutReference: 'MISSING' }])[0].outcome).toBe('UNKNOWN_PAYOUT');
  });
  it('never downgrades a paid record', () => {
    expect(matchStatementRows([{ ...expected[0], status: 'PAID' }], [{ ...row, status: 'PENDING' }])[0].outcome).toBe('STATUS_CONFLICT');
  });
  it('rejects duplicate provider transaction references across different payouts', () => {
    const rows = [
      row,
      { ...row, payoutReference: 'PAY-2', providerReference: 'PROV-1' },
    ];
    const results = matchStatementRows([
      expected[0],
      { payoutReference: 'PAY-2', providerReference: 'PROV-1', amountPaise: 10000, currency: 'INR', status: 'SUBMITTED' as const },
    ], rows);
    expect(results[0].outcome).toBe('MATCH');
    expect(results[1]).toMatchObject({
      outcome: 'REFERENCE_MISMATCH',
      payoutReference: 'PAY-2',
      detail: 'Provider transaction reference is reused for a different payout.',
    });
  });

  it('flags an identical provider/payout row repeated in one import', () => {
    const results = matchStatementRows(expected, [row, row]);
    expect(results.map(result => result.outcome)).toEqual(['MATCH', 'REFERENCE_MISMATCH']);
  });

});
