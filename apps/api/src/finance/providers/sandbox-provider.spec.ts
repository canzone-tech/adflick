import { SandboxPayoutProvider } from './sandbox-provider';

describe('SandboxPayoutProvider', () => {
  const provider = () => new SandboxPayoutProvider({ enabled: true, webhookSecret: 'test-secret' });
  const input = { payoutReference: 'PAY-001', amountPaise: 12345, currency: 'INR' as const, beneficiaryToken: 'beneficiary-token', idempotencyKey: 'idem-001' };

  it('returns the same reference for an idempotent retry', async () => {
    const p = provider();
    const first = await p.createPayout(input);
    const second = await p.createPayout(input);
    expect(second).toEqual(first);
  });

  it('rejects reuse of an idempotency key with different amount', async () => {
    const p = provider();
    await p.createPayout(input);
    await expect(p.createPayout({ ...input, amountPaise: 99999 })).rejects.toThrow(/different payout data/i);
  });

  it('rejects raw/missing beneficiary reference', async () => {
    await expect(provider().createPayout({ ...input, beneficiaryToken: '' })).rejects.toThrow(/tokenized beneficiary/i);
  });

  it('cannot be used in production', () => {
    expect(() => provider().assertLiveTransfersDisabled('production')).toThrow(/cannot be used in production/i);
  });

  it('verifies exact-body HMAC signatures', async () => {
    const { createHmac } = await import('node:crypto');
    const p = provider();
    const body = Buffer.from('{"eventId":"evt-1"}');
    const signature = createHmac('sha256', 'test-secret').update(body).digest('hex');
    expect(p.verifyWebhook(body, signature)).toBe(true);
    expect(p.verifyWebhook(Buffer.from('{"eventId":"evt-2"}'), signature)).toBe(false);
  });
});
