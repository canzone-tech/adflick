export type RiskBand = "LOW" | "GUARDED" | "HIGH" | "CRITICAL";
export type MaintenanceStatus = "PLANNED" | "APPROVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type MaintenanceTaskStatus = "PLANNED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "VERIFIED" | "CANCELLED";

export interface ReliabilityInputs {
  heartbeatCoverage?: number;
  commandSuccessRate?: number;
  playbackErrorRate?: number;
  updateFailureRate?: number;
  sampleCount: number;
}
export interface ReliabilityResult {
  score: number | null;
  riskBand: RiskBand | "UNKNOWN";
  dataCoverage: number;
  sampleCount: number;
  warnings: string[];
}
export interface MaintenanceWindowInput {
  tenantId: string;
  deviceId: string;
  startsAt: string;
  endsAt: string;
  displayTimezone: string;
}
