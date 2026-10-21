import { describe, expect, it } from "@jest/globals";
import { assertWindowSchedulable, validateWindow, windowsOverlap } from "./scheduling";
import { proposeMaintenanceReminders } from "./reminders";
import { summarizeMaintenanceWorkOrders } from "./operations-summary";
import { validateWorkOrderTransition } from "./work-order-state";
import type { MaintenanceWindow, MaintenanceWorkOrder } from "./types";

const window = (id: string, startsAt: string, endsAt: string, overrides: Partial<MaintenanceWindow> = {}): MaintenanceWindow => ({
  id, tenantId: "tenant-a", deviceId: "device-a", title: "Service", timezone: "Asia/Kolkata",
  startsAt, endsAt, status: "SCHEDULED", approvalRequired: false, approvalStatus: "NOT_REQUIRED", ...overrides,
});
const order = (overrides: Partial<MaintenanceWorkOrder> = {}): MaintenanceWorkOrder => ({
  id: "wo-1", tenantId: "tenant-a", deviceId: "device-a", title: "Repair",
  status: "IN_PROGRESS", priority: "HIGH", evidenceRefs: [], ...overrides,
});

describe("Batch 130 maintenance scheduling", () => {
  it("requires explicit instants, valid range and IANA timezone", () => {
    expect(validateWindow(window("new", "2026-10-15T10:00:00", "2026-10-15T11:00:00Z"), [])
      .some(issue => issue.code === "INVALID_RANGE")).toBe(true);
    expect(validateWindow(window("new", "2026-10-15T10:00:00Z", "2026-10-15T09:00:00Z"), [])
      .some(issue => issue.code === "INVALID_RANGE")).toBe(true);
    expect(validateWindow(window("new", "2026-10-15T10:00:00Z", "2026-10-15T11:00:00Z", { timezone: "Mars/Olympus" }), [])
      .some(issue => issue.code === "INVALID_TIMEZONE")).toBe(true);
  });
  it("requires approved maker-checker status and detects same-tenant/device overlaps", () => {
    const candidate = window("new", "2026-10-15T10:30:00Z", "2026-10-15T11:30:00Z", {
      approvalRequired: true, approvalStatus: "PENDING",
    });
    const existing = window("old", "2026-10-15T10:00:00Z", "2026-10-15T11:00:00Z");
    expect(validateWindow(candidate, [existing]).map(issue => issue.code)).toEqual(["APPROVAL_REQUIRED", "OVERLAP"]);
    expect(validateWindow(candidate, [{ ...existing, tenantId: "tenant-b" }]).map(issue => issue.code)).toEqual(["APPROVAL_REQUIRED"]);
    expect(() => assertWindowSchedulable(candidate, [existing])).toThrow("APPROVAL_REQUIRED,OVERLAP");
  });
  it("uses half-open ranges so adjacent windows are allowed", () => {
    expect(windowsOverlap(
      { startsAt: "2026-10-15T10:00:00Z", endsAt: "2026-10-15T11:00:00Z" },
      { startsAt: "2026-10-15T11:00:00Z", endsAt: "2026-10-15T12:00:00Z" },
    )).toBe(false);
  });
});

describe("Batch 130 work orders and operations", () => {
  it("requires actor, blocked/cancel reasons, completion summary and evidence", () => {
    expect(validateWorkOrderTransition(order(), { to: "WORK_COMPLETED" }))
      .toEqual(expect.arrayContaining(["ACTOR_REQUIRED", "COMPLETION_SUMMARY_REQUIRED", "COMPLETION_EVIDENCE_REQUIRED"]));
    expect(validateWorkOrderTransition(order(), { to: "BLOCKED", actorUserId: "ops" })).toContain("BLOCKED_REASON_REQUIRED");
    expect(validateWorkOrderTransition(order(), { to: "CANCELLED", actorUserId: "ops" })).toContain("CANCELLATION_REASON_REQUIRED");
  });
  it("requires independent verifier and retained evidence for high-impact work", () => {
    const completed = order({ status: "WORK_COMPLETED", technicianId: "tech-1", evidenceRefs: ["private://tenant-a/evidence-1"] });
    expect(validateWorkOrderTransition(completed, {
      to: "VERIFIED", actorUserId: "tech-1", verifierUserId: "tech-1", highImpact: true,
    })).toContain("INDEPENDENT_VERIFIER_REQUIRED");
    expect(validateWorkOrderTransition(completed, {
      to: "VERIFIED", actorUserId: "reviewer", verifierUserId: "reviewer", highImpact: true,
    })).toEqual([]);
  });
  it("creates deterministic reminder proposals and excludes terminal work", () => {
    const proposals = proposeMaintenanceReminders([
      { id: "a", tenantId: "tenant-a", dueAt: "2026-10-21T12:00:00Z", status: "ASSIGNED", technicianId: "tech" },
      { id: "b", tenantId: "tenant-a", status: "OPEN" },
      { id: "c", tenantId: "tenant-a", dueAt: "2026-10-20T12:00:00Z", status: "VERIFIED" },
    ], "2026-10-21T11:00:00Z");
    expect(proposals.map(p => p.kind)).toEqual(["UPCOMING", "UNASSIGNED"]);
    expect(proposals[0].idempotencyKey).toBe("maintenance-reminder:tenant-a:a:UPCOMING:2026-10-21T12:00:00Z");
  });
  it("summarizes planned work-order status and overdue state without claiming observed downtime", () => {
    const summary = summarizeMaintenanceWorkOrders([
      order({ status: "OPEN", dueAt: "2026-10-20T00:00:00Z" }),
      order({ id: "wo-2", status: "WORK_COMPLETED" }),
    ], "2026-10-21T00:00:00Z");
    expect(summary).toMatchObject({ total: 2, open: 1, overdue: 1, completedAwaitingVerification: 1, unassigned: 2 });
  });
});
