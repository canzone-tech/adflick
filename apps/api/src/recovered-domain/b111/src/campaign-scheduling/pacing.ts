import { PacingMode } from './types';

export interface PacingInput { mode: PacingMode; campaignStartUtc: Date; campaignEndUtc: Date; nowUtc: Date; totalBudgetMinor: bigint; actualSpendMinor: bigint; actualImpressions: bigint; totalImpressionCap?: bigint | null; }
export interface PacingResult { expectedSpendMinor: bigint; spendVarianceMinor: bigint; pacingBasisPoints: number; remainingBudgetMinor: bigint; remainingImpressions?: bigint; }

export function calculatePacing(input: PacingInput): PacingResult {
  if (input.totalBudgetMinor < 0n || input.actualSpendMinor < 0n || input.actualImpressions < 0n) throw new Error('Budget and delivery metrics cannot be negative');
  const start = input.campaignStartUtc.getTime(), end = input.campaignEndUtc.getTime(), now = input.nowUtc.getTime();
  if (![start, end, now].every(Number.isFinite) || end <= start) throw new Error('Invalid campaign time range');
  const elapsed = Math.max(0, Math.min(1, (now - start) / (end - start)));
  let expectedRatio = elapsed;
  if (input.mode === 'ASAP') expectedRatio = elapsed === 0 ? 0 : Math.min(1, elapsed * 1.25);
  if (input.mode === 'FRONT_LOADED') expectedRatio = Math.min(1, Math.sqrt(elapsed));
  const expectedSpendMinor = BigInt(Math.floor(Number(input.totalBudgetMinor) * expectedRatio));
  const spendVarianceMinor = input.actualSpendMinor - expectedSpendMinor;
  const pacingBasisPoints = expectedSpendMinor === 0n ? (input.actualSpendMinor > 0n ? 10000 : 0) : Number((input.actualSpendMinor * 10000n) / expectedSpendMinor);
  const remainingBudgetMinor = input.totalBudgetMinor > input.actualSpendMinor ? input.totalBudgetMinor - input.actualSpendMinor : 0n;
  const remainingImpressions = input.totalImpressionCap == null ? undefined : (input.totalImpressionCap > input.actualImpressions ? input.totalImpressionCap - input.actualImpressions : 0n);
  return { expectedSpendMinor, spendVarianceMinor, pacingBasisPoints, remainingBudgetMinor, remainingImpressions };
}
