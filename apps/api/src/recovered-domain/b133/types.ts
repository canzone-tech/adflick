export type PlanStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "RETIRED";
export type AlertSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "SUPPRESSED" | "RESOLVED";
export type RunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";

export interface MaintenancePlanRow {
  id: string;
  name: string;
  status: PlanStatus;
  assignedDevices: number;
  nextDueAt?: string;
  timezone: string;
  version: number;
}
export interface MaintenanceAlertRow {
  id: string;
  deviceLabel: string;
  title: string;
  severity: AlertSeverity;
  status: AlertStatus;
  lastSeenAt: string;
  sampleCount: number;
  coverage: number;
}
export interface AutomationRunRow {
  id: string;
  status: RunStatus;
  startedAt?: string;
  finishedAt?: string;
  proposedCount: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
}
export interface DashboardSnapshot {
  plans: MaintenancePlanRow[];
  alerts: MaintenanceAlertRow[];
  runs: AutomationRunRow[];
  generatedAt: string;
  coverage: number;
}
