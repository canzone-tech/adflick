import type { HealthObservation, HealthState, HealthThresholds } from './types';
export function classifyHealth(observation: HealthObservation, thresholds: HealthThresholds): HealthState {
  if (thresholds.offlineAfterSeconds < 1 || thresholds.degradedErrorCount < 0 || thresholds.degradedCommandFailures < 0) throw new Error('INVALID_HEALTH_THRESHOLDS');
  const ageSeconds = Math.max(0, (observation.serverReceivedAt.getTime() - (observation.reportedAt ?? observation.serverReceivedAt).getTime()) / 1000);
  const reportSkewSeconds = observation.reportedAt ? Math.abs((observation.serverReceivedAt.getTime() - observation.reportedAt.getTime()) / 1000) : 0;
  if (reportSkewSeconds > thresholds.maxReportedClockSkewSeconds) return 'UNKNOWN';
  if (observation.consecutiveMisses * thresholds.offlineAfterSeconds >= thresholds.offlineAfterSeconds * 2) return 'OFFLINE';
  if (ageSeconds >= thresholds.offlineAfterSeconds) return 'OFFLINE';
  if (observation.recentErrorCount >= thresholds.degradedErrorCount || observation.commandFailureCount >= thresholds.degradedCommandFailures) return 'DEGRADED';
  return 'HEALTHY';
}
export function buildAlertDedupeKey(tenantId: string, deviceId: string, ruleId: string, windowKey: string): string {
  return [tenantId, deviceId, ruleId, windowKey].map(encodeURIComponent).join(':');
}
