export type PayoutItemState =
  | 'VALIDATED' | 'HELD' | 'READY' | 'SUBMITTED'
  | 'UNKNOWN_OUTCOME' | 'PAID' | 'FAILED' | 'REVERSED';

const allowed: Record<PayoutItemState, PayoutItemState[]> = {
  VALIDATED: ['HELD', 'READY'],
  HELD: ['VALIDATED', 'READY'],
  READY: ['SUBMITTED', 'HELD'],
  SUBMITTED: ['UNKNOWN_OUTCOME', 'PAID', 'FAILED'],
  UNKNOWN_OUTCOME: ['PAID', 'FAILED', 'SUBMITTED'],
  PAID: ['REVERSED'],
  FAILED: ['READY', 'HELD'],
  REVERSED: [],
};

export function assertPayoutTransition(from: PayoutItemState, to: PayoutItemState): void {
  if (!allowed[from].includes(to)) throw new Error(`PAYOUT_TRANSITION_NOT_ALLOWED:${from}->${to}`);
}

export function canSubmitToProvider(input: {
  batchApproved: boolean;
  batchHashMatches: boolean;
  itemState: PayoutItemState;
  financeHold: boolean;
}): boolean {
  return input.batchApproved && input.batchHashMatches && input.itemState === 'READY' && !input.financeHold;
}
