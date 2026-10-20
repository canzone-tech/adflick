export type QualificationInput = {
  eventId: string;
  organizationId: string;
  deviceId: string;
  campaignId: string;
  campaignApproved: boolean;
  deviceEnabled: boolean;
  deviceAssignedToCampaign: boolean;
  manifestPublished: boolean;
  scheduleSlotValid: boolean;
  eventStartMs: number;
  eventEndMs: number;
  receivedAtMs: number;
  expectedDurationMs: number;
  observedDurationMs: number;
  clockDriftMs: number;
  policy: {
    minimumCompletionPercent: number;
    minimumDurationMs?: number | null;
    maxClockDriftMs: number;
    maxEventAgeHours: number;
    allowedOfflineGraceHours: number;
    requireApprovedCampaign: boolean;
    requirePublishedManifest: boolean;
    requireValidScheduleSlot: boolean;
  };
};

export type QualificationResult = {
  decision: 'QUALIFIED' | 'UNDER_REVIEW' | 'REJECTED';
  reasonCodes: string[];
  observedPercent: number;
};

export function qualifyPlayback(input: QualificationInput): QualificationResult {
  const reasons: string[] = [];
  const now = input.receivedAtMs;
  const duration = input.eventEndMs - input.eventStartMs;
  const expected = Math.max(1, input.expectedDurationMs);
  const observedPercent = Math.min(100, Math.floor((input.observedDurationMs / expected) * 100));

  if (!input.deviceEnabled || !input.deviceAssignedToCampaign) {
    return { decision: 'REJECTED', reasonCodes: ['DEVICE_NOT_ELIGIBLE'], observedPercent };
  }
  if (input.policy.requireApprovedCampaign && !input.campaignApproved) {
    return { decision: 'REJECTED', reasonCodes: ['CAMPAIGN_NOT_APPROVED'], observedPercent };
  }
  if (input.policy.requirePublishedManifest && !input.manifestPublished) {
    return { decision: 'REJECTED', reasonCodes: ['MANIFEST_NOT_PUBLISHED'], observedPercent };
  }
  if (input.policy.requireValidScheduleSlot && !input.scheduleSlotValid) {
    return { decision: 'REJECTED', reasonCodes: ['SCHEDULE_SLOT_INVALID'], observedPercent };
  }
  if (duration < 0 || input.observedDurationMs < 0) {
    return { decision: 'REJECTED', reasonCodes: ['INVALID_DURATION'], observedPercent };
  }

  const eventAgeMs = now - input.eventEndMs;
  const maxAgeMs = input.policy.maxEventAgeHours * 60 * 60 * 1000;
  const offlineGraceMs = input.policy.allowedOfflineGraceHours * 60 * 60 * 1000;

  if (input.eventStartMs > now + 5 * 60 * 1000) reasons.push('FUTURE_TIMESTAMP');
  if (Math.abs(input.clockDriftMs) > input.policy.maxClockDriftMs) reasons.push('CLOCK_DRIFT_EXCEEDED');
  if (eventAgeMs > maxAgeMs) reasons.push('EVENT_TOO_OLD');
  if (eventAgeMs > offlineGraceMs) reasons.push('OFFLINE_GRACE_EXCEEDED');
  if (Math.abs(duration - input.observedDurationMs) > 5000) reasons.push('DURATION_MISMATCH');
  if (observedPercent < input.policy.minimumCompletionPercent) reasons.push('COMPLETION_BELOW_THRESHOLD');
  if (input.policy.minimumDurationMs != null && input.observedDurationMs < input.policy.minimumDurationMs) {
    reasons.push('MINIMUM_DURATION_NOT_MET');
  }

  if (reasons.length === 0) {
    return { decision: 'QUALIFIED', reasonCodes: ['POLICY_CHECKS_PASSED'], observedPercent };
  }

  const reviewable = new Set([
    'FUTURE_TIMESTAMP', 'CLOCK_DRIFT_EXCEEDED', 'EVENT_TOO_OLD',
    'OFFLINE_GRACE_EXCEEDED', 'DURATION_MISMATCH',
  ]);
  const onlyReviewSignals = reasons.every(code => reviewable.has(code));
  return {
    decision: onlyReviewSignals ? 'UNDER_REVIEW' : 'REJECTED',
    reasonCodes: reasons,
    observedPercent,
  };
}
