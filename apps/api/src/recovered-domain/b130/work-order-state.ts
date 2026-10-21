import type { MaintenanceWorkOrder, WorkOrderStatus } from "./types";

const transitions: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["ACCEPTED", "OPEN", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "BLOCKED", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "WORK_COMPLETED", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  WORK_COMPLETED: ["VERIFIED", "IN_PROGRESS"],
  VERIFIED: [],
  CANCELLED: [],
};

export interface WorkOrderTransitionRequest {
  to: WorkOrderStatus;
  actorUserId?: string;
  reason?: string;
  completionSummary?: string;
  evidenceRefs?: string[];
  verifierUserId?: string;
  highImpact?: boolean;
}

export function allowedNextWorkOrderStates(status: WorkOrderStatus): WorkOrderStatus[] {
  return [...transitions[status]];
}

export function validateWorkOrderTransition(order: MaintenanceWorkOrder, request: WorkOrderTransitionRequest): string[] {
  const errors: string[] = [];
  if (!request.actorUserId?.trim()) errors.push("ACTOR_REQUIRED");
  if (!transitions[order.status].includes(request.to)) errors.push("INVALID_WORK_ORDER_TRANSITION");
  if (request.to === "BLOCKED" && !request.reason?.trim()) errors.push("BLOCKED_REASON_REQUIRED");
  if (request.to === "CANCELLED" && !request.reason?.trim()) errors.push("CANCELLATION_REASON_REQUIRED");

  if (request.to === "WORK_COMPLETED") {
    if (!request.completionSummary?.trim()) errors.push("COMPLETION_SUMMARY_REQUIRED");
    if (!(request.evidenceRefs?.length)) errors.push("COMPLETION_EVIDENCE_REQUIRED");
  }
  if (request.to === "VERIFIED") {
    if (!request.verifierUserId?.trim()) errors.push("VERIFIER_REQUIRED");
    if (request.verifierUserId && request.verifierUserId === order.technicianId) errors.push("INDEPENDENT_VERIFIER_REQUIRED");
    if (request.highImpact && !(order.evidenceRefs?.length || request.evidenceRefs?.length)) errors.push("HIGH_IMPACT_EVIDENCE_REQUIRED");
  }
  return errors;
}
