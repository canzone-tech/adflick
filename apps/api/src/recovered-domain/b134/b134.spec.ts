import { describe, expect, it } from "@jest/globals";
import { buildScheduleProposal, detectScheduleConflicts } from "./conflicts";
import { durationMinutes, isValidIanaTimezone, selectCalendarOrders } from "./calendar-model";
import type { CalendarWorkOrder, Technician } from "./types";

const technician: Technician = {
  id: "t1", displayName: "Tech One", timezone: "Asia/Kolkata", active: true,
  skills: ["display"], capacityPerDay: 4,
};
const order: CalendarWorkOrder = {
  id: "w1", tenantId: "tenant1", title: "Panel check", deviceId: "tv1", technicianId: "t1",
  startsAt: "2026-10-15T09:00:00Z", endsAt: "2026-10-15T10:00:00Z",
  status: "SCHEDULED", requiredSkills: ["display"], plannedDowntime: true,
};
const availability = [{ technicianId: "t1", startsAt: "2026-10-15T08:00:00Z", endsAt: "2026-10-15T12:00:00Z", available: true }];

describe("Batch 134 maintenance calendar helpers", () => {
  it("filters intersecting orders and sorts by start", () => {
    const later = { ...order, id: "w2", startsAt: "2026-10-15T11:00:00Z", endsAt: "2026-10-15T12:00:00Z" };
    expect(selectCalendarOrders([later, order], "2026-10-15T09:30:00Z", "2026-10-15T11:30:00Z").map((item) => item.id)).toEqual(["w1", "w2"]);
  });

  it("returns zero duration for malformed intervals", () => {
    expect(durationMinutes({ ...order, endsAt: "not-a-date" })).toBe(0);
    expect(durationMinutes({ ...order, endsAt: "2026-10-15T08:00:00Z" })).toBe(0);
  });

  it("validates IANA timezone identifiers", () => {
    expect(isValidIanaTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidIanaTimezone("Not/AZone")).toBe(false);
  });

  it("detects technician and device overlap while respecting tenant scope", () => {
    const candidate = { ...order, id: "w2", startsAt: "2026-10-15T09:30:00Z", endsAt: "2026-10-15T10:30:00Z" };
    const conflicts = detectScheduleConflicts(candidate, [order], technician, availability);
    expect(conflicts.some((conflict) => conflict.type === "TECHNICIAN_OVERLAP" && conflict.blocking)).toBe(true);
    expect(conflicts.some((conflict) => conflict.type === "DEVICE_OVERLAP" && conflict.blocking)).toBe(true);

    const otherTenant = { ...order, tenantId: "tenant2", id: "w3" };
    expect(detectScheduleConflicts(candidate, [otherTenant], technician, availability)).toHaveLength(0);
  });

  it("blocks inactive technicians, missing skills and uncovered availability", () => {
    const candidate = { ...order, id: "w2", requiredSkills: ["display", "network"], startsAt: "2026-10-15T13:00:00Z", endsAt: "2026-10-15T14:00:00Z" };
    const conflicts = detectScheduleConflicts(candidate, [], { ...technician, active: false }, availability);
    expect(conflicts.map((conflict) => conflict.type)).toEqual(expect.arrayContaining(["OUTSIDE_AVAILABILITY", "SKILL_MISMATCH"]));
  });

  it("produces a non-confirmable proposal when blocking conflicts exist", () => {
    const candidate = { ...order, id: "w2", startsAt: "2026-10-15T09:30:00Z", endsAt: "2026-10-15T10:30:00Z" };
    const proposal = buildScheduleProposal(candidate, [order], technician, availability);
    expect(proposal.canConfirm).toBe(false);
    expect(proposal.conflicts.some((conflict) => conflict.blocking)).toBe(true);
  });
});
