import { ProviderPayoutStatus } from './provider.types';

export type RetryDecision = 'DO_NOT_RETRY' | 'QUERY_PROVIDER_FIRST' | 'RETRY_SAME_IDEMPOTENCY_KEY';

export function decideRecoveryAction(input: {
  outcomeUnknown: boolean; providerReference?: string | null;
  lastKnownStatus: ProviderPayoutStatus; providerGuaranteesIdempotency: boolean;
}): RetryDecision {
  if (input.lastKnownStatus === 'SETTLED' || input.lastKnownStatus === 'FAILED') return 'DO_NOT_RETRY';
  if (input.outcomeUnknown || input.lastKnownStatus === 'UNKNOWN' || input.providerReference) return 'QUERY_PROVIDER_FIRST';
  if (input.providerGuaranteesIdempotency) return 'RETRY_SAME_IDEMPOTENCY_KEY';
  return 'QUERY_PROVIDER_FIRST';
}

export function backoffMs(attempt: number, baseMs = 1000, maxMs = 60_000): number {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error('INVALID_ATTEMPT_NUMBER');
  return Math.min(maxMs, baseMs * (2 ** Math.min(attempt - 1, 16)));
}
