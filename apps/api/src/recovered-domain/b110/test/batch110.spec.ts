import { utilizationBasisPoints, spendVelocityMinorPerMinute, assertSnapshotConsistency } from '../src/budget-monitoring/metrics';
import { evaluateBudgetAlerts, evaluatePauseDecision } from '../src/budget-monitoring/policy';
import { BudgetMonitoringPolicy, CampaignBudgetSnapshot } from '../src/budget-monitoring/types';

const policy: BudgetMonitoringPolicy = { warningPercent: 80, highWarningPercent: 90, criticalPercent: 95, autoPauseOnExhaustion: true, anomalyMultiplier: 3, enabled: true };
const snapshot = (overrides: Partial<CampaignBudgetSnapshot> = {}): CampaignBudgetSnapshot => ({
  tenantId: 'tenant-1', campaignId: 'campaign-1', currency: 'INR', approvedBudgetMinor: 10000n,
  reservedMinor: 10000n, spentMinor: 8200n, availableReservedMinor: 1800n,
  computedAt: new Date('2026-01-01T00:00:00Z'), sourceVersion: 'v1', ...overrides,
});

describe('Batch 110 budget monitoring', () => {
  it('calculates utilization in basis points', () => {
    expect(utilizationBasisPoints(8200n, 10000n)).toBe(8200);
    expect(utilizationBasisPoints(110n, 100n)).toBe(10000);
    expect(utilizationBasisPoints(1n, 0n)).toBe(10000);
  });
  it('emits warning after configured threshold', () => {
    expect(evaluateBudgetAlerts(snapshot(), policy).some(a => a.code === 'BUDGET_WARNING')).toBe(true);
  });
  it('pauses when reservation is exhausted', () => {
    const result = evaluatePauseDecision({ snapshot: snapshot({ availableReservedMinor: 0n }), policy, reservationValid: true, campaignApproved: true, accountAllowed: true });
    expect(result.shouldPause).toBe(true); expect(result.reason).toBe('BUDGET_EXHAUSTED');
  });
  it('pauses when account is restricted even if budget remains', () => {
    const result = evaluatePauseDecision({ snapshot: snapshot(), policy, reservationValid: true, campaignApproved: true, accountAllowed: false });
    expect(result.shouldPause).toBe(true); expect(result.reason).toBe('ACCOUNT_RESTRICTED');
  });
  it('spend velocity uses integer minor units', () => {
    expect(spendVelocityMinorPerMinute(1200n, 60)).toBe(1200n);
    expect(() => spendVelocityMinorPerMinute(10n, 0)).toThrow();
  });
  it('rejects inconsistent budget snapshot', () => {
    expect(() => assertSnapshotConsistency(snapshot({ reservedMinor: 100n, availableReservedMinor: 101n }))).toThrow();
  });
  it('disabled policy emits no alerts', () => {
    expect(evaluateBudgetAlerts(snapshot(), { ...policy, enabled: false })).toEqual([]);
  });
});
