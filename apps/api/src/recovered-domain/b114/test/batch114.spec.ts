import { describe, expect, it } from "@jest/globals";
import { classifyFailure, retryDelayMs, shouldDeadLetter, validateDeliveryPolicy } from "../src/command-delivery/retry-policy";
import { filterRecoverableCommands, shouldApplyCommand } from "../src/command-delivery/offline-recovery";
const policy = { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 12000, jitterRatio: 0.2, claimLeaseMs: 10000 };
describe("Batch 114 durable delivery helpers", () => {
  it("validates bounded retry policy", () => { expect(() => validateDeliveryPolicy({ ...policy, maxAttempts: 100 })).toThrow(); });
  it("uses bounded exponential retry delay", () => { expect(retryDelayMs(1, policy, 0.5)).toBe(1000); expect(retryDelayMs(5, policy, 0.5)).toBe(12000); });
  it("dead-letters after configured maximum attempts", () => { expect(shouldDeadLetter(5, 5)).toBe(true); expect(shouldDeadLetter(4, 5)).toBe(false); });
  it("classifies explicit permanent failures", () => { expect(classifyFailure("DEVICE_REVOKED")).toBe("PERMANENT"); expect(classifyFailure("TEMPORARY_UNAVAILABLE")).toBe("TRANSIENT"); });
  it("filters expired and terminal commands on reconnect", () => { const now = new Date("2026-10-15T00:00:00Z"); const commands = [{ commandId: "a", type: "REFRESH_PLAYLIST", expiresAt: new Date("2026-10-16T00:00:00Z"), status: "QUEUED" }, { commandId: "b", type: "RESTART_PLAYER", expiresAt: new Date("2026-10-14T00:00:00Z"), status: "QUEUED" }, { commandId: "c", type: "CLEAR_CACHE", expiresAt: new Date("2026-10-16T00:00:00Z"), status: "SUCCEEDED" }]; expect(filterRecoverableCommands(commands, now).map(c => c.commandId)).toEqual(["a"]); });
  it("never applies duplicate or unauthenticated commands", () => { expect(shouldApplyCommand({ alreadyProcessed: true, authenticatedDevice: true, tenantMatches: true, notExpired: true })).toBe(false); expect(shouldApplyCommand({ alreadyProcessed: false, authenticatedDevice: false, tenantMatches: true, notExpired: true })).toBe(false); });
});
