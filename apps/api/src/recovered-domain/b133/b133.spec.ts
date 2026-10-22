import { describe, expect, it } from "@jest/globals";
import { filterAlerts, filterPlans, summarizeDashboard } from "./dashboard-model";
import type { DashboardSnapshot } from "./types";

const data: DashboardSnapshot = {
  plans: [
    { id: "p1", name: "Monthly TV check", status: "ACTIVE", assignedDevices: 4, nextDueAt: "2026-10-16T00:00:00Z", timezone: "Asia/Kolkata", version: 1 },
    { id: "p2", name: "Draft test", status: "DRAFT", assignedDevices: 0, timezone: "Asia/Kolkata", version: 1 },
  ],
  alerts: [
    { id: "a1", deviceLabel: "Lobby TV", title: "Playback errors elevated", severity: "HIGH", status: "OPEN", lastSeenAt: "2026-10-15T09:00:00Z", sampleCount: 30, coverage: 0.95 },
  ],
  runs: [
    { id: "r1", status: "PARTIAL", proposedCount: 4, createdCount: 3, skippedCount: 1, errorCount: 1 },
  ],
  generatedAt: "2026-10-15T10:00:00Z",
  coverage: 0.95,
};

const filters = { search: "", planStatus: "", alertSeverity: "", alertStatus: "" };

describe("Batch 133 maintenance dashboard model", () => {
  it("filters plans by status and case-insensitive search", () => {
    expect(filterPlans(data.plans, { ...filters, search: "monthly", planStatus: "ACTIVE" })).toHaveLength(1);
    expect(filterPlans(data.plans, { ...filters, planStatus: "DRAFT" })[0]?.id).toBe("p2");
  });
  it("composes alert search, severity and status filters", () => {
    expect(filterAlerts(data.alerts, { ...filters, search: "lobby", alertSeverity: "HIGH", alertStatus: "OPEN" })).toHaveLength(1);
    expect(filterAlerts(data.alerts, { ...filters, alertSeverity: "CRITICAL" })).toHaveLength(0);
  });
  it("summarizes dashboard KPIs and bounds telemetry coverage", () => {
    expect(summarizeDashboard(data)).toEqual({ activePlans: 1, dueSoon: 1, openAlerts: 1, failedRuns: 1, telemetryCoveragePercent: 95 });
    expect(summarizeDashboard({ ...data, coverage: 4 }).telemetryCoveragePercent).toBe(100);
    expect(summarizeDashboard({ ...data, coverage: -1 }).telemetryCoveragePercent).toBe(0);
  });
});
