import { DeviceHeartbeat, HealthPolicy, HealthSnapshot, ConnectionStatus } from './types';

export function validateHeartbeat(input: DeviceHeartbeat): void {
  if (!input.tenantId.trim() || !input.deviceId.trim()) throw new Error('Authenticated tenant and device are required');
  if (input.sequence < 0n) throw new Error('Heartbeat sequence cannot be negative');
  if (!input.idempotencyKey.trim()) throw new Error('Idempotency key is required');
  if (input.uptimeSeconds != null && input.uptimeSeconds < 0n) throw new Error('Uptime cannot be negative');
  if (input.freeStorageBytes != null && input.freeStorageBytes < 0n) throw new Error('Storage cannot be negative');
  if (input.clientReportedAt && !Number.isFinite(input.clientReportedAt.getTime())) throw new Error('Invalid client timestamp');
}

export function classifyConnectionStatus(lastHeartbeatAt: Date | undefined, serverNow: Date, policy: HealthPolicy): ConnectionStatus {
  if (![policy.onlineWithinSeconds, policy.degradedWithinSeconds, policy.offlineAfterSeconds].every(Number.isFinite) || policy.onlineWithinSeconds < 0 || policy.degradedWithinSeconds < policy.onlineWithinSeconds || policy.offlineAfterSeconds < policy.degradedWithinSeconds) throw new Error('Heartbeat freshness thresholds are invalid');
  if (!Number.isFinite(serverNow.getTime())) throw new Error('Invalid server time');
  if (!lastHeartbeatAt || !Number.isFinite(lastHeartbeatAt.getTime())) return 'UNKNOWN';
  const ageSeconds = Math.max(0, (serverNow.getTime() - lastHeartbeatAt.getTime()) / 1000);
  if (ageSeconds <= policy.onlineWithinSeconds) return 'ONLINE';
  if (ageSeconds <= policy.degradedWithinSeconds) return 'DEGRADED';
  if (ageSeconds >= policy.offlineAfterSeconds) return 'OFFLINE';
  return 'DEGRADED';
}

export function buildHealthSnapshot(input: { tenantId: string; deviceId: string; lastHeartbeatAt?: Date; lastSuccessfulSyncAt?: Date; playerVersion?: string; freeStorageBytes?: bigint; lastErrorCode?: string; serverNow: Date; policy: HealthPolicy }): HealthSnapshot {
  const status = classifyConnectionStatus(input.lastHeartbeatAt, input.serverNow, input.policy);
  if (input.policy.minimumFreeStorageBytes != null && input.freeStorageBytes != null && input.freeStorageBytes < input.policy.minimumFreeStorageBytes && status === 'ONLINE') {
    return { tenantId: input.tenantId, deviceId: input.deviceId, status: 'DEGRADED', lastHeartbeatAt: input.lastHeartbeatAt, lastSuccessfulSyncAt: input.lastSuccessfulSyncAt, playerVersion: input.playerVersion, freeStorageBytes: input.freeStorageBytes, lastErrorCode: input.lastErrorCode ?? 'LOW_STORAGE', computedAt: input.serverNow };
  }
  return { tenantId: input.tenantId, deviceId: input.deviceId, status, lastHeartbeatAt: input.lastHeartbeatAt, lastSuccessfulSyncAt: input.lastSuccessfulSyncAt, playerVersion: input.playerVersion, freeStorageBytes: input.freeStorageBytes, lastErrorCode: input.lastErrorCode, computedAt: input.serverNow };
}
