import type { IncidentStatus } from "./fleet-ops.types";

const transitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  OPEN: ["ACKNOWLEDGED", "INVESTIGATING", "RESOLVED"],
  ACKNOWLEDGED: ["INVESTIGATING", "MITIGATED", "RESOLVED"],
  INVESTIGATING: ["MITIGATED", "RESOLVED"],
  MITIGATED: ["INVESTIGATING", "RESOLVED"],
  RESOLVED: ["CLOSED", "INVESTIGATING"],
  CLOSED: [],
};

export function canMoveIncident(from: IncidentStatus, to: IncidentStatus): boolean {
  return transitions[from].includes(to);
}

export function validateIncidentAction(input: {
  from: IncidentStatus;
  to: IncidentStatus;
  actorUserId?: string;
  reasonCode?: string;
}) {
  if (!input.actorUserId?.trim()) throw new Error("ACTOR_REQUIRED");
  if (!canMoveIncident(input.from, input.to)) {
    throw new Error(`INVALID_INCIDENT_TRANSITION:${input.from}:${input.to}`);
  }
  if ((input.to === "RESOLVED" || input.to === "CLOSED") && !input.reasonCode?.trim()) {
    throw new Error("RESOLUTION_REASON_REQUIRED");
  }
  return { accepted: true as const, auditRequired: true as const };
}
