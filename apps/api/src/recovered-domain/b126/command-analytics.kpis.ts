import type { CommandKpis, CommandObservation, LatencySummary } from "./command-analytics.types";

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[index];
}

function elapsed(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return undefined;
  return endMs - startMs;
}

function latencySummary(values: number[], invalidSampleSize: number): LatencySummary {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  return {
    sampleSize: valid.length,
    invalidSampleSize,
    p50Ms: percentile(valid, 0.5),
    p95Ms: percentile(valid, 0.95),
    maxMs: valid.length ? Math.max(...valid) : null,
  };
}

function collectIntervals(
  rows: CommandObservation[],
  startKey: "dispatchedAt",
  endKey: "acknowledgedAt" | "completedAt",
): { values: number[]; invalidSampleSize: number } {
  const values: number[] = [];
  let invalidSampleSize = 0;
  for (const row of rows) {
    const start = row[startKey];
    const end = row[endKey];
    const interval = elapsed(start, end);
    if (interval !== undefined) {
      values.push(interval);
    } else if (start !== undefined || end !== undefined) {
      // Count partial, malformed, or negative intervals; rows with neither timestamp
      // are not counted because the lifecycle may not have reached this measurement.
      invalidSampleSize += 1;
    }
  }
  return { values, invalidSampleSize };
}

export function calculateCommandKpis(rows: CommandObservation[]): CommandKpis {
  const completed = rows.filter((row) => row.status === "COMPLETED").length;
  const failed = rows.filter((row) => row.status === "FAILED").length;
  const deliveryUnknown = rows.filter((row) => row.status === "DELIVERY_UNKNOWN").length;
  const expired = rows.filter((row) => row.status === "EXPIRED").length;
  const pending = rows.filter((row) =>
    ["QUEUED", "DISPATCHED", "ACKNOWLEDGED", "EXECUTING"].includes(row.status)
  ).length;
  const terminalDenominator = completed + failed;
  const acknowledgement = collectIntervals(rows, "dispatchedAt", "acknowledgedAt");
  const completion = collectIntervals(rows, "dispatchedAt", "completedAt");

  return {
    total: rows.length,
    completed,
    failed,
    deliveryUnknown,
    expired,
    pending,
    completionRate: terminalDenominator ? completed / terminalDenominator : null,
    failureRate: terminalDenominator ? failed / terminalDenominator : null,
    acknowledgementLatency: latencySummary(acknowledgement.values, acknowledgement.invalidSampleSize),
    completionLatency: latencySummary(completion.values, completion.invalidSampleSize),
  };
}
