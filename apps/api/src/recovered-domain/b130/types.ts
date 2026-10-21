export type MaintenanceWindowStatus =
  | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SCHEDULED"
  | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "FAILED";

export type WorkOrderStatus =
  | "OPEN" | "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS"
  | "BLOCKED" | "WORK_COMPLETED" | "VERIFIED" | "CANCELLED";

export type MaintenancePriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export interface MaintenanceWindow {
  id: string;
  tenantId: string;
  deviceId: string;
  title: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  status: MaintenanceWindowStatus;
  approvalRequired: boolean;
  approvalStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
}

export interface MaintenanceWorkOrder {
  id: string;
  tenantId: string;
  deviceId: string;
  title: string;
  status: WorkOrderStatus;
  priority: MaintenancePriority;
  technicianId?: string;
  dueAt?: string;
  evidenceRefs: string[];
  completionSummary?: string;
  verifiedBy?: string;
}
