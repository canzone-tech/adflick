import { validateDaypart, validateSchedule, isWithinDaypart } from '../src/campaign-scheduling/schedule';
import { evaluateDeliveryEligibility } from '../src/campaign-scheduling/delivery-gate';
import { calculatePacing } from '../src/campaign-scheduling/pacing';
import { CampaignSchedule, LocalScheduleMoment } from '../src/campaign-scheduling/types';

const start = new Date('2026-01-01T00:00:00Z');
const end = new Date('2026-01-03T00:00:00Z');
const schedule: CampaignSchedule = {
  campaignId: 'c1', timezone: 'Asia/Kolkata', startsAtUtc: start, endsAtUtc: end, status: 'ACTIVE',
  dayparts: [{ weekday: 4, startMinuteLocal: 540, endMinuteLocal: 1020, enabled: true }],
  dailyImpressionCap: 100n, totalImpressionCap: 1000n, dailySpendCapMinor: 5000n, totalSpendCapMinor: 50000n, maxPlaysPerDeviceDay: 20,
};
const moment: LocalScheduleMoment = { weekday: 4, minuteOfDay: 600, instantUtc: new Date('2026-01-01T05:00:00Z'), timezone: 'Asia/Kolkata' };
const baseInput = () => ({ nowUtc: new Date('2026-01-01T05:00:00Z'), localMoment: moment, schedule, counters: { impressionsToday: 10n, totalImpressions: 100n, spendTodayMinor: 1000n, totalSpendMinor: 2000n, playsForDeviceToday: 5 }, campaignApproved: true, accountAllowed: true, reservationValid: true, reservationRemainingMinor: 10000n, nextBillableSpendMinor: 10n });

describe('Batch 111 campaign scheduling', () => {
  it('validates daypart boundaries', () => {
    expect(() => validateDaypart({ weekday: 1, startMinuteLocal: 0, endMinuteLocal: 1440, enabled: true })).not.toThrow();
    expect(() => validateDaypart({ weekday: 1, startMinuteLocal: 700, endMinuteLocal: 600, enabled: true })).toThrow();
  });
  it('rejects overlapping dayparts on the same weekday', () => {
    const bad = { ...schedule, dayparts: [{ weekday: 4 as const, startMinuteLocal: 500, endMinuteLocal: 700, enabled: true }, { weekday: 4 as const, startMinuteLocal: 650, endMinuteLocal: 800, enabled: true }] };
    expect(() => validateSchedule(bad)).toThrow('Overlapping');
  });
  it('uses inclusive start and exclusive end for dayparts', () => {
    expect(isWithinDaypart({ ...moment, minuteOfDay: 540 }, schedule.dayparts)).toBe(true);
    expect(isWithinDaypart({ ...moment, minuteOfDay: 1020 }, schedule.dayparts)).toBe(false);
  });
  it('allows delivery only when all controls pass', () => {
    expect(evaluateDeliveryEligibility(baseInput())).toEqual({ eligible: true, reasonCode: 'ELIGIBLE' });
  });
  it('fails closed on exhausted reservation and outside schedule', () => {
    expect(evaluateDeliveryEligibility({ ...baseInput(), reservationRemainingMinor: 0n })).toEqual({ eligible: false, reasonCode: 'BUDGET_EXHAUSTED' });
    expect(evaluateDeliveryEligibility({ ...baseInput(), nowUtc: new Date('2026-01-04T00:00:00Z') })).toEqual({ eligible: false, reasonCode: 'SCHEDULE_INACTIVE' });
  });
  it('returns remaining budget and expected spend for even pacing', () => {
    const result = calculatePacing({ mode: 'EVEN', campaignStartUtc: start, campaignEndUtc: end, nowUtc: new Date('2026-01-02T00:00:00Z'), totalBudgetMinor: 10000n, actualSpendMinor: 4000n, actualImpressions: 20n, totalImpressionCap: 100n });
    expect(result.expectedSpendMinor).toBe(5000n);
    expect(result.remainingBudgetMinor).toBe(6000n);
    expect(result.remainingImpressions).toBe(80n);
  });
});
