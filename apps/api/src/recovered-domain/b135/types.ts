export type WorkOrderStatus = "SCHEDULED" | "CHECKED_IN" | "IN_PROGRESS" | "BLOCKED" | "SUBMITTED" | "VERIFICATION_REQUIRED" | "COMPLETED" | "CANCELLED";
export type ChecklistValue = "PASS" | "FAIL" | "NOT_APPLICABLE";

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  value?: ChecklistValue;
  note?: string;
}

export interface EvidenceItem {
  id: string;
  kind: "PHOTO" | "VIDEO" | "DOCUMENT" | "METER_READING";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  capturedAt?: string;
  uploadedAt?: string;
  caption?: string;
  uploadStatus: "PENDING" | "UPLOADED" | "FAILED";
}

export interface TechnicianWorkOrder {
  id: string;
  title: string;
  deviceLabel: string;
  addressLabel?: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: WorkOrderStatus;
  checklist: ChecklistItem[];
  evidence: EvidenceItem[];
  blockedReason?: string;
  requiresIndependentVerification: boolean;
  version: number;
}

export interface WorkOrderActionResult {
  allowed: boolean;
  nextStatus?: WorkOrderStatus;
  reason?: string;
}
