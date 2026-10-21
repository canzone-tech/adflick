import { describe, expect, it } from "@jest/globals";
import { canonicalJson, configSha256 } from "../src/device-config/canonical-hash";
import { compareConfig, isPlayerCompatible, reconciliationAction } from "../src/device-config/drift";
describe("Batch 115 configuration helpers", () => {
  it("canonicalizes object key order consistently", () => { expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 })); expect(configSha256({ b: 2, a: 1 })).toBe(configSha256({ a: 1, b: 2 })); });
  it("rejects non-finite numeric configuration values", () => { expect(() => configSha256({ volume: Number.NaN })).toThrow("NON_FINITE_CONFIG_NUMBER"); });
  it("compares desired and reported hashes", () => { expect(compareConfig({ hash: "a".repeat(64), schemaVersion: "1" }, { tenantId: "t1", deviceId: "d1", desiredRevision: 2, schemaVersion: "1", playerVersion: "1.2.0", reportedPayload: {}, reportedHash: "a".repeat(64), receivedAt: new Date() }, true).status).toBe("IN_SYNC"); });
  it("blocks incompatible player versions", () => { const profile = { tenantId: "t1", profileKey: "default", version: 1, status: "APPROVED" as const, schemaVersion: "1", payload: {}, canonicalHash: "a".repeat(64), minPlayerVersion: "2.0.0" }; expect(isPlayerCompatible(profile, "1.9.9")).toBe(false); });
  it("never syncs stale assignments or offline devices", () => { expect(reconciliationAction("DRIFTED", true, false)).toBe("BLOCK"); expect(reconciliationAction("DRIFTED", false, true)).toBe("BLOCK"); expect(reconciliationAction("DRIFTED", true, true)).toBe("SYNC_CONFIGURATION"); });
  it("does not auto-reconcile unknown or incompatible snapshots", () => { expect(reconciliationAction("UNKNOWN", true, true)).toBe("BLOCK"); expect(reconciliationAction("INCOMPATIBLE", true, true)).toBe("BLOCK"); });
});
