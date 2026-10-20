export type RecoveryAction = 'INVESTIGATE' | 'QUERY_PROVIDER' | 'RETRY_SAME_KEY' | 'NO_ACTION' | 'ESCALATE';

export function selectRecoveryAction(input: {
  status: 'UNKNOWN_OUTCOME' | 'FAILED' | 'SUBMITTED' | 'PAID' | 'HELD';
  providerReferencePresent: boolean;
  providerStatusChecked: boolean;
  providerGuaranteesIdempotency: boolean;
  retryLimitReached: boolean;
  financeHold: boolean;
}): RecoveryAction {
  if (input.status === 'PAID') return 'NO_ACTION';
  if (input.financeHold) return 'ESCALATE';
  if (input.retryLimitReached) return 'ESCALATE';
  if (input.status === 'UNKNOWN_OUTCOME' || input.status === 'SUBMITTED') {
    return input.providerStatusChecked ? 'INVESTIGATE' : 'QUERY_PROVIDER';
  }
  if (input.status === 'FAILED') {
    return input.providerReferencePresent ? 'QUERY_PROVIDER' : input.providerGuaranteesIdempotency ? 'RETRY_SAME_KEY' : 'INVESTIGATE';
  }
  return 'INVESTIGATE';
}
