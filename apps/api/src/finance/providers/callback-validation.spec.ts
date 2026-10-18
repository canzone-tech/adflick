import { validateCallbackEnvelope, safeDigestEqual } from './callback-validation';

describe('provider callback envelope validation', () => {
  const now = Date.parse('2026-10-14T12:00:00.000Z');
  const envelope = {
    eventId: 'evt-123', eventType: 'payout.updated', occurredAt: '2026-10-14T11:59:00.000Z',
    accountId: 'acct-sandbox', payoutReference: 'PAY-1', providerReference: 'SBX-1',
  };
  const options = { nowMs: now, allowedAccountIds: ['acct-sandbox'] };

  it('accepts fresh events for the expected provider account', () => {
    expect(validateCallbackEnvelope(envelope, options).ok).toBe(true);
  });
  it('rejects stale callbacks', () => {
    expect(validateCallbackEnvelope({ ...envelope, occurredAt: '2026-10-14T10:00:00.000Z' }, options)).toEqual({ ok: false, reason: 'CALLBACK_STALE' });
  });
  it('rejects future callbacks outside clock-skew allowance', () => {
    expect(validateCallbackEnvelope({ ...envelope, occurredAt: '2026-10-14T12:01:00.000Z' }, options)).toEqual({ ok: false, reason: 'TIMESTAMP_IN_FUTURE' });
  });
  it('rejects unexpected provider accounts', () => {
    expect(validateCallbackEnvelope({ ...envelope, accountId: 'acct-other' }, options)).toEqual({ ok: false, reason: 'ACCOUNT_NOT_ALLOWED' });
  });
  it('compares SHA-256 digests safely', () => {
    expect(safeDigestEqual('a'.repeat(64), 'a'.repeat(64))).toBe(true);
    expect(safeDigestEqual('a'.repeat(64), 'b'.repeat(64))).toBe(false);
    expect(safeDigestEqual('bad', 'bad')).toBe(false);
  });
});
