import type { ReviewDraft, ReviewStatus } from "./incident-review.types";

export function validateReviewDraft(draft: ReviewDraft): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!draft.executiveSummary?.trim()) errors.push("EXECUTIVE_SUMMARY_REQUIRED");
  if (!draft.impactSummary?.trim()) errors.push("IMPACT_SUMMARY_REQUIRED");
  if (!draft.rootCauseCode?.trim()) errors.push("ROOT_CAUSE_CODE_REQUIRED");
  if (!draft.rootCauseNarrative?.trim()) errors.push("ROOT_CAUSE_NARRATIVE_REQUIRED");
  if (!draft.lessonsLearned?.trim()) errors.push("LESSONS_LEARNED_REQUIRED");
  if ((draft.contributingFactors?.length ?? 0) > 20) errors.push("TOO_MANY_CONTRIBUTING_FACTORS");
  if (draft.contributingFactors?.some((factor) => !factor.trim())) errors.push("EMPTY_CONTRIBUTING_FACTOR");
  return { valid: errors.length === 0, errors };
}

const reviewTransitions: Record<ReviewStatus, readonly ReviewStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: [],
  REJECTED: ["DRAFT"],
};

export function canTransitionReview(from: ReviewStatus, to: ReviewStatus): boolean {
  return reviewTransitions[from].includes(to);
}

export function validateReviewTransition(input: {
  from: ReviewStatus;
  to: ReviewStatus;
  actorUserId?: string;
  draft?: ReviewDraft;
  expectedVersion?: number;
  currentVersion?: number;
}): { accepted: true; auditRequired: true; nextVersion: number } {
  if (!input.actorUserId?.trim()) throw new Error("ACTOR_REQUIRED");
  if (!canTransitionReview(input.from, input.to)) throw new Error("INVALID_REVIEW_TRANSITION");
  if (input.expectedVersion !== undefined && input.currentVersion !== input.expectedVersion) {
    throw new Error("REVIEW_VERSION_CONFLICT");
  }
  if ((input.to === "IN_REVIEW" || input.to === "APPROVED") && !validateReviewDraft(input.draft ?? {}).valid) {
    throw new Error("REVIEW_DRAFT_INCOMPLETE");
  }
  return {
    accepted: true,
    auditRequired: true,
    nextVersion: (input.currentVersion ?? 0) + 1,
  };
}
