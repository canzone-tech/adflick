export type Money = { amountMinor: bigint; currency: string };
export type CreatePayoutRequest = {
  payoutItemId: string; ownerReference: string; money: Money;
  idempotencyKey: string; destinationToken: string;
};
export type ProviderPayoutStatus = 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'UNKNOWN';
export type ProviderPayoutResult = {
  providerReference: string; status: ProviderPayoutStatus; money: Money; providerCode: string;
};
export interface PaymentProviderAdapter {
  readonly providerCode: string;
  createPayout(request: CreatePayoutRequest): Promise<ProviderPayoutResult>;
  getPayoutStatus(providerReference: string): Promise<ProviderPayoutResult>;
}
export class ProviderOutcomeUnknownError extends Error {
  constructor(message = 'Provider outcome unknown; query provider before retrying') {
    super(message); this.name = 'ProviderOutcomeUnknownError';
  }
}
export class ProviderDefinitiveFailureError extends Error {
  constructor(public readonly providerFailureCode: string, message: string) {
    super(message); this.name = 'ProviderDefinitiveFailureError';
  }
}
