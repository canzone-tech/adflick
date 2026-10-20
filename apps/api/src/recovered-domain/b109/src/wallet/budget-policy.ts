import { assertPositiveMinorUnits } from './money';

export interface CampaignBudgetPolicy {
  campaignLimitMinor: bigint; advertiserDailyLimitMinor: bigint; dailySpentMinor: bigint;
  campaignSpentMinor: bigint; campaignReservedMinor: bigint; requestedReservationMinor: bigint;
}

export function validateBudgetReservation(policy: CampaignBudgetPolicy): void {
  assertPositiveMinorUnits(policy.requestedReservationMinor);
  for (const [name, amount] of Object.entries({ campaignLimitMinor: policy.campaignLimitMinor, advertiserDailyLimitMinor: policy.advertiserDailyLimitMinor, dailySpentMinor: policy.dailySpentMinor, campaignSpentMinor: policy.campaignSpentMinor, campaignReservedMinor: policy.campaignReservedMinor })) {
    if (amount < 0n) throw new Error(`${name} cannot be negative`);
  }
  if (policy.campaignSpentMinor + policy.campaignReservedMinor + policy.requestedReservationMinor > policy.campaignLimitMinor) throw new Error('Campaign budget limit exceeded');
  if (policy.dailySpentMinor + policy.requestedReservationMinor > policy.advertiserDailyLimitMinor) throw new Error('Advertiser daily spending limit exceeded');
}

export function validateSpendAgainstReservation(remainingReservationMinor: bigint, spendMinor: bigint): void {
  assertPositiveMinorUnits(spendMinor);
  if (remainingReservationMinor < 0n) throw new Error('Remaining reservation cannot be negative');
  if (spendMinor > remainingReservationMinor) throw new Error("Spend exceeds the campaign's remaining reservation");
}
