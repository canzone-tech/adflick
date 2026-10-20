import { evaluateBudgetAlerts, evaluatePauseDecision } from './policy';
import { BudgetMonitoringPolicy, CampaignBudgetSnapshot } from './types';

export interface BudgetMonitoringRepository {
  getCampaignSnapshot(tenantId: string, campaignId: string): Promise<CampaignBudgetSnapshot>;
  getPolicy(tenantId: string, campaignId: string): Promise<BudgetMonitoringPolicy>;
  upsertAlerts(tenantId: string, campaignId: string, alerts: ReturnType<typeof evaluateBudgetAlerts>): Promise<void>;
  pauseCampaign(input: { tenantId: string; campaignId: string; reason: NonNullable<ReturnType<typeof evaluatePauseDecision>['reason']>; idempotencyKey: string; sourceVersion?: string }): Promise<void>;
  acknowledgeAlert(input: { tenantId: string; alertId: string; userId: string; acknowledgedAt: Date }): Promise<void>;
  getDashboard(tenantId: string, campaignIds: string[]): Promise<CampaignBudgetSnapshot[]>;
}

export class CampaignBudgetMonitoringService {
  constructor(private readonly repo: BudgetMonitoringRepository) {}

  async getDashboard(tenantId: string, campaignIds: string[]) {
    if (!tenantId) throw new Error('Tenant context is required');
    if (campaignIds.length > 100) throw new Error('Request may include at most 100 campaigns');
    const snapshots = await this.repo.getDashboard(tenantId, [...new Set(campaignIds)]);
    return snapshots.map(s => ({ campaignId: s.campaignId, currency: s.currency, approvedBudgetMinor: s.approvedBudgetMinor.toString(), reservedMinor: s.reservedMinor.toString(), spentMinor: s.spentMinor.toString(), availableReservedMinor: s.availableReservedMinor.toString(), computedAt: s.computedAt.toISOString(), sourceVersion: s.sourceVersion }));
  }

  async evaluateCampaign(tenantId: string, campaignId: string, eligibility: { reservationValid: boolean; campaignApproved: boolean; accountAllowed: boolean; currentWindowSpendMinor?: bigint; windowDurationSeconds?: number }): Promise<void> {
    const [snapshot, policy] = await Promise.all([this.repo.getCampaignSnapshot(tenantId, campaignId), this.repo.getPolicy(tenantId, campaignId)]);
    const alerts = evaluateBudgetAlerts(snapshot, policy);
    await this.repo.upsertAlerts(tenantId, campaignId, alerts);
    const pause = evaluatePauseDecision({ snapshot, policy, ...eligibility });
    if (pause.shouldPause && pause.reason && pause.idempotencyKey) await this.repo.pauseCampaign({ tenantId, campaignId, reason: pause.reason, idempotencyKey: pause.idempotencyKey, sourceVersion: snapshot.sourceVersion });
  }

  async acknowledgeAlert(input: { tenantId: string; alertId: string; userId: string }) {
    if (!input.tenantId || !input.alertId || !input.userId) throw new Error('Tenant, alert and user are required');
    await this.repo.acknowledgeAlert({ ...input, acknowledgedAt: new Date() });
  }
}
