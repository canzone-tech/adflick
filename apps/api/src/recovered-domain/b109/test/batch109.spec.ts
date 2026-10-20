import { parseMinorUnits } from '../src/wallet/money';
import { validateBudgetReservation, validateSpendAgainstReservation } from '../src/wallet/budget-policy';
import { assertAvailableForDebit, validateLedgerPost } from '../src/wallet/ledger';
import { walletIdempotencyKey } from '../src/wallet/idempotency';

describe('Batch 109 wallet controls', () => {
  it('parses decimal amounts as integer minor units', () => {
    expect(parseMinorUnits('123.45')).toBe(12345n);
    expect(parseMinorUnits('0.7')).toBe(70n);
    expect(() => parseMinorUnits('1.234')).toThrow();
    expect(() => parseMinorUnits('-1.00')).toThrow();
  });
  it('rejects campaign budget overrun', () => {
    expect(() => validateBudgetReservation({ campaignLimitMinor: 10000n, advertiserDailyLimitMinor: 50000n, dailySpentMinor: 0n, campaignSpentMinor: 6000n, campaignReservedMinor: 3000n, requestedReservationMinor: 2000n })).toThrow('Campaign budget limit exceeded');
  });
  it('rejects advertiser daily cap overrun', () => {
    expect(() => validateBudgetReservation({ campaignLimitMinor: 100000n, advertiserDailyLimitMinor: 10000n, dailySpentMinor: 9000n, campaignSpentMinor: 0n, campaignReservedMinor: 0n, requestedReservationMinor: 2000n })).toThrow('daily spending limit exceeded');
  });
  it('spend cannot exceed remaining reservation', () => {
    expect(() => validateSpendAgainstReservation(100n, 101n)).toThrow('exceeds');
  });
  it('wallet cannot debit beyond available balance', () => {
    expect(() => assertAvailableForDebit({ tenantId: 't1', walletId: 'w1', currency: 'INR', status: 'ACTIVE', availableMinor: 100n, reservedMinor: 0n, version: 1 }, 101n)).toThrow('Insufficient');
  });
  it('ledger entries require positive amount and idempotency key', () => {
    expect(() => validateLedgerPost({ tenantId: 't1', walletId: 'w1', type: 'PAYMENT_CREDIT', amountMinor: 0n, currency: 'INR', referenceType: 'PAYMENT_ALLOCATION', referenceId: 'pa1', idempotencyKey: 'k' })).toThrow();
    expect(() => validateLedgerPost({ tenantId: 't1', walletId: 'w1', type: 'PAYMENT_CREDIT', amountMinor: 100n, currency: 'INR', referenceType: 'PAYMENT_ALLOCATION', referenceId: 'pa1', idempotencyKey: ' ' })).toThrow();
  });
  it('idempotency key is stable and source-specific', () => {
    expect(walletIdempotencyKey('t1', 'CREDIT', 'p1')).toBe(walletIdempotencyKey('t1', 'CREDIT', 'p1'));
    expect(walletIdempotencyKey('t1', 'CREDIT', 'p1')).not.toBe(walletIdempotencyKey('t1', 'CREDIT', 'p2'));
  });
});
