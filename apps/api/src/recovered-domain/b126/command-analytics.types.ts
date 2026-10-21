import type { CommandStatus } from "../b125/command-center-policy";

export interface CommandObservation {
  tenantId: string;
  commandType: string;
  status: CommandStatus;
  dispatchedAt?: string;
  acknowledgedAt?: string;
  completedAt?: string;
  failedAt?: string;
  platform?: string;
}

export interface LatencySummary {
  sampleSize: number;
  invalidSampleSize: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
}

export interface CommandKpis {
  total: number;
  completed: number;
  failed: number;
  deliveryUnknown: number;
  expired: number;
  pending: number;
  completionRate: number | null;
  failureRate: number | null;
  acknowledgementLatency: LatencySummary;
  completionLatency: LatencySummary;
}

export interface SlaPolicy {
  id: string;
  enabled: boolean;
  acknowledgementMs?: number;
  completionMs?: number;
  minimumSampleSize: number;
  breachPercent?: number;
  severity: "INFO" | "WARNING" | "CRITICAL";
  suppressionMinutes: number;
}
