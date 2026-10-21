import type { SlaClock } from "./types";

export interface SlaEvaluation {
  response: "MET" | "BREACHED" | "PENDING" | "PAUSED";
  resolution: "MET" | "BREACHED" | "PENDING" | "PAUSED";
  evaluatedAt: string; responseMinutesLate?: number; resolutionMinutesLate?: number;
}

export function evaluateSla(clock: SlaClock, nowIso: string): SlaEvaluation {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) throw new Error("Invalid evaluation timestamp.");
  const responseDue = Date.parse(clock.responseDueAt), resolutionDue = Date.parse(clock.resolutionDueAt);
  if (![responseDue, resolutionDue].every(Number.isFinite)) throw new Error("Invalid SLA deadline.");
  const responseAt = clock.firstResponseAt ? Date.parse(clock.firstResponseAt) : undefined;
  const resolvedAt = clock.resolvedAt ? Date.parse(clock.resolvedAt) : undefined;
  const response = clock.state === "PAUSED" ? "PAUSED"
    : responseAt !== undefined && Number.isFinite(responseAt) ? (responseAt <= responseDue ? "MET" : "BREACHED")
    : now <= responseDue ? "PENDING" : "BREACHED";
  const resolution = clock.state === "PAUSED" ? "PAUSED"
    : resolvedAt !== undefined && Number.isFinite(resolvedAt) ? (resolvedAt <= resolutionDue ? "MET" : "BREACHED")
    : clock.state === "STOPPED" ? "PENDING" : now <= resolutionDue ? "PENDING" : "BREACHED";
  return {
    response, resolution, evaluatedAt: new Date(now).toISOString(),
    ...(response === "BREACHED" ? { responseMinutesLate: Math.max(0, Math.floor(((responseAt ?? now) - responseDue) / 60000)) } : {}),
    ...(resolution === "BREACHED" ? { resolutionMinutesLate: Math.max(0, Math.floor(((resolvedAt ?? now) - resolutionDue) / 60000)) } : {}),
  };
}
