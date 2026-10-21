import type { CommandObservation, SlaPolicy } from "./command-analytics.types";

export interface SlaBreach {
  metricName: "acknowledgement_latency" | "completion_latency" | "failure_rate";
  observedValue: number;
  thresholdValue: number;
  latencyThresholdMs?: number;
  sampleSize: number;
  severity: SlaPolicy["severity"];
  dedupeKey: string;
}

function elapsed(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return undefined;
  return endMs - startMs;
}

function assertValidPolicy(policy: SlaPolicy): void {
  if (!policy.id.trim() ||
      !Number.isSafeInteger(policy.minimumSampleSize) || policy.minimumSampleSize < 1 ||
      !Number.isSafeInteger(policy.suppressionMinutes) || policy.suppressionMinutes < 0) {
    throw new Error("INVALID_SLA_POLICY");
  }
  for (const threshold of [policy.acknowledgementMs, policy.completionMs, policy.breachPercent]) {
    if (threshold !== undefined && (!Number.isFinite(threshold) || threshold < 0)) {
      throw new Error("INVALID_SLA_POLICY");
    }
  }
}

export function evaluateSla(
  tenantId: string,
  windowKey: string,
  rows: CommandObservation[],
  policy: SlaPolicy,
): SlaBreach[] {
  assertValidPolicy(policy);
  if (!policy.enabled) return [];

  // Defense in depth: never mix rows from another tenant in an evaluation.
  const scopedRows = rows.filter((row) => row.tenantId === tenantId);
  const breaches: SlaBreach[] = [];
  const addLatencyBreach = (
    metricName: "acknowledgement_latency" | "completion_latency",
    intervals: Array<number | undefined>,
    thresholdMs: number,
  ) => {
    const valid = intervals.filter((value): value is number => value !== undefined);
    if (valid.length < policy.minimumSampleSize) return;
    const breached = valid.filter((value) => value > thresholdMs).length;
    const observedPercent = (breached / valid.length) * 100;
    const allowedPercent = policy.breachPercent ?? 0;
    if (observedPercent > allowedPercent) {
      breaches.push({
        metricName,
        observedValue: observedPercent,
        thresholdValue: allowedPercent,
        latencyThresholdMs: thresholdMs,
        sampleSize: valid.length,
        severity: policy.severity,
        dedupeKey: `${policy.id}:${metricName}:${windowKey}:${tenantId}`,
      });
    }
  };

  if (policy.acknowledgementMs !== undefined) {
    addLatencyBreach(
      "acknowledgement_latency",
      scopedRows.map((row) => elapsed(row.dispatchedAt, row.acknowledgedAt)),
      policy.acknowledgementMs,
    );
  }
  if (policy.completionMs !== undefined) {
    addLatencyBreach(
      "completion_latency",
      scopedRows.map((row) => elapsed(row.dispatchedAt, row.completedAt)),
      policy.completionMs,
    );
  }

  const terminal = scopedRows.filter((row) => row.status === "COMPLETED" || row.status === "FAILED");
  if (terminal.length >= policy.minimumSampleSize && policy.breachPercent !== undefined) {
    const failurePercent = (terminal.filter((row) => row.status === "FAILED").length / terminal.length) * 100;
    if (failurePercent > policy.breachPercent) {
      breaches.push({
        metricName: "failure_rate",
        observedValue: failurePercent,
        thresholdValue: policy.breachPercent,
        sampleSize: terminal.length,
        severity: policy.severity,
        dedupeKey: `${policy.id}:failure_rate:${windowKey}:${tenantId}`,
      });
    }
  }
  return breaches;
}
