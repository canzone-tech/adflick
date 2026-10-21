import type { PreventiveAction, PreventiveActionStatus } from "./incident-review.types";

const actionTransitions: Record<PreventiveActionStatus, readonly PreventiveActionStatus[]> = {
  OPEN: ["IN_PROGRESS", "BLOCKED", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "COMPLETED", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: ["VERIFIED", "IN_PROGRESS"],
  VERIFIED: [],
  CANCELLED: [],
};

export function canTransitionAction(from: PreventiveActionStatus, to: PreventiveActionStatus): boolean {
  return actionTransitions[from].includes(to);
}

export function isActionOverdue(action: PreventiveAction, now: Date): boolean {
  if (!action.dueAt || ["COMPLETED", "VERIFIED", "CANCELLED"].includes(action.status)) return false;
  const dueAt = Date.parse(action.dueAt);
  return Number.isFinite(dueAt) && dueAt < now.getTime();
}

export function validateActionCompletion(input: {
  status: PreventiveActionStatus;
  actorUserId?: string;
  completionEvidence?: string;
}): { accepted: true; verificationRequired: true } {
  if (input.status !== "COMPLETED") throw new Error("ACTION_NOT_COMPLETED");
  if (!input.actorUserId?.trim()) throw new Error("ACTOR_REQUIRED");
  if (!input.completionEvidence?.trim()) throw new Error("COMPLETION_EVIDENCE_REQUIRED");
  return { accepted: true, verificationRequired: true };
}

export function validateActionTransition(input: {
  from: PreventiveActionStatus;
  to: PreventiveActionStatus;
  actorUserId?: string;
  completionEvidence?: string;
}): { accepted: true; verificationRequired: boolean } {
  if (!input.actorUserId?.trim()) throw new Error("ACTOR_REQUIRED");
  if (!canTransitionAction(input.from, input.to)) throw new Error("INVALID_ACTION_TRANSITION");
  if (input.to === "COMPLETED") {
    validateActionCompletion({
      status: input.to,
      actorUserId: input.actorUserId,
      completionEvidence: input.completionEvidence,
    });
  }
  return { accepted: true, verificationRequired: input.to === "COMPLETED" };
}
