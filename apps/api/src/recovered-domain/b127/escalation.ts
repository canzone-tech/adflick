import type { EscalationRule, Incident } from "./fleet-ops.types";

export interface EscalationProposal {
  shouldEscalate: boolean;
  ruleId: string;
  idempotencyKey: string;
  reasonCode: string;
}

/** Decision-only helper. It does not persist or deliver; a durable worker must enforce retries and receipts. */
export function proposeEscalation(
  incident: Incident,
  rule: EscalationRule,
  now: Date,
  alreadyAttempted: boolean,
): EscalationProposal {
  const ageMs = now.getTime() - Date.parse(incident.createdAt);
  const validRule = Number.isFinite(rule.afterMinutes) && rule.afterMinutes >= 0
    && Number.isInteger(rule.maxAttempts) && rule.maxAttempts > 0
    && Boolean(rule.targetRole.trim());
  const shouldEscalate = rule.enabled && validRule
    && incident.status !== "RESOLVED" && incident.status !== "CLOSED"
    && Number.isFinite(ageMs) && ageMs >= rule.afterMinutes * 60_000
    && !alreadyAttempted;
  return {
    shouldEscalate,
    ruleId: rule.id,
    idempotencyKey: `${incident.tenantId}:${incident.id}:${rule.id}`,
    reasonCode: shouldEscalate ? "AGE_THRESHOLD_REACHED" : "NOT_ELIGIBLE",
  };
}
