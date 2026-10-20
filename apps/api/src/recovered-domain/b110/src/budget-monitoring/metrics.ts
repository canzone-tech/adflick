import { CampaignBudgetSnapshot } from './types';

export function utilizationBasisPoints(spentMinor: bigint, approvedBudgetMinor: bigint): number {
  if (spentMinor < 0n || approvedBudgetMinor < 0n) throw new Error('Budget values cannot be negative');
  if (approvedBudgetMinor === 0n) return spentMinor > 0n ? 10000 : 0;
  const bp = (spentMinor * 10000n) / approvedBudgetMinor;
  return Number(bp > 10000n ? 10000n : bp);
}

export function remainingReservedMinor(snapshot: CampaignBudgetSnapshot): bigint {
  if (snapshot.reservedMinor < 0n || snapshot.spentMinor < 0n || snapshot.availableReservedMinor < 0n) throw new Error('Budget snapshot values cannot be negative');
  return snapshot.availableReservedMinor;
}

export function spendVelocityMinorPerMinute(currentWindowSpendMinor: bigint, windowDurationSeconds: number): bigint {
  if (currentWindowSpendMinor < 0n) throw new Error('Spend cannot be negative');
  if (!Number.isFinite(windowDurationSeconds) || windowDurationSeconds <= 0) throw new Error('Window duration must be positive');
  return (currentWindowSpendMinor * 60n) / BigInt(Math.ceil(windowDurationSeconds));
}

export function assertSnapshotConsistency(snapshot: CampaignBudgetSnapshot): void {
  if (!/^[A-Z]{3}$/.test(snapshot.currency)) throw new Error('Invalid currency');
  if (snapshot.approvedBudgetMinor < 0n || snapshot.reservedMinor < 0n || snapshot.spentMinor < 0n || snapshot.availableReservedMinor < 0n) throw new Error('Snapshot values cannot be negative');
  if (snapshot.availableReservedMinor > snapshot.reservedMinor) throw new Error('Available reservation cannot exceed total reservation');
}
