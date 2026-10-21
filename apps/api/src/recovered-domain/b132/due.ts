import type { PlanAssignment, PreventivePlan } from "./types";

export interface DueResult { due: boolean; dueAt?: string; reason: string; occurrenceKey?: string; }

export function isValidIanaTimezone(timezone: string): boolean {
  if (!timezone || timezone.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); return true; }
  catch { return false; }
}

export function evaluateDue(plan: PreventivePlan, assignment: PlanAssignment, nowIso: string): DueResult {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) throw new Error("Invalid now timestamp.");
  if (plan.tenantId !== assignment.tenantId || plan.id !== assignment.planId) return { due: false, reason: "TENANT_OR_PLAN_MISMATCH" };
  if (plan.status !== "ACTIVE" || !assignment.active) return { due: false, reason: "INACTIVE" };
  if (!isValidIanaTimezone(plan.timezone)) return { due: false, reason: "INVALID_TIMEZONE" };
  if (!Number.isInteger(plan.cadenceValue) || plan.cadenceValue <= 0) return { due: false, reason: "INVALID_CADENCE" };
  if (!Number.isInteger(plan.leadTimeMinutes) || plan.leadTimeMinutes < 0) return { due: false, reason: "INVALID_LEAD_TIME" };
  if (!assignment.nextDueAt) return { due: false, reason: "NO_DUE_DATE" };
  const due = Date.parse(assignment.nextDueAt);
  if (!Number.isFinite(due)) return { due: false, reason: "INVALID_DUE_DATE" };
  const leadMs = plan.leadTimeMinutes * 60_000;
  if (now < due - leadMs) return { due: false, dueAt: new Date(due).toISOString(), reason: "NOT_YET_IN_LEAD_WINDOW" };
  const occurrenceKey = `${assignment.id}:${new Date(due).toISOString()}:v${plan.version}`;
  return { due: true, dueAt: new Date(due).toISOString(), occurrenceKey, reason: now >= due ? "DUE" : "LEAD_WINDOW" };
}
