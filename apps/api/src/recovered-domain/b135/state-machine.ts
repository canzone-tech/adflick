import type { ChecklistItem, EvidenceItem, WorkOrderActionResult, WorkOrderStatus } from "./types";

export type WorkOrderAction = "CHECK_IN" | "START" | "BLOCK" | "RESUME" | "SUBMIT" | "CANCEL";

export function transitionWorkOrder(
  status: WorkOrderStatus,
  action: WorkOrderAction,
  checklist: ChecklistItem[],
  evidence: EvidenceItem[],
  blockedReason?: string,
): WorkOrderActionResult {
  switch (action) {
    case "CHECK_IN":
      return status === "SCHEDULED"
        ? { allowed: true, nextStatus: "CHECKED_IN" }
        : { allowed: false, reason: "Only scheduled work orders can be checked in." };
    case "START":
      return status === "CHECKED_IN"
        ? { allowed: true, nextStatus: "IN_PROGRESS" }
        : { allowed: false, reason: "Check in before starting work." };
    case "BLOCK":
      return ["CHECKED_IN", "IN_PROGRESS"].includes(status) && !!blockedReason?.trim()
        ? { allowed: true, nextStatus: "BLOCKED" }
        : { allowed: false, reason: "An active work order and a non-empty blocked reason are required." };
    case "RESUME":
      return status === "BLOCKED"
        ? { allowed: true, nextStatus: "IN_PROGRESS" }
        : { allowed: false, reason: "Only blocked work can be resumed." };
    case "SUBMIT": {
      if (status !== "IN_PROGRESS") return { allowed: false, reason: "Only work in progress can be submitted." };
      const missing = checklist.some((item) => item.required && item.value === undefined);
      if (missing) return { allowed: false, reason: "Complete all required checklist items." };
      const failed = checklist.some((item) => item.required && item.value === "FAIL");
      if (failed) return { allowed: true, nextStatus: "VERIFICATION_REQUIRED", reason: "Required checks failed; independent review is required." };
      const pendingEvidence = evidence.some((item) => item.uploadStatus !== "UPLOADED");
      if (pendingEvidence) return { allowed: false, reason: "Finish or remove failed evidence uploads before submission." };
      return { allowed: true, nextStatus: "SUBMITTED" };
    }
    case "CANCEL":
      return ["SCHEDULED", "CHECKED_IN", "BLOCKED"].includes(status)
        ? { allowed: true, nextStatus: "CANCELLED" }
        : { allowed: false, reason: "This work order cannot be cancelled from its current state." };
  }
}
