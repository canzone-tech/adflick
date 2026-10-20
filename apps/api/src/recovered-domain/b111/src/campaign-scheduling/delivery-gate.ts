import { DeliveryDecision, DeliveryEligibilityInput } from './types';
import { isWithinDaypart, validateSchedule } from './schedule';

export function evaluateDeliveryEligibility(input: DeliveryEligibilityInput): DeliveryDecision {
  const { schedule, counters } = input;
  validateSchedule(schedule);
  if (!input.campaignApproved) return { eligible: false, reasonCode: 'NOT_APPROVED' };
  if (!input.accountAllowed) return { eligible: false, reasonCode: 'ACCOUNT_RESTRICTED' };
  if (schedule.status !== 'ACTIVE' && schedule.status !== 'SCHEDULED') return { eligible: false, reasonCode: 'SCHEDULE_INACTIVE' };
  if (input.nowUtc < schedule.startsAtUtc || input.nowUtc >= schedule.endsAtUtc) return { eligible: false, reasonCode: 'SCHEDULE_INACTIVE' };
  if (input.localMoment.timezone !== schedule.timezone) return { eligible: false, reasonCode: 'OUTSIDE_DAYPART' };
  if (schedule.dayparts.length > 0 && !isWithinDaypart(input.localMoment, schedule.dayparts)) return { eligible: false, reasonCode: 'OUTSIDE_DAYPART' };
  if (!input.reservationValid) return { eligible: false, reasonCode: 'BUDGET_RESERVATION_INVALID' };
  if (input.reservationRemainingMinor <= 0n) return { eligible: false, reasonCode: 'BUDGET_EXHAUSTED' };
  if (input.nextBillableSpendMinor != null && input.nextBillableSpendMinor > input.reservationRemainingMinor) return { eligible: false, reasonCode: 'BUDGET_EXHAUSTED' };
  if (schedule.dailyImpressionCap != null && counters.impressionsToday >= schedule.dailyImpressionCap) return { eligible: false, reasonCode: 'DAILY_IMPRESSION_CAP' };
  if (schedule.totalImpressionCap != null && counters.totalImpressions >= schedule.totalImpressionCap) return { eligible: false, reasonCode: 'TOTAL_IMPRESSION_CAP' };
  if (schedule.dailySpendCapMinor != null && counters.spendTodayMinor >= schedule.dailySpendCapMinor) return { eligible: false, reasonCode: 'DAILY_SPEND_CAP' };
  if (schedule.totalSpendCapMinor != null && counters.totalSpendMinor >= schedule.totalSpendCapMinor) return { eligible: false, reasonCode: 'TOTAL_SPEND_CAP' };
  if (schedule.maxPlaysPerDeviceDay != null && counters.playsForDeviceToday >= schedule.maxPlaysPerDeviceDay) return { eligible: false, reasonCode: 'DEVICE_PLAY_CAP' };
  return { eligible: true, reasonCode: 'ELIGIBLE' };
}
