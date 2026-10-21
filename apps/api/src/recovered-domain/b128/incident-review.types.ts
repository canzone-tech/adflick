export type ReviewStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
export type PreventiveActionStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "VERIFIED" | "CANCELLED";

export interface IncidentFact {
  incidentId: string;
  tenantId: string;
  severity: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
  rootCauseCode?: string;
  affectedDeviceIds?: string[];
}

export interface PatternSummary {
  patternKey: string;
  category: string;
  incidentCount: number;
  affectedDevices: number;
  firstObservedAt?: string;
  lastObservedAt?: string;
  requiresHumanReview: true;
}

export interface ReviewDraft {
  executiveSummary?: string;
  impactSummary?: string;
  rootCauseCode?: string;
  rootCauseNarrative?: string;
  contributingFactors?: string[];
  lessonsLearned?: string;
}

export interface PreventiveAction {
  id: string;
  title: string;
  status: PreventiveActionStatus;
  dueAt?: string;
  ownerUserId?: string;
  completionEvidence?: string;
  verifiedBy?: string;
}
