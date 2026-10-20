export type PayoutOperationalRow = {
  status: 'PENDING' | 'HELD' | 'UNKNOWN_OUTCOME' | 'SUBMITTED' | 'PAID' | 'FAILED' | 'REVERSED';
  amountMinor: bigint;
};

export type PayoutMetrics = {
  itemCount: number;
  counts: Record<PayoutOperationalRow['status'], number>;
  amountsMinor: Record<PayoutOperationalRow['status'], bigint>;
  paidAmountMinor: bigint;
  unresolvedAmountMinor: bigint;
};

const states: PayoutOperationalRow['status'][] = ['PENDING', 'HELD', 'UNKNOWN_OUTCOME', 'SUBMITTED', 'PAID', 'FAILED', 'REVERSED'];

export function summarizePayoutRows(rows: PayoutOperationalRow[]): PayoutMetrics {
  const counts = Object.fromEntries(states.map(s => [s, 0])) as PayoutMetrics['counts'];
  const amountsMinor = Object.fromEntries(states.map(s => [s, 0n])) as PayoutMetrics['amountsMinor'];
  for (const row of rows) {
    if (row.amountMinor < 0n) throw new Error('PAYOUT_ROW_AMOUNT_NEGATIVE');
    counts[row.status] += 1;
    amountsMinor[row.status] += row.amountMinor;
  }
  return {
    itemCount: rows.length, counts, amountsMinor,
    paidAmountMinor: amountsMinor.PAID,
    unresolvedAmountMinor: amountsMinor.PENDING + amountsMinor.HELD + amountsMinor.UNKNOWN_OUTCOME + amountsMinor.SUBMITTED,
  };
}
