import { describe, expect, it } from "@jest/globals";
import { evaluateDue, isValidIanaTimezone } from "./due";
import { evaluateRule } from "./alerts";
import { generationIdempotencyKey, proposeWorkOrder } from "./generation";
import type { PreventivePlan, PlanAssignment, AlertRule, MetricObservation } from "./types";

const plan: PreventivePlan = { id: "plan1", tenantId: "t1", status: "ACTIVE", cadenceUnit: "MONTH", cadenceValue: 1, timezone: "Asia/Kolkata", leadTimeMinutes: 60, version: 2 };
const assignment: PlanAssignment = { id: "a1", tenantId: "t1", planId: "plan1", deviceId: "d1", active: true, nextDueAt: "2026-10-15T10:00:00Z" };

describe("Batch 132 preventive maintenance", () => {
  it("returns not due before lead window", () => expect(evaluateDue(plan, assignment, "2026-10-15T08:00:00Z").due).toBe(false));
  it("validates IANA timezone and rejects invalid timezone", () => {
    expect(isValidIanaTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidIanaTimezone("Not/A-Timezone")).toBe(false);
  });
  it("creates stable proposal inside lead window", () => {
    const proposal = proposeWorkOrder(plan, assignment, "2026-10-15T09:30:00Z", "NORMAL");
    expect(proposal?.occurrenceKey).toContain("a1:");
    expect(generationIdempotencyKey("t1", "a1", proposal!.occurrenceKey)).toBe(`t1:a1:${proposal!.occurrenceKey}`);
  });
  it("does not alert with insufficient telemetry coverage", () => {
    const rule: AlertRule = { id: "r1", tenantId: "t1", metric: "errorRate", comparator: "GT", threshold: 0.2, minimumSamples: 10, lookbackMinutes: 60, severity: "HIGH", active: true };
    const obs: MetricObservation = { tenantId: "t1", deviceId: "d1", metric: "errorRate", value: 0.5, sampleCount: 20, coverage: 0.4, observedAt: "2026-10-15T09:00:00Z" };
    expect(evaluateRule(rule, obs).reason).toBe("INSUFFICIENT_COVERAGE");
  });
  it("alerts when threshold and sample gates pass", () => {
    const rule: AlertRule = { id: "r1", tenantId: "t1", metric: "errorRate", comparator: "GT", threshold: 0.2, minimumSamples: 10, lookbackMinutes: 60, severity: "HIGH", active: true };
    const obs: MetricObservation = { tenantId: "t1", deviceId: "d1", metric: "errorRate", value: 0.5, sampleCount: 20, coverage: 0.95, observedAt: "2026-10-15T09:00:00Z" };
    expect(evaluateRule(rule, obs).shouldAlert).toBe(true);
  });
  it("keeps tenant mismatch and inactive plans fail-closed", () => {
    expect(evaluateDue({ ...plan, status: "PAUSED" }, assignment, "2026-10-15T10:00:00Z").reason).toBe("INACTIVE");
    expect(evaluateDue(plan, { ...assignment, tenantId: "t2" }, "2026-10-15T10:00:00Z").reason).toBe("TENANT_OR_PLAN_MISMATCH");
  });
});
