import { describe, expect, it } from "@jest/globals";
import {
  reviewWorkOrder, classifySla, validateGovernanceWindow, exportTransition,
  authorizeReport, authorizeApiKey, transitionAlert, permitContainment,
  validateSecurityEvidenceExport, evidenceFreshness, validatePromotion,
  deploymentTransition, sloHealth, auditRelease, assessGoLive,
} from "./governance-policies";

const NOW = "2026-10-27T12:00:00.000Z";
const DIGEST = "a".repeat(64);
describe("Batches 136-150 recovered governance policy safeguards", () => {
  it("136: blocks independent technician self-approval and unreviewed evidence", () => {
    const input = { status: "PENDING" as const, technicianId: "t", reviewerId: "t",
      independent: true, decision: "APPROVE" as const, requiredChecksPassed: true,
      evidence: ["UPLOADED" as const] };
    expect(reviewWorkOrder(input).allowed).toBe(false);
    expect(reviewWorkOrder({ ...input, reviewerId: "r", evidence: ["PENDING"] }).allowed).toBe(false);
    expect(reviewWorkOrder({ ...input, reviewerId: "r" }).allowed).toBe(true);
  });
  it("137: does not silently classify missing/invalid SLA time as met", () => {
    expect(classifySla("2026-10-27T11:00:00Z", NOW, 10, false)).toBe("OVERDUE");
    expect(() => classifySla("invalid", NOW, 10, false)).toThrow();
  });
  it("138: validates tenant/window/timezone", () => {
    expect(validateGovernanceWindow("t", "2026-10-26T00:00:00Z", NOW, "Asia/Kolkata").allowed).toBe(true);
    expect(validateGovernanceWindow("", NOW, NOW, "Not/AZone").allowed).toBe(false);
  });
  it("139: fails closed on unapproved export retry/transition", () => {
    expect(exportTransition("QUEUED", "RUNNING", 0, 2)).toBe(1);
    expect(() => exportTransition("FAILED", "QUEUED", 2, 2)).toThrow();
    expect(() => exportTransition("SUCCEEDED", "RUNNING", 0, 2)).toThrow();
  });
  it("140: denies ambiguous policies and field-level exports", () => {
    const p = { tenantId: "t", role: "ANALYST", reportType: "SLA", enabled: true,
      actions: ["EXPORT"], allowedFields: ["count"], deniedFields: ["secret"] };
    expect(authorizeReport("t", "ANALYST", "SLA", "EXPORT", ["count"], [p]).allowed).toBe(true);
    expect(authorizeReport("t", "ANALYST", "SLA", "EXPORT", ["secret"], [p]).allowed).toBe(false);
    expect(authorizeReport("t", "ANALYST", "SLA", "EXPORT", ["count"], [p, p]).allowed).toBe(false);
  });
  it("141: tenant/key expiry/scope enforce server-side metadata guards", () => {
    const input = { tenantId: "t", requestedTenant: "t", active: true,
      scopes: ["devices:read"], requiredScopes: ["devices:read"], nowAt: NOW };
    expect(authorizeApiKey(input).allowed).toBe(true);
    expect(authorizeApiKey({ ...input, requestedTenant: "other" }).allowed).toBe(false);
    expect(authorizeApiKey({ ...input, expiresAt: "2026-10-26T00:00:00Z" }).allowed).toBe(false);
  });
  it("142: optimistic-version alert transitions require actor and reason", () => {
    expect(transitionAlert("OPEN", "ACKNOWLEDGED", 2, 2, "a", "triaged")).toBe(3);
    expect(() => transitionAlert("OPEN", "RESOLVED", 2, 2, "a", "triaged")).toThrow();
    expect(() => transitionAlert("OPEN", "ACKNOWLEDGED", 2, 1, "a", "triaged")).toThrow();
  });
  it("143: incident containment never begins without recorded approval", () => {
    expect(permitContainment("CONTAINMENT_PENDING_APPROVAL", "CONTAINING", false).allowed).toBe(false);
    expect(permitContainment("CONTAINMENT_PENDING_APPROVAL", "CONTAINING", true).allowed).toBe(true);
  });
  it("144: evidence report must be scoped to authorized controls", () => {
    const input = { tenantId: "t", requesterId: "r", start: "2026-10-26T00:00:00Z", end: NOW,
      controls: ["c1"], permitted: new Set(["c1"]), sensitiveRequested: false, sensitiveAllowed: false };
    expect(validateSecurityEvidenceExport(input).allowed).toBe(true);
    expect(validateSecurityEvidenceExport({ ...input, controls: ["outside"] }).allowed).toBe(false);
    expect(validateSecurityEvidenceExport({ ...input, sensitiveRequested: true }).allowed).toBe(false);
  });
  it("145: evidence freshness exposes stale/missing/invalid data", () => {
    expect(evidenceFreshness(undefined, undefined, 7, NOW)).toBe("MISSING");
    expect(evidenceFreshness("2026-10-01T00:00:00Z", undefined, 7, NOW)).toBe("STALE");
    expect(evidenceFreshness("2026-10-27T00:00:00Z", undefined, 7, NOW)).toBe("CURRENT");
    expect(evidenceFreshness("future-date", undefined, 7, NOW)).toBe("REVIEW_REQUIRED");
  });
  it("146: production promotion requires digest, prior staging, separate approver, checks", () => {
    expect(validatePromotion("STAGING", "PRODUCTION", DIGEST, "maker", "checker", [true]).allowed).toBe(true);
    expect(validatePromotion("DEVELOPMENT", "PRODUCTION", DIGEST, "maker", "checker", [true]).allowed).toBe(false);
    expect(validatePromotion("STAGING", "PRODUCTION", DIGEST, "maker", "maker", [true]).allowed).toBe(false);
  });
  it("147: deployment transitions version-gated and rollback auditable", () => {
    expect(deploymentTransition("PROPOSED", "PRECHECK", 2, 2)).toBe(3);
    expect(() => deploymentTransition("PROPOSED", "DEPLOYING", 2, 2)).toThrow();
    expect(() => deploymentTransition("PROPOSED", "PRECHECK", 2, 1)).toThrow();
  });
  it("148: stale/incomplete observability is UNKNOWN, never healthy", () => {
    expect(sloHealth([], NOW, 60, .9, .99).status).toBe("UNKNOWN");
    expect(sloHealth([{ at: "2026-10-20T00:00:00Z", availability: 1 }], NOW, 60, .9, .99).status).toBe("UNKNOWN");
    expect(sloHealth([{ at: NOW, availability: 1 }], NOW, 60, .9, .99).status).toBe("MET");
  });
  it("149: release audit must not accept evidence-less PASS", () => {
    expect(auditRelease([{ key: "ci", mandatory: true, status: "PASS", evidenceRefs: [] }]).eligible).toBe(false);
    expect(auditRelease([{ key: "ci", mandatory: true, status: "PASS", evidenceRefs: ["https://example.test/run"] }]).eligible).toBe(true);
    expect(auditRelease([]).eligible).toBe(false);
  });
  it("150: go-live remains NO_GO on unmet gates or unapproved exceptions", () => {
    expect(assessGoLive([{ key: "backup", mandatory: true, status: "NOT_RUN", evidenceRefs: [] }], NOW).decision).toBe("NO_GO");
    expect(assessGoLive([{ key: "backup", mandatory: true, status: "EXEMPT", evidenceRefs: [] }], NOW).decision).toBe("NO_GO");
    expect(assessGoLive([{ key: "ci", mandatory: true, status: "PASS", evidenceRefs: ["run"] }], NOW).decision).toBe("ELIGIBLE_FOR_HUMAN_SIGNOFF");
  });
});
