import { describe, expect, it } from "@jest/globals";
import { applyCommandEvent, canTransitionCommand, previewBulkCommand, type BulkCommandCandidate } from "./command-center-policy";

const eligible = (deviceId: string): BulkCommandCandidate => ({
  deviceId,
  tenantMatches: true,
  trusted: true,
  credentialActive: true,
  online: true,
  compatible: true,
  hasPendingCommand: false,
});

describe("Recovered Batch 125 command center policies", () => {
  it("keeps dispatch, acknowledgement, execution and completion distinct", () => {
    expect(canTransitionCommand("DISPATCHED", "ACKNOWLEDGED")).toBe(true);
    expect(canTransitionCommand("DISPATCHED", "COMPLETED")).toBe(false);
    expect(canTransitionCommand("ACKNOWLEDGED", "EXECUTING")).toBe(true);
  });

  it("does not apply duplicate or old event sequences", () => {
    expect(applyCommandEvent({ status: "DISPATCHED", lastSequence: 3 }, {
      status: "ACKNOWLEDGED", sequence: 3,
    })).toEqual({ status: "DISPATCHED", lastSequence: 3, applied: false });
  });

  it("rejects invalid event sequences and transitions", () => {
    expect(() => applyCommandEvent({ status: "QUEUED", lastSequence: 0 }, {
      status: "DISPATCHED", sequence: 0,
    })).toThrow("INVALID_EVENT_SEQUENCE");
    expect(() => applyCommandEvent({ status: "COMPLETED", lastSequence: 1 }, {
      status: "QUEUED", sequence: 2,
    })).toThrow("INVALID_COMMAND_TRANSITION:COMPLETED:QUEUED");
  });

  it("preserves delivery-unknown for reconciliation instead of guessing an outcome", () => {
    expect(canTransitionCommand("DISPATCHED", "DELIVERY_UNKNOWN")).toBe(true);
    expect(canTransitionCommand("DELIVERY_UNKNOWN", "ACKNOWLEDGED")).toBe(true);
    expect(canTransitionCommand("DELIVERY_UNKNOWN", "COMPLETED")).toBe(true);
  });

  it("defaults bulk operations to dry-run and requires approval", () => {
    const preview = previewBulkCommand([eligible("d1")]);
    expect(preview).toEqual({
      eligibleDeviceIds: ["d1"],
      rejected: [],
      requiresApproval: true,
      dryRun: true,
    });
  });

  it("rejects unsafe candidates with explicit eligibility reasons", () => {
    const preview = previewBulkCommand([
      { ...eligible("offline"), online: false },
      { ...eligible("untrusted"), trusted: false },
      { ...eligible("wrong-tenant"), tenantMatches: false },
      { ...eligible("pending"), hasPendingCommand: true },
    ]);
    expect(preview.eligibleDeviceIds).toEqual([]);
    expect(preview.rejected.map((item) => item.reasonCode)).toEqual([
      "DEVICE_OFFLINE",
      "DEVICE_NOT_TRUSTED",
      "TENANT_SCOPE_MISMATCH",
      "PENDING_COMMAND_EXISTS",
    ]);
  });

  it("rejects duplicate device selections and over-limit bulk requests", () => {
    expect(previewBulkCommand([eligible("d1"), eligible("d1")]).rejected).toEqual([
      { deviceId: "d1", reasonCode: "DUPLICATE_DEVICE_SELECTION" },
    ]);
    expect(() => previewBulkCommand([eligible("d1"), eligible("d2")], 1))
      .toThrow("BULK_SELECTION_LIMIT_EXCEEDED");
  });
});
