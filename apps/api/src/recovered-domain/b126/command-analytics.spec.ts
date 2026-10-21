import { describe, expect, it } from "@jest/globals";
import { calculateCommandKpis } from "./command-analytics.kpis";
import { evaluateSla } from "./command-analytics.sla";
import type { CommandObservation, SlaPolicy } from "./command-analytics.types";

const policy = (overrides: Partial<SlaPolicy> = {}): SlaPolicy => ({
  id: "policy-1",
  enabled: true,
  acknowledgementMs: 1000,
  minimumSampleSize: 1,
  breachPercent: 0,
  severity: "WARNING",
  suppressionMinutes: 30,
  ...overrides,
});

const observation = (overrides: Partial<CommandObservation> = {}): CommandObservation => ({
  tenantId: "tenant-a",
  commandType: "refresh",
  status: "COMPLETED",
  ...overrides,
});

describe("Recovered Batch 126 command analytics policies", () => {
  it("excludes DELIVERY_UNKNOWN and pending commands from the terminal denominator", () => {
    const kpis = calculateCommandKpis([
      observation({ status: "COMPLETED" }),
      observation({ status: "FAILED" }),
      observation({ status: "DELIVERY_UNKNOWN" }),
      observation({ status: "QUEUED" }),
    ]);
    expect(kpis.completionRate).toBe(0.5);
    expect(kpis.failureRate).toBe(0.5);
    expect(kpis.deliveryUnknown).toBe(1);
    expect(kpis.pending).toBe(1);
  });

  it("returns null rates and latency percentiles when there is no valid sample", () => {
    const kpis = calculateCommandKpis([observation({ status: "QUEUED" })]);
    expect(kpis.completionRate).toBeNull();
    expect(kpis.acknowledgementLatency.p95Ms).toBeNull();
    expect(kpis.completionLatency.p95Ms).toBeNull();
  });

  it("counts partial, malformed and negative intervals as data-quality samples", () => {
    const kpis = calculateCommandKpis([
      observation({ dispatchedAt: "2026-10-15T00:00:00Z" }),
      observation({ dispatchedAt: "bad", acknowledgedAt: "2026-10-15T00:00:05Z" }),
      observation({ dispatchedAt: "2026-10-15T00:00:05Z", acknowledgedAt: "2026-10-15T00:00:01Z" }),
    ]);
    expect(kpis.acknowledgementLatency.sampleSize).toBe(0);
    expect(kpis.acknowledgementLatency.invalidSampleSize).toBe(3);
  });

  it("enforces minimum sample size and leaves disabled policies inactive", () => {
    const rows = [observation({
      dispatchedAt: "2026-10-15T00:00:00Z",
      acknowledgedAt: "2026-10-15T00:00:05Z",
    })];
    expect(evaluateSla("tenant-a", "2026-10-15T00", rows, policy({ minimumSampleSize: 2 }))).toEqual([]);
    expect(evaluateSla("tenant-a", "2026-10-15T00", rows, policy({ enabled: false }))).toEqual([]);
  });

  it("enforces tenant scope and includes explicit latency threshold in the breach", () => {
    const rows = [
      observation({
        dispatchedAt: "2026-10-15T00:00:00Z",
        acknowledgedAt: "2026-10-15T00:00:05Z",
      }),
      observation({
        tenantId: "tenant-b",
        dispatchedAt: "2026-10-15T00:00:00Z",
        acknowledgedAt: "2026-10-15T00:00:20Z",
      }),
    ];
    expect(evaluateSla("tenant-a", "window-1", rows, policy())).toEqual([{
      metricName: "acknowledgement_latency",
      observedValue: 100,
      thresholdValue: 0,
      latencyThresholdMs: 1000,
      sampleSize: 1,
      severity: "WARNING",
      dedupeKey: "policy-1:acknowledgement_latency:window-1:tenant-a",
    }]);
  });

  it("rejects invalid policy configuration", () => {
    expect(() => evaluateSla("tenant-a", "window-1", [], policy({ minimumSampleSize: 0 })))
      .toThrow("INVALID_SLA_POLICY");
  });
});
