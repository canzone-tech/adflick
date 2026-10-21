import { describe, expect, it } from "@jest/globals";
import { filterAlertInbox } from "./alert-inbox";
import { proposeEscalation } from "./escalation";
import { canMoveIncident, validateIncidentAction } from "./incident-workflow";
import type { Incident, SlaAlert } from "./fleet-ops.types";

const alert = (overrides: Partial<SlaAlert> = {}): SlaAlert => ({
  id: "a1", tenantId: "tenant-a", metricName: "latency", severity: "WARNING",
  status: "OPEN", observedValue: 10, thresholdValue: 5, sampleSize: 10,
  firstSeenAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-01-01T00:00:00Z",
  ...overrides,
});
const incident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "i1", tenantId: "tenant-a", title: "Service issue", severity: "CRITICAL",
  status: "OPEN", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});
const rule = { id: "r1", enabled: true, afterMinutes: 5, targetRole: "ADMIN", channel: "IN_APP" as const, maxAttempts: 3 };

describe("Recovered Batch 127 fleet operations policies", () => {
  it("requires an actor and a reason for resolve/close transitions", () => {
    expect(() => validateIncidentAction({ from: "OPEN", to: "ACKNOWLEDGED" })).toThrow("ACTOR_REQUIRED");
    expect(() => validateIncidentAction({ from: "INVESTIGATING", to: "RESOLVED", actorUserId: "ops-1" }))
      .toThrow("RESOLUTION_REASON_REQUIRED");
    expect(validateIncidentAction({ from: "INVESTIGATING", to: "RESOLVED", actorUserId: "ops-1", reasonCode: "RECOVERED" }))
      .toEqual({ accepted: true, auditRequired: true });
  });

  it("validates lifecycle transitions", () => {
    expect(canMoveIncident("OPEN", "ACKNOWLEDGED")).toBe(true);
    expect(canMoveIncident("CLOSED", "OPEN")).toBe(false);
  });

  it("tenant-scopes alerts and sorts critical alerts first", () => {
    const rows = [
      alert({ id: "warn" }),
      alert({ id: "critical", severity: "CRITICAL" }),
      alert({ id: "foreign", tenantId: "tenant-b", severity: "CRITICAL" }),
    ];
    expect(filterAlertInbox(rows, { tenantId: "tenant-a" }).map((item) => item.id))
      .toEqual(["critical", "warn"]);
  });

  it("filters inbox by status, severity and search", () => {
    const rows = [alert({ id: "latency-alert", severity: "CRITICAL" }), alert({ id: "other", metricName: "failure_rate" })];
    expect(filterAlertInbox(rows, { tenantId: "tenant-a", severity: "CRITICAL", search: "latency" }).map((item) => item.id))
      .toEqual(["latency-alert"]);
  });

  it("does not escalate closed/resolved, early, duplicate, or invalid-rule incidents", () => {
    const now = new Date("2026-01-01T00:10:00Z");
    expect(proposeEscalation(incident({ status: "RESOLVED" }), rule, now, false).shouldEscalate).toBe(false);
    expect(proposeEscalation(incident(), { ...rule, afterMinutes: 20 }, now, false).shouldEscalate).toBe(false);
    expect(proposeEscalation(incident(), rule, now, true).shouldEscalate).toBe(false);
    expect(proposeEscalation(incident(), { ...rule, maxAttempts: 0 }, now, false).shouldEscalate).toBe(false);
  });

  it("proposes deterministic tenant-scoped escalation keys without claiming delivery", () => {
    expect(proposeEscalation(incident(), rule, new Date("2026-01-01T00:10:00Z"), false)).toEqual({
      shouldEscalate: true, ruleId: "r1", idempotencyKey: "tenant-a:i1:r1", reasonCode: "AGE_THRESHOLD_REACHED",
    });
  });
});
