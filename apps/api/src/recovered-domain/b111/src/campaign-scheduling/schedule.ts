export type ScheduleWindow = { startAt: Date; endAt: Date; timezone: string };
export type CampaignSchedule = {
  id: string;
  campaignId: string;
  windows: ScheduleWindow[];
  priority: number;
};

export function validateSchedule(schedule: CampaignSchedule): void {
  if (!schedule.id || !schedule.campaignId) throw new Error('Schedule identifiers are required.');
  if (!schedule.windows.length) throw new Error('At least one schedule window is required.');
  for (const window of schedule.windows) {
    if (!(window.startAt instanceof Date) || Number.isNaN(window.startAt.getTime())) throw new Error('Invalid schedule start.');
    if (!(window.endAt instanceof Date) || Number.isNaN(window.endAt.getTime())) throw new Error('Invalid schedule end.');
    if (window.endAt <= window.startAt) throw new Error('Schedule end must be after start.');
    if (!window.timezone) throw new Error('Schedule timezone is required.');
  }
  for (let i = 0; i < schedule.windows.length; i += 1) {
    for (let j = i + 1; j < schedule.windows.length; j += 1) {
      const a = schedule.windows[i]!;
      const b = schedule.windows[j]!;
      if (a.startAt < b.endAt && b.startAt < a.endAt) throw new Error('Schedule windows must not overlap.');
    }
  }
}

export function isActiveAt(schedule: CampaignSchedule, at: Date): boolean {
  validateSchedule(schedule);
  return schedule.windows.some((window) => at >= window.startAt && at < window.endAt);
}

export function sortSchedules(schedules: CampaignSchedule[]): CampaignSchedule[] {
  return [...schedules].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
}
