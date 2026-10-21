import { describe, expect, it } from "@jest/globals";
import { summarizeCompliance } from "../src/config-compliance/summary";
import { planRemediation } from "../src/config-compliance/remediation";
describe("Batch 116 compliance summary", () => {
  it("counts only matching current revisions and hashes as compliant", () => { const summary = summarizeCompliance([{ tenantId: "t", deviceId: "d1", status: "IN_SYNC", desiredRevision: 2, reportedRevision: 2, desiredHash: "abc", reportedHash: "abc", online: true, groupIds: [] }, { tenantId: "t", deviceId: "d2", status: "IN_SYNC", desiredRevision: 3, reportedRevision: 2, desiredHash: "def", reportedHash: "def", online: true, groupIds: [] }]); expect(summary.compliant).toBe(1); expect(summary.unknown).toBe(1); expect(summary.compliancePercent).toBe(50); });
  it("returns null compliance percentage for an empty fleet", () => { expect(summarizeCompliance([]).compliancePercent).toBeNull(); });
});
describe("Batch 116 remediation planning", () => {
  const candidate = { deviceId: "d1", status: "DRIFTED" as const, online: true, desiredRevision: 4, currentDesiredRevision: 4, compatible: true, expectedHash: "a".repeat(64) };
  it("builds a dry-run plan with bounded batches", () => { const plan = planRemediation([candidate], { dryRun: true, batchSize: 10, maxTargets: 100, allowOfflineQueue: false }); expect(plan.eligibleDeviceIds).toEqual(["d1"]); expect(plan.batchCount).toBe(1); expect(plan.dryRun).toBe(true); });
  it("skips stale, incompatible, and already synchronized devices", () => { const plan = planRemediation([{ ...candidate, deviceId: "stale", currentDesiredRevision: 3 }, { ...candidate, deviceId: "old-player", compatible: false }, { ...candidate, deviceId: "ok", status: "IN_SYNC" }], { dryRun: true, batchSize: 10, maxTargets: 100, allowOfflineQueue: false }); expect(plan.eligibleDeviceIds).toHaveLength(0); expect(plan.skipped).toHaveLength(3); });
  it("rejects invalid batch sizes", () => { expect(() => planRemediation([candidate], { dryRun: true, batchSize: 0, maxTargets: 10, allowOfflineQueue: false })).toThrow(); });
});
