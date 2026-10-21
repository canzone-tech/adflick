import { describe, expect, it } from "@jest/globals";
import { evaluateSla } from "./sla";
import { calculateInventory, validateReservation } from "./inventory";
import { validateCostEntry, sumApprovedCosts } from "./costs";
import { buildMaintenanceReport } from "./reports";
import type { SlaClock, StockMovement, CostEntry } from "./types";

describe("Batch 131 maintenance analytics", () => {
  it("detects a response SLA breach", () => {
    const clock: SlaClock = { tenantId: "t1", workOrderId: "wo1", openedAt: "2026-10-15T08:00:00Z",
      responseDueAt: "2026-10-15T09:00:00Z", resolutionDueAt: "2026-10-15T12:00:00Z",
      state: "RUNNING", accumulatedPauseSecs: 0 };
    expect(evaluateSla(clock, "2026-10-15T09:30:00Z").response).toBe("BREACHED");
  });
  it("preserves paused SLA state", () => {
    const clock: SlaClock = { tenantId: "t1", workOrderId: "wo1", openedAt: "2026-10-15T08:00:00Z",
      responseDueAt: "2026-10-15T09:00:00Z", resolutionDueAt: "2026-10-15T12:00:00Z",
      state: "PAUSED", accumulatedPauseSecs: 120 };
    expect(evaluateSla(clock, "2026-10-15T09:30:00Z")).toMatchObject({ response: "PAUSED", resolution: "PAUSED" });
  });
  it("derives stock position from ledger and blocks over-reservation", () => {
    const rows: StockMovement[] = [
      { tenantId: "t1", partId: "p1", movementType: "RECEIPT", quantity: 10, idempotencyKey: "r1" },
      { tenantId: "t1", partId: "p1", movementType: "CONSUMPTION", quantity: 2, idempotencyKey: "c1" },
    ];
    const position = calculateInventory("p1", rows, 3);
    expect(position.available).toBe(5);
    expect(validateReservation(position, 6)).toContain("Insufficient available stock.");
  });
  it("rejects negative inventory and duplicate movement keys", () => {
    const rows: StockMovement[] = [{ tenantId: "t1", partId: "p1", movementType: "CONSUMPTION", quantity: 1, idempotencyKey: "c1" }];
    expect(() => calculateInventory("p1", rows, 0)).toThrow();
    expect(() => calculateInventory("p1", [...rows, rows[0]], 0)).toThrow("Duplicate idempotency key.");
  });
  it("validates cost arithmetic and explicit currency", () => {
    const cost: CostEntry = { tenantId: "t1", workOrderId: "wo1", category: "PART", quantity: 2,
      unitCostMinor: 500n, totalCostMinor: 1000n, currency: "INR", approved: true };
    expect(validateCostEntry(cost)).toHaveLength(0);
    expect(sumApprovedCosts([cost], "INR")).toBe(1000n);
    expect(sumApprovedCosts([{ ...cost, approved: false, totalCostMinor: 999n }], "INR")).toBe(0n);
  });
  it("reports SLA counts, approved costs and bounded data coverage", () => {
    const clock: SlaClock = { tenantId: "t1", workOrderId: "wo1", openedAt: "2026-10-15T08:00:00Z",
      responseDueAt: "2026-10-15T09:00:00Z", resolutionDueAt: "2026-10-15T12:00:00Z",
      firstResponseAt: "2026-10-15T08:30:00Z", resolvedAt: "2026-10-15T11:30:00Z", state: "STOPPED", accumulatedPauseSecs: 0 };
    const cost: CostEntry = { tenantId: "t1", workOrderId: "wo1", category: "PART", quantity: 1,
      unitCostMinor: 1250n, totalCostMinor: 1250n, currency: "INR", approved: true };
    expect(buildMaintenanceReport([clock], [cost], "2026-10-15T13:00:00Z", "INR", 2)).toMatchObject({
      workOrderCount: 1, responseSlaMet: 1, resolutionSlaMet: 1, approvedCostMinor: "1250", dataCoverage: 0.5,
    });
  });
});
