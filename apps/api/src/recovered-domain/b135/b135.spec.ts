import { describe, expect, it } from "@jest/globals";
import { transitionWorkOrder } from "./state-machine";
import { validateEvidence } from "./evidence-policy";
import type { EvidenceItem } from "./types";

const evidence = (overrides: Partial<EvidenceItem> = {}): EvidenceItem => ({
  id: "e1",
  kind: "PHOTO",
  fileName: "panel.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 200,
  uploadStatus: "UPLOADED",
  ...overrides,
});

describe("Batch 135 technician workspace policies", () => {
  it("requires check-in before starting", () => {
    expect(transitionWorkOrder("SCHEDULED", "START", [], []).allowed).toBe(false);
    expect(transitionWorkOrder("SCHEDULED", "CHECK_IN", [], []).nextStatus).toBe("CHECKED_IN");
  });

  it("accepts NOT_APPLICABLE as a completed required checklist value", () => {
    const result = transitionWorkOrder(
      "IN_PROGRESS",
      "SUBMIT",
      [{ id: "c1", label: "Power test", required: true, value: "NOT_APPLICABLE" }],
      [evidence()],
    );
    expect(result).toEqual({ allowed: true, nextStatus: "SUBMITTED" });
  });

  it("routes failed mandatory checks to independent verification", () => {
    const result = transitionWorkOrder(
      "IN_PROGRESS",
      "SUBMIT",
      [{ id: "c1", label: "Power test", required: true, value: "FAIL" }],
      [evidence()],
    );
    expect(result.nextStatus).toBe("VERIFICATION_REQUIRED");
  });

  it("requires completed evidence before normal submission", () => {
    const result = transitionWorkOrder(
      "IN_PROGRESS",
      "SUBMIT",
      [{ id: "c1", label: "Power test", required: true, value: "PASS" }],
      [evidence({ uploadStatus: "PENDING" })],
    );
    expect(result.allowed).toBe(false);
  });

  it("rejects paths and control characters in evidence file names", () => {
    const result = validateEvidence(
      [evidence({ fileName: "../secret\u0000.jpg" })],
      { allowedMimeTypes: ["image/jpeg"], maxFileBytes: 1000, maxFiles: 3 },
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it("normalizes MIME matching without changing the supplied metadata", () => {
    expect(validateEvidence(
      [evidence({ mimeType: " IMAGE/JPEG " })],
      { allowedMimeTypes: ["image/jpeg"], maxFileBytes: 1000, maxFiles: 3 },
    )).toEqual([]);
  });

  it("rejects invalid evidence policy limits", () => {
    expect(validateEvidence([], { allowedMimeTypes: [], maxFileBytes: 0, maxFiles: -1 })).toEqual([
      "Evidence file-count policy is invalid.",
      "Evidence file-size policy is invalid.",
    ]);
  });
});
