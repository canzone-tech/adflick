import { calculateOwnerPeriod } from '../src/owner-program/owner-target-calculator';
import { accrualIdempotencyKey } from '../src/owner-program/ledger-idempotency';

const policy = {
  version: 4, deviceType: 'TV' as const, targetAmountMinor: 100000n,
  minimumQualifiedEvents: 100, minimumQualifiedMinutes: 300,
  requiredTargetPercent: 100, requireOwnerConsent: true,
  requireDeviceEligible: true, requireFraudClearance: true,
};

const base = {
  policy, qualifiedEvents: 100, qualifiedMinutes: 300,
  ownerConsentCurrent: true, deviceEligible: true, fraudClear: true,
  unresolvedReviewCount: 0, activeCampaignOpportunityAvailable: true,
};

describe('Batch 104 owner target calculation', () => {
  it('marks an owner period eligible only when all policy conditions pass', () => {
    const result = calculateOwnerPeriod(base);
    expect(result.eligible).toBe(true);
    expect(result.targetAmountMinor).toBe(100000n);
  });
  it('does not create a candidate amount when the target is missed', () => {
    const result = calculateOwnerPeriod({ ...base, qualifiedEvents: 99 });
    expect(result.eligible).toBe(false);
    expect(result.targetAmountMinor).toBe(0n);
    expect(result.reasonCodes).toContain('QUALIFIED_EVENT_TARGET_NOT_MET');
  });
  it('blocks periods with unresolved playback reviews', () => {
    expect(calculateOwnerPeriod({ ...base, unresolvedReviewCount: 1 }).eligible).toBe(false);
  });
  it('blocks periods without current owner consent', () => {
    expect(calculateOwnerPeriod({ ...base, ownerConsentCurrent: false }).eligible).toBe(false);
  });
  it('uses deterministic idempotency keys for accrual jobs', () => {
    const input = { organizationId: 'org', ownerId: 'owner', deviceId: 'device', targetPeriodId: 'period', policyVersion: 4 };
    expect(accrualIdempotencyKey(input)).toBe(accrualIdempotencyKey(input));
  });
  it('keeps TV and smartphone amounts policy-driven rather than hardcoded', () => {
    const mobile = { ...base, policy: { ...policy, deviceType: 'SMARTPHONE' as const, targetAmountMinor: 33300n } };
    expect(calculateOwnerPeriod(mobile).targetAmountMinor).toBe(33300n);
  });
});
