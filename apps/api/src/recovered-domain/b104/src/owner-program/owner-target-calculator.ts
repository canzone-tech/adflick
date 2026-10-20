export type DeviceType = 'TV' | 'SMARTPHONE';

export type OwnerPolicy = {
  version: number;
  deviceType: DeviceType;
  targetAmountMinor: bigint;
  minimumQualifiedEvents: number;
  minimumQualifiedMinutes: number;
  requiredTargetPercent: number;
  requireOwnerConsent: boolean;
  requireDeviceEligible: boolean;
  requireFraudClearance: boolean;
};

export type OwnerPeriodInput = {
  policy: OwnerPolicy;
  qualifiedEvents: number;
  qualifiedMinutes: number;
  ownerConsentCurrent: boolean;
  deviceEligible: boolean;
  fraudClear: boolean;
  unresolvedReviewCount: number;
  activeCampaignOpportunityAvailable: boolean;
};

export type OwnerPeriodCalculation = {
  eligible: boolean;
  targetAmountMinor: bigint;
  qualifiedEvents: number;
  qualifiedMinutes: number;
  completionPercent: number;
  reasonCodes: string[];
  policyVersion: number;
};

export function calculateOwnerPeriod(input: OwnerPeriodInput): OwnerPeriodCalculation {
  const p = input.policy;
  const reasons: string[] = [];
  if (!Number.isInteger(p.requiredTargetPercent) || p.requiredTargetPercent < 1 || p.requiredTargetPercent > 100) {
    throw new Error('POLICY_TARGET_PERCENT_INVALID');
  }
  if (input.qualifiedEvents < 0 || input.qualifiedMinutes < 0) {
    throw new Error('QUALIFIED_METRICS_CANNOT_BE_NEGATIVE');
  }
  if (p.requireOwnerConsent && !input.ownerConsentCurrent) reasons.push('OWNER_CONSENT_MISSING');
  if (p.requireDeviceEligible && !input.deviceEligible) reasons.push('DEVICE_NOT_ELIGIBLE');
  if (p.requireFraudClearance && !input.fraudClear) reasons.push('FRAUD_REVIEW_NOT_CLEARED');
  if (input.unresolvedReviewCount > 0) reasons.push('UNRESOLVED_PLAYBACK_REVIEWS');
  if (!input.activeCampaignOpportunityAvailable) reasons.push('NO_QUALIFYING_CAMPAIGN_OPPORTUNITY');

  const eventPct = p.minimumQualifiedEvents === 0 ? 100 : Math.min(100, Math.floor(input.qualifiedEvents / p.minimumQualifiedEvents * 100));
  const minutePct = p.minimumQualifiedMinutes === 0 ? 100 : Math.min(100, Math.floor(input.qualifiedMinutes / p.minimumQualifiedMinutes * 100));
  const completionPercent = Math.min(eventPct, minutePct);

  if (input.qualifiedEvents < p.minimumQualifiedEvents) reasons.push('QUALIFIED_EVENT_TARGET_NOT_MET');
  if (input.qualifiedMinutes < p.minimumQualifiedMinutes) reasons.push('QUALIFIED_MINUTE_TARGET_NOT_MET');
  if (completionPercent < p.requiredTargetPercent) reasons.push('MONTHLY_TARGET_NOT_MET');

  const eligible = reasons.length === 0;
  return {
    eligible,
    targetAmountMinor: eligible ? p.targetAmountMinor : 0n,
    qualifiedEvents: input.qualifiedEvents,
    qualifiedMinutes: input.qualifiedMinutes,
    completionPercent,
    reasonCodes: eligible ? ['CONDITIONAL_TARGET_MET_PENDING_RECONCILIATION'] : [...new Set(reasons)],
    policyVersion: p.version,
  };
}
