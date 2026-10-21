import type { PlanAssignment, PreventivePlan } from "./types";
import { evaluateDue } from "./due";

export interface GenerationProposal {
  tenantId: string; assignmentId: string; deviceId: string; planId: string;
  occurrenceKey: string; dueAt: string; priority: string; checklistVersion: number;
}

export function proposeWorkOrder(plan: PreventivePlan, assignment: PlanAssignment, nowIso: string, priority: string): GenerationProposal | null {
  const due = evaluateDue(plan, assignment, nowIso);
  if (!due.due || !due.occurrenceKey || !due.dueAt) return null;
  if (!priority.trim()) throw new Error("Work-order priority is required.");
  return { tenantId: plan.tenantId, assignmentId: assignment.id, deviceId: assignment.deviceId,
    planId: plan.id, occurrenceKey: due.occurrenceKey, dueAt: due.dueAt, priority, checklistVersion: plan.version };
}

export function generationIdempotencyKey(tenantId: string, assignmentId: string, occurrenceKey: string): string {
  if (!tenantId || !assignmentId || !occurrenceKey) throw new Error("Generation idempotency fields are required.");
  return `${tenantId}:${assignmentId}:${occurrenceKey}`;
}
