export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PacingMode = 'EVEN' | 'ASAP' | 'FRONT_LOADED' | 'CUSTOM';
export interface LocalScheduleMoment { weekday: IsoWeekday; minuteOfDay: number; instantUtc: Date; timezone: string; }
export interface DaypartWindow { weekday: IsoWeekday; startMinuteLocal: number; endMinuteLocal: number; enabled: boolean; }
export interface CampaignSchedule {
  campaignId: string; timezone: string; startsAtUtc: Date; endsAtUtc: Date;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';
  dayparts: DaypartWindow[]; dailyImpressionCap?: bigint | null; totalImpressionCap?: bigint | null;
  dailySpendCapMinor?: bigint | null; totalSpendCapMinor?: bigint | null; maxPlaysPerDeviceDay?: number | null;
}
export interface DeliveryCounters { impressionsToday: bigint; totalImpressions: bigint; spendTodayMinor: bigint; totalSpendMinor: bigint; playsForDeviceToday: number; }
export interface DeliveryEligibilityInput {
  nowUtc: Date; localMoment: LocalScheduleMoment; schedule: CampaignSchedule; counters: DeliveryCounters;
  campaignApproved: boolean; accountAllowed: boolean; reservationValid: boolean; reservationRemainingMinor: bigint; nextBillableSpendMinor?: bigint;
}
export interface DeliveryDecision {
  eligible: boolean;
  reasonCode: 'ELIGIBLE' | 'NOT_APPROVED' | 'ACCOUNT_RESTRICTED' | 'SCHEDULE_INACTIVE' | 'OUTSIDE_DAYPART' | 'BUDGET_RESERVATION_INVALID' | 'BUDGET_EXHAUSTED' | 'DAILY_IMPRESSION_CAP' | 'TOTAL_IMPRESSION_CAP' | 'DAILY_SPEND_CAP' | 'TOTAL_SPEND_CAP' | 'DEVICE_PLAY_CAP';
}
