export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface CampaignBudgetSnapshot {
  tenantId: string; campaignId: string; currency: string;
  approvedBudgetMinor: bigint; reservedMinor: bigint; spentMinor: bigint; availableReservedMinor: bigint;
  computedAt: Date; sourceVersion?: string;
}
export interface BudgetMonitoringPolicy {
  warningPercent: number; highWarningPercent: number; criticalPercent: number;
  autoPauseOnExhaustion: boolean; anomalyMultiplier: number;
  maxSpendMinorPerMinute?: bigint | null; enabled: boolean;
}
export interface BudgetAlertDecision { code: string; severity: AlertSeverity; message: string; dedupeKey: string; utilizationBasisPoints: number; }
export interface PauseDecision {
  shouldPause: boolean;
  reason?: 'BUDGET_EXHAUSTED' | 'RESERVATION_INVALID' | 'SPEND_ANOMALY' | 'MANUAL_REVIEW' | 'ACCOUNT_RESTRICTED';
  idempotencyKey?: string;
}
