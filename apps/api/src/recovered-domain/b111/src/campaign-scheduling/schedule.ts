import { CampaignSchedule, DaypartWindow, LocalScheduleMoment } from './types';

export function validateDaypart(window: DaypartWindow): void {
  if (!Number.isInteger(window.weekday) || window.weekday < 1 || window.weekday > 7) throw new Error('weekday must use ISO numbering 1..7');
  if (!Number.isInteger(window.startMinuteLocal) || window.startMinuteLocal < 0 || window.startMinuteLocal > 1439) throw new Error('startMinuteLocal must be in range 0..1439');
  if (!Number.isInteger(window.endMinuteLocal) || window.endMinuteLocal < 1 || window.endMinuteLocal > 1440) throw new Error('endMinuteLocal must be in range 1..1440');
  if (window.endMinuteLocal <= window.startMinuteLocal) throw new Error('Daypart end must be after start; use two windows for midnight-crossing periods');
}

export function validateSchedule(schedule: CampaignSchedule): void {
  if (!schedule.campaignId.trim()) throw new Error('campaignId is required');
  if (!schedule.timezone.trim() || !schedule.timezone.includes('/')) throw new Error('An explicit IANA timezone is required');
  if (!Number.isFinite(schedule.startsAtUtc.getTime()) || !Number.isFinite(schedule.endsAtUtc.getTime()) || schedule.endsAtUtc <= schedule.startsAtUtc) throw new Error('Schedule end must be after start');
  for (const w of schedule.dayparts) validateDaypart(w);
  const active = schedule.dayparts.filter(w => w.enabled);
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = active[i], b = active[j];
    if (a.weekday === b.weekday && Math.max(a.startMinuteLocal, b.startMinuteLocal) < Math.min(a.endMinuteLocal, b.endMinuteLocal)) throw new Error('Overlapping daypart windows are not allowed');
  }
}

export function isWithinDaypart(moment: LocalScheduleMoment, windows: DaypartWindow[]): boolean {
  const today = windows.filter(w => w.enabled && w.weekday === moment.weekday);
  if (today.length === 0) return false;
  return today.some(w => moment.minuteOfDay >= w.startMinuteLocal && moment.minuteOfDay < w.endMinuteLocal);
}
