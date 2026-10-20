import { utilizationBasisPoints, assertSnapshotConsistency, spendVelocityMinorPerMinute } from './metrics';
import { BudgetAlertDecision, BudgetMonitoringPolicy, CampaignBudgetSnapshot, PauseDecision } from './types';

function validatePercentages(policy: BudgetMonitoringPolicy): void {
  const values = [policy.warningPercent, policy.highWarningPercent, policy.criticalPercent];
  if (values.some(v => !Number.isInteger(v) || v < 1 || v > 100)) throw new Error('Budget thresholds must be whole percentages from 1 to 100');
  if (!(policy.warningPercent < policy.highWarningPercent && policy.highWarningPercent < policy.criticalPercent)) throw new Error('Thresholds must increase from warning to critical');
  if (!Number.isInteger(policy.anomalyMultiplier) || policy.anomalyMultiplier < 1) throw new Error('Anomaly multiplier must be a positive integer');
}

export function evaluateBudgetAlerts(snapshot: CampaignBudgetSnapshot, policy: BudgetMonitoringPolicy): BudgetAlertDecision[] {
  if (!policy.enabled) return [];
  validatePercentages(policy); assertSnapshotConsistency(snapshot);
  const bp = utilizationBasisPoints(snapshot.spentMinor, snapshot.approvedBudgetMinor);
  const pct = Math.floor(bp / 100);
  const alerts: BudgetAlertDecision[] = [];
  const add = (code: string, severity: BudgetAlertDecision['severity'], message: string) => alerts.push({ code, severity, message, dedupeKey: `${snapshot.campaignId}:${code}:${Math.floor(bp / 1000)}`, utilizationBasisPoints: bp });
  if (pct >= policy.criticalPercent) add('BUDGET_CRITICAL', 'CRITICAL', 'Campaign budget utilization reached the critical threshold.');
  else if (pct >= policy.highWarningPercent) add('BUDGET_HIGH', 'WARNING', 'Campaign budget utilization reached the high-warning threshold.');
  else if (pct >= policy.warningPercent) add('BUDGET_WARNING', 'INFO', 'Campaign budget utilization reached the warning threshold.');
  if (snapshot.availableReservedMinor === 0n) add('RESERVATION_EXHAUSTED', 'CRITICAL', 'No campaign reservation remains available.');
  return alerts;
}

export function evaluatePauseDecision(input: {
  snapshot: CampaignBudgetSnapshot; policy: BudgetMonitoringPolicy; reservationValid: boolean;
  campaignApproved: boolean; accountAllowed: boolean; currentWindowSpendMinor?: bigint; windowDurationSeconds?: number;
}): PauseDecision {
  assertSnapshotConsistency(input.snapshot);
  if (!input.campaignApproved || !input.accountAllowed || !input.reservationValid) {
    return { shouldPause: true, reason: !input.accountAllowed ? 'ACCOUNT_RESTRICTED' : !input.reservationValid ? 'RESERVATION_INVALID' : 'MANUAL_REVIEW', idempotencyKey: `${input.snapshot.tenantId}:${input.snapshot.campaignId}:eligibility:${input.snapshot.sourceVersion ?? 'unknown'}` };
  }
  if (input.policy.autoPauseOnExhaustion && input.snapshot.availableReservedMinor === 0n) {
    return { shouldPause: true, reason: 'BUDGET_EXHAUSTED', idempotencyKey: `${input.snapshot.tenantId}:${input.snapshot.campaignId}:exhausted:${input.snapshot.sourceVersion ?? 'unknown'}` };
  }
  if (input.policy.maxSpendMinorPerMinute != null && input.currentWindowSpendMinor != null && input.windowDurationSeconds != null) {
    const velocity = spendVelocityMinorPerMinute(input.currentWindowSpendMinor, input.windowDurationSeconds);
    if (velocity > input.policy.maxSpendMinorPerMinute * BigInt(input.policy.anomalyMultiplier)) {
      return { shouldPause: true, reason: 'SPEND_ANOMALY', idempotencyKey: `${input.snapshot.tenantId}:${input.snapshot.campaignId}:velocity:${input.snapshot.sourceVersion ?? 'unknown'}` };
    }
  }
  return { shouldPause: false };
}
