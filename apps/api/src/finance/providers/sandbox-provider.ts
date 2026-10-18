import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { PayoutProviderAdapter } from './provider-safety';

export interface SandboxProviderConfig {
  enabled: boolean;
  webhookSecret: string;
}

/**
 * Deterministic, local-only provider adapter. It NEVER sends money.
 * Live transfers are deliberately unavailable in this adapter.
 */
export class SandboxPayoutProvider implements PayoutProviderAdapter {
  readonly providerName = 'ADFLICK_SANDBOX';
  private readonly events = new Map<string, { payoutReference: string; amountPaise: number; status: 'ACCEPTED' | 'PENDING'; providerReference: string }>();

  constructor(private readonly config: SandboxProviderConfig) {}

  async createPayout(input: {
    payoutReference: string;
    amountPaise: number;
    currency: 'INR';
    beneficiaryToken: string;
    idempotencyKey: string;
  }): Promise<{ providerReference: string; status: 'ACCEPTED' | 'PENDING' }> {
    if (!this.config.enabled) throw new Error('Sandbox provider is disabled.');
    if (input.currency !== 'INR') throw new Error('Sandbox supports INR only.');
    if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) throw new Error('amountPaise must be a positive safe integer.');
    if (!input.payoutReference.trim() || !input.idempotencyKey.trim()) throw new Error('Payout reference and idempotency key are required.');
    if (!input.beneficiaryToken.trim()) throw new Error('A tokenized beneficiary reference is required; raw bank details are prohibited.');
    const existing = this.events.get(input.idempotencyKey);
    if (existing) {
      if (existing.payoutReference !== input.payoutReference || existing.amountPaise !== input.amountPaise) {
        throw new Error('Idempotency key reused with different payout data.');
      }
      return { providerReference: existing.providerReference, status: existing.status };
    }
    const result = {
      payoutReference: input.payoutReference,
      amountPaise: input.amountPaise,
      status: 'ACCEPTED' as const,
      providerReference: `SBX-${randomUUID()}`,
    };
    this.events.set(input.idempotencyKey, result);
    return { providerReference: result.providerReference, status: result.status };
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean {
    if (!this.config.enabled || !this.config.webhookSecret || !signature || rawBody.length === 0) return false;
    const supplied = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
    const expected = createHmac('sha256', this.config.webhookSecret).update(rawBody).digest();
    const actual = Buffer.from(supplied, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  /** Explicit guard: this mock cannot be used as a production payment rail. */
  assertLiveTransfersDisabled(environment: string): void {
    if (environment === 'production') throw new Error('Sandbox adapter cannot be used in production.');
  }
}
