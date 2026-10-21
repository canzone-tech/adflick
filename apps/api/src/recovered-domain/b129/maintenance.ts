import type { MaintenanceTaskStatus, MaintenanceWindowInput } from "./types";

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function validateMaintenanceWindow(input: MaintenanceWindowInput) {
  if (!input.tenantId.trim() || !input.deviceId.trim()) throw new Error("DEVICE_SCOPE_REQUIRED");
  if (!ISO_INSTANT.test(input.startsAt) || !ISO_INSTANT.test(input.endsAt)) throw new Error("UTC_INSTANT_REQUIRED");
  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("INVALID_MAINTENANCE_WINDOW");
  if (!input.displayTimezone.trim()) throw new Error("TIMEZONE_REQUIRED");
  try { new Intl.DateTimeFormat("en", { timeZone: input.displayTimezone }).format(new Date(start)); }
  catch { throw new Error("INVALID_DISPLAY_TIMEZONE"); }
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), displayTimezone: input.displayTimezone };
}

/** Half-open intervals [start,end); adjacent windows do not overlap. */
export function windowsOverlap(a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }): boolean {
  const as = Date.parse(a.startsAt), ae = Date.parse(a.endsAt);
  const bs = Date.parse(b.startsAt), be = Date.parse(b.endsAt);
  if (![as, ae, bs, be].every(Number.isFinite) || ae <= as || be <= bs) throw new Error("INVALID_MAINTENANCE_WINDOW");
  return as < be && bs < ae;
}

const transitions: Record<MaintenanceTaskStatus, readonly MaintenanceTaskStatus[]> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "COMPLETED", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: ["VERIFIED", "IN_PROGRESS"],
  VERIFIED: [],
  CANCELLED: [],
};
export function canTransitionMaintenanceTask(from: MaintenanceTaskStatus, to: MaintenanceTaskStatus): boolean {
  return transitions[from].includes(to);
}
export function validateMaintenanceTaskTransition(input: {
  from: MaintenanceTaskStatus; to: MaintenanceTaskStatus; actorUserId?: string; evidence?: string;
}): { accepted: true; verificationRequired: boolean; auditRequired: true } {
  if (!input.actorUserId?.trim()) throw new Error("ACTOR_REQUIRED");
  if (!canTransitionMaintenanceTask(input.from, input.to)) throw new Error("INVALID_MAINTENANCE_TASK_TRANSITION");
  if (input.to === "COMPLETED" && !input.evidence?.trim()) throw new Error("COMPLETION_EVIDENCE_REQUIRED");
  return { accepted: true, verificationRequired: input.to === "COMPLETED", auditRequired: true };
}
