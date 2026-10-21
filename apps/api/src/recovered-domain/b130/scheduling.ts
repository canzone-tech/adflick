import type { MaintenanceWindow } from "./types";

export interface SchedulingIssue {
  code: "INVALID_RANGE" | "INVALID_TIMEZONE" | "APPROVAL_REQUIRED" | "OVERLAP";
  message: string;
  conflictingWindowId?: string;
}

const activeWindowStatuses = new Set(["APPROVED", "SCHEDULED", "IN_PROGRESS"]);
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function validateWindow(candidate: MaintenanceWindow, existing: MaintenanceWindow[]): SchedulingIssue[] {
  const issues: SchedulingIssue[] = [];
  if (!ISO_INSTANT.test(candidate.startsAt) || !ISO_INSTANT.test(candidate.endsAt)) {
    issues.push({ code: "INVALID_RANGE", message: "Start and end must be explicit ISO-8601 instants with an offset." });
    return issues;
  }
  const start = Date.parse(candidate.startsAt);
  const end = Date.parse(candidate.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    issues.push({ code: "INVALID_RANGE", message: "End must be after start and both timestamps must be valid." });
    return issues;
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate.timezone }).format(new Date(start));
  } catch {
    issues.push({ code: "INVALID_TIMEZONE", message: "A valid IANA timezone is required for calendar display." });
  }
  if (candidate.approvalRequired && candidate.approvalStatus !== "APPROVED") {
    issues.push({ code: "APPROVAL_REQUIRED", message: "Approval is required before scheduling." });
  }

  for (const other of existing) {
    if (other.id === candidate.id || other.tenantId !== candidate.tenantId ||
        other.deviceId !== candidate.deviceId || !activeWindowStatuses.has(other.status)) continue;
    const otherStart = Date.parse(other.startsAt), otherEnd = Date.parse(other.endsAt);
    if (Number.isFinite(otherStart) && Number.isFinite(otherEnd) && otherEnd > otherStart &&
        start < otherEnd && otherStart < end) {
      issues.push({
        code: "OVERLAP",
        message: "The device already has an overlapping active maintenance window.",
        conflictingWindowId: other.id,
      });
    }
  }
  return issues;
}

/** Half-open intervals: adjacent windows are allowed. This is preflight policy only. */
export function windowsOverlap(a: Pick<MaintenanceWindow, "startsAt" | "endsAt">,
  b: Pick<MaintenanceWindow, "startsAt" | "endsAt">): boolean {
  const startA = Date.parse(a.startsAt), endA = Date.parse(a.endsAt);
  const startB = Date.parse(b.startsAt), endB = Date.parse(b.endsAt);
  if (![startA, endA, startB, endB].every(Number.isFinite) || endA <= startA || endB <= startB) {
    throw new Error("INVALID_MAINTENANCE_WINDOW");
  }
  return startA < endB && startB < endA;
}

/** Caller must repeat this check inside a concurrency-safe database transaction before writing. */
export function assertWindowSchedulable(candidate: MaintenanceWindow, existing: MaintenanceWindow[]): void {
  const issues = validateWindow(candidate, existing);
  if (issues.length) throw new Error(issues.map(issue => issue.code).join(","));
}
