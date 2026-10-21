import { describe, expect, it } from "@jest/globals";
import { groupIncidentPatterns } from "./incident-patterns";
import { canTransitionReview, validateReviewDraft, validateReviewTransition } from "./incident-review";
import { canTransitionAction, isActionOverdue, validateActionCompletion, validateActionTransition } from "./preventive-actions";
import type { IncidentFact, ReviewDraft } from "./incident-review.types";

const fact = (overrides: Partial<IncidentFact> = {}): IncidentFact => ({
  incidentId: "i1", tenantId: "tenant-a", severity: "WARNING", status: "RESOLVED",
  createdAt: "2026-01-02T00:00:00Z", rootCauseCode: "NETWORK", affectedDeviceIds: ["d1"],
  ...overrides,
});
const completeDraft: ReviewDraft = {
  executiveSummary: "Service restored",
  impactSummary: "3 screens affected for 12 minutes; estimated from heartbeat gaps",
  rootCauseCode: "NETWORK",
  rootCauseNarrative: "Upstream connectivity interruption confirmed by provider status",
  contributingFactors: ["Network path instability"],
  lessonsLearned: "Add a second connectivity probe",
};

describe("Recovered Batch 128 incident review policies", () => {
  it("groups only same-tenant incidents inside the explicit half-open window", () => {
    const rows = [
      fact({ incidentId: "i1", affectedDeviceIds: ["d1"] }),
      fact({ incidentId: "i2", affectedDeviceIds: ["d1", "d2"] }),
      fact({ incidentId: "foreign", tenantId: "tenant-b" }),
      fact({ incidentId: "outside", createdAt: "2026-01-03T00:00:00Z" }),
    ];
    const groups = groupIncidentPatterns(rows, {
      tenantId: "tenant-a", from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-01-03T00:00:00Z"), categoryOf: () => "CONNECTIVITY",
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ incidentCount: 2, affectedDevices: 2, requiresHumanReview: true });
  });

  it("rejects missing tenant and invalid/unbounded windows", () => {
    expect(() => groupIncidentPatterns([], {
      tenantId: " ", from: new Date("2026-01-01"), to: new Date("2026-01-02"), categoryOf: () => "x",
    })).toThrow("TENANT_REQUIRED");
    expect(() => groupIncidentPatterns([], {
      tenantId: "tenant-a", from: new Date("2026-01-02"), to: new Date("2026-01-02"), categoryOf: () => "x",
    })).toThrow("INVALID_TIME_WINDOW");
  });

  it("requires complete review sections and bounds contributing factors", () => {
    expect(validateReviewDraft({}).valid).toBe(false);
    expect(validateReviewDraft({ ...completeDraft, contributingFactors: Array.from({ length: 21 }, () => "factor") }).errors)
      .toContain("TOO_MANY_CONTRIBUTING_FACTORS");
    expect(validateReviewDraft(completeDraft).valid).toBe(true);
  });

  it("requires actor, valid transition, complete submission and matching version", () => {
    expect(canTransitionReview("DRAFT", "IN_REVIEW")).toBe(true);
    expect(canTransitionReview("APPROVED", "DRAFT")).toBe(false);
    expect(() => validateReviewTransition({ from: "DRAFT", to: "IN_REVIEW" })).toThrow("ACTOR_REQUIRED");
    expect(() => validateReviewTransition({ from: "DRAFT", to: "IN_REVIEW", actorUserId: "ops-1", draft: {} }))
      .toThrow("REVIEW_DRAFT_INCOMPLETE");
    expect(() => validateReviewTransition({
      from: "DRAFT", to: "IN_REVIEW", actorUserId: "ops-1", draft: completeDraft,
      expectedVersion: 2, currentVersion: 1,
    })).toThrow("REVIEW_VERSION_CONFLICT");
    expect(validateReviewTransition({
      from: "DRAFT", to: "IN_REVIEW", actorUserId: "ops-1", draft: completeDraft,
      expectedVersion: 1, currentVersion: 1,
    })).toEqual({ accepted: true, auditRequired: true, nextVersion: 2 });
  });

  it("requires evidence to complete actions and keeps verification separate", () => {
    expect(canTransitionAction("COMPLETED", "VERIFIED")).toBe(true);
    expect(canTransitionAction("VERIFIED", "IN_PROGRESS")).toBe(false);
    expect(() => validateActionCompletion({ status: "COMPLETED", actorUserId: "ops-1" }))
      .toThrow("COMPLETION_EVIDENCE_REQUIRED");
    expect(() => validateActionTransition({ from: "OPEN", to: "COMPLETED", actorUserId: "ops-1" }))
      .toThrow("INVALID_ACTION_TRANSITION");
    expect(validateActionTransition({
      from: "IN_PROGRESS", to: "COMPLETED", actorUserId: "ops-1", completionEvidence: "ticket:OPS-44",
    })).toEqual({ accepted: true, verificationRequired: true });
  });

  it("marks only non-terminal actions overdue", () => {
    const now = new Date("2026-01-03T00:00:00Z");
    const base = { id: "a1", title: "Patch player", dueAt: "2026-01-02T00:00:00Z" };
    expect(isActionOverdue({ ...base, status: "OPEN" }, now)).toBe(true);
    expect(isActionOverdue({ ...base, status: "VERIFIED" }, now)).toBe(false);
    expect(isActionOverdue({ ...base, status: "CANCELLED" }, now)).toBe(false);
  });
});
