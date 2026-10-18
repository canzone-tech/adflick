import { ProviderStatementRow } from './provider-safety';

export interface ExpectedPayout {
  payoutReference: string;
  providerReference?: string | null;
  amountPaise: number;
  currency: string;
  status: 'SUBMITTED' | 'PENDING' | 'PAID' | 'FAILED' | 'HELD' | 'REVERSED';
}
export type MatchResult =
  | { outcome: 'MATCH'; payoutReference: string; providerReference: string; statementStatus: string }
  | { outcome: 'AMOUNT_MISMATCH' | 'CURRENCY_MISMATCH' | 'REFERENCE_MISMATCH' | 'STATUS_CONFLICT' | 'UNKNOWN_PAYOUT'; payoutReference: string; detail: string };

/** Pure matching only. It never marks ledger entries paid; finance service must apply reviewed results transactionally. */
export function matchStatementRows(expected: ExpectedPayout[], rows: ProviderStatementRow[]): MatchResult[] {
  const byPayout = new Map(expected.map(p => [p.payoutReference, p]));
  const seenPairs = new Set<string>();
  const payoutByProviderReference = new Map<string, string>();
  return rows.map(row => {
    const key = `${row.providerReference}\\u0000${row.payoutReference}`;
    if (seenPairs.has(key)) return { outcome: 'REFERENCE_MISMATCH', payoutReference: row.payoutReference, detail: 'Duplicate provider/reference pair in import.' };
    seenPairs.add(key);
    const priorPayoutReference = payoutByProviderReference.get(row.providerReference);
    if (priorPayoutReference && priorPayoutReference !== row.payoutReference) {
      return { outcome: 'REFERENCE_MISMATCH', payoutReference: row.payoutReference, detail: 'Provider transaction reference is reused for a different payout.' };
    }
    payoutByProviderReference.set(row.providerReference, row.payoutReference);
    const payout = byPayout.get(row.payoutReference);
    if (!payout) return { outcome: 'UNKNOWN_PAYOUT', payoutReference: row.payoutReference, detail: 'No payout item has this reference.' };
    if (payout.providerReference && payout.providerReference !== row.providerReference) return { outcome: 'REFERENCE_MISMATCH', payoutReference: row.payoutReference, detail: 'Provider reference differs from recorded submission.' };
    if (payout.amountPaise !== row.amountPaise) return { outcome: 'AMOUNT_MISMATCH', payoutReference: row.payoutReference, detail: 'Statement amount differs from approved amount.' };
    if (payout.currency.toUpperCase() !== row.currency.toUpperCase()) return { outcome: 'CURRENCY_MISMATCH', payoutReference: row.payoutReference, detail: 'Statement currency differs from payout currency.' };
    if (payout.status === 'PAID' && row.status !== 'PAID') return { outcome: 'STATUS_CONFLICT', payoutReference: row.payoutReference, detail: 'A paid payout cannot be downgraded by an import.' };
    if (payout.status === 'REVERSED' && row.status === 'PAID') return { outcome: 'STATUS_CONFLICT', payoutReference: row.payoutReference, detail: 'Reversed payout requires a separate reviewed reversal workflow.' };
    return { outcome: 'MATCH', payoutReference: row.payoutReference, providerReference: row.providerReference, statementStatus: row.status };
  });
}
