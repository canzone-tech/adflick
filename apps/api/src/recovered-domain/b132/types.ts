export type PlanStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "RETIRED";
export type CadenceUnit = "DAY" | "WEEK" | "MONTH" | "METER_HOUR" | "PLAYBACK_HOUR";
export type AlertSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";
export type Comparator = "GT" | "GTE" | "LT" | "LTE";

export interface PreventivePlan {
  id: string; tenantId: string; status: PlanStatus; cadenceUnit: CadenceUnit;
  cadenceValue: number; timezone: string; leadTimeMinutes: number; version: number;
}
export interface PlanAssignment {
  id: string; tenantId: string; planId: string; deviceId: string; active: boolean;
  nextDueAt?: string; lastCompletedAt?: string;
}
export interface MetricObservation {
  tenantId: string; deviceId: string; metric: string; value: number;
  sampleCount: number; coverage: number; observedAt: string;
}
export interface AlertRule {
  id: string; tenantId: string; metric: string; comparator: Comparator;
  threshold: number; minimumSamples: number; lookbackMinutes: number;
  severity: AlertSeverity; active: boolean;
}
