import { describe, expect, it } from "@jest/globals";
import { calculateReliability } from "./reliability-score";
import { compareTrend } from "./reliability-trends";
import { canTransitionMaintenanceTask, validateMaintenanceTaskTransition, validateMaintenanceWindow, windowsOverlap } from "./maintenance";

describe("Batch 129 fleet reliability", () => {
  it("returns UNKNOWN for low samples and never treats missing metrics as perfect health", () => {
    expect(calculateReliability({ sampleCount: 4, heartbeatCoverage: 1 }).riskBand).toBe("UNKNOWN");
    const result = calculateReliability({ sampleCount: 20, heartbeatCoverage: 0.99 });
    expect(result.score).toBe(99);
    expect(result.dataCoverage).toBe(0.25);
    expect(result.warnings).toContain("MISSING_OR_INVALID:commandSuccessRate");
  });
  it("rejects invalid sample counts and invalid metric ranges", () => {
    expect(() => calculateReliability({ sampleCount: -1 })).toThrow("INVALID_SAMPLE_COUNT");
    expect(calculateReliability({ sampleCount: 12, heartbeatCoverage: 1.5 }).score).toBeNull();
  });
  it("does not compare trends with low samples or divide by a zero baseline", () => {
    expect(compareTrend({ windowStart: "now", value: 1, sampleCount: 2 }, { windowStart: "then", value: 2, sampleCount: 20 }).comparable).toBe(false);
    expect(compareTrend({ windowStart: "now", value: 2, sampleCount: 20 }, { windowStart: "then", value: 0, sampleCount: 20 }).percentChange).toBeNull();
  });
});
describe("Batch 129 maintenance policy", () => {
  const window = { tenantId: "t1", deviceId: "d1", startsAt: "2026-01-02T00:00:00Z", endsAt: "2026-01-02T02:00:00Z", displayTimezone: "Asia/Kolkata" };
  it("validates explicit instants and timezone", () => {
    expect(validateMaintenanceWindow(window).start).toBe("2026-01-02T00:00:00.000Z");
    expect(() => validateMaintenanceWindow({ ...window, startsAt: "2026-01-02T00:00:00" })).toThrow("UTC_INSTANT_REQUIRED");
    expect(() => validateMaintenanceWindow({ ...window, displayTimezone: "Not/AZone" })).toThrow("INVALID_DISPLAY_TIMEZONE");
  });
  it("detects overlap but permits adjacent windows", () => {
    expect(windowsOverlap({ startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-01T02:00:00Z" }, { startsAt: "2026-01-01T01:00:00Z", endsAt: "2026-01-01T03:00:00Z" })).toBe(true);
    expect(windowsOverlap({ startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-01T02:00:00Z" }, { startsAt: "2026-01-01T02:00:00Z", endsAt: "2026-01-01T03:00:00Z" })).toBe(false);
  });
  it("requires actor and evidence for task completion, then separate verification", () => {
    expect(canTransitionMaintenanceTask("COMPLETED", "VERIFIED")).toBe(true);
    expect(() => validateMaintenanceTaskTransition({ from: "IN_PROGRESS", to: "COMPLETED", actorUserId: "ops" })).toThrow("COMPLETION_EVIDENCE_REQUIRED");
    expect(validateMaintenanceTaskTransition({ from: "IN_PROGRESS", to: "COMPLETED", actorUserId: "ops", evidence: "ticket:OPS-1" })).toMatchObject({ accepted: true, verificationRequired: true, auditRequired: true });
    expect(() => validateMaintenanceTaskTransition({ from: "VERIFIED", to: "IN_PROGRESS", actorUserId: "ops" })).toThrow("INVALID_MAINTENANCE_TASK_TRANSITION");
  });
});
