import { decideRecoveryAction, backoffMs } from '../src/payments/retry-policy';
import { verifyHmacSha256Webhook } from '../src/payments/webhook-verification';
import { createHmac } from 'node:crypto';

describe('Batch 106 provider recovery', () => {
  it('queries first when submit outcome is unknown', () => {
    expect(decideRecoveryAction({ outcomeUnknown: true, lastKnownStatus: 'UNKNOWN', providerGuaranteesIdempotency: true })).toBe('QUERY_PROVIDER_FIRST');
  });
  it('does not retry settled payout', () => {
    expect(decideRecoveryAction({ outcomeUnknown: false, lastKnownStatus: 'SETTLED', providerGuaranteesIdempotency: true })).toBe('DO_NOT_RETRY');
  });
  it('uses bounded exponential backoff', () => {
    expect(backoffMs(1)).toBe(1000); expect(backoffMs(10)).toBeLessThanOrEqual(60000);
    expect(() => backoffMs(0)).toThrow('INVALID_ATTEMPT_NUMBER');
  });
  it('verifies example HMAC over timestamp and raw body', () => {
    const secret = 'test-only-secret', body = Buffer.from('{"event":"payout.updated"}'), timestamp = '1700000000';
    const signature = createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${timestamp}.`), body])).digest('hex');
    expect(verifyHmacSha256Webhook({ rawBody: body, signatureHex: signature, timestampSeconds: timestamp, secret, nowSeconds: 1700000000 }).valid).toBe(true);
  });
  it('rejects stale timestamps and modified body', () => {
    const secret = 'test-only-secret', body = Buffer.from('original'), timestamp = '1700000000';
    const signature = createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${timestamp}.`), body])).digest('hex');
    expect(verifyHmacSha256Webhook({ rawBody: body, signatureHex: signature, timestampSeconds: timestamp, secret, nowSeconds: 1700001000 }).valid).toBe(false);
    expect(verifyHmacSha256Webhook({ rawBody: Buffer.from('modified'), signatureHex: signature, timestampSeconds: timestamp, secret, nowSeconds: 1700000000 }).valid).toBe(false);
  });
});
