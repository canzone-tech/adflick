export type WorkOrderStatus = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";
export type ConflictType = "TECHNICIAN_OVERLAP" | "DEVICE_OVERLAP" | "OUTSIDE_AVAILABILITY" | "SKILL_MISMATCH" | "MAINTENANCE_WINDOW_OVERLAP";

export interface Technician {
  id: string;
  displayName: string;
  timezone: string;
  active: boolean;
  skills: string[];
  capacityPerDay: number;
}

export interface AvailabilityWindow {
  technicianId: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
}

export interface CalendarWorkOrder {
  id: string;
  tenantId: string;
  title: string;
  deviceId: string;
  technicianId?: string;
  startsAt: string;
  endsAt: string;
  status: WorkOrderStatus;
  requiredSkills: string[];
  plannedDowntime: boolean;
}

export interface ScheduleConflict {
  type: ConflictType;
  resourceId: string;
  message: string;
  workOrderIds: string[];
  blocking: boolean;
}

export interface ScheduleProposal {
  workOrderId: string;
  technicianId: string;
  startsAt: string;
  endsAt: string;
  conflicts: ScheduleConflict[];
  canConfirm: boolean;
}
