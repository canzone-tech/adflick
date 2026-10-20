export type ConnectionStatus = 'UNKNOWN' | 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'DISABLED';
export interface DeviceHeartbeat {
  tenantId: string; deviceId: string; sequence: bigint; clientReportedAt?: Date; playerVersion?: string;
  uptimeSeconds?: bigint; freeStorageBytes?: bigint; networkType?: string; lastSuccessfulSyncAt?: Date;
  lastPlaybackReportAt?: Date; errorCode?: string; idempotencyKey: string;
}
export interface HealthPolicy { onlineWithinSeconds: number; degradedWithinSeconds: number; offlineAfterSeconds: number; maxClockSkewSeconds: number; minimumFreeStorageBytes?: bigint; }
export interface HealthSnapshot { tenantId: string; deviceId: string; status: ConnectionStatus; lastHeartbeatAt?: Date; lastSuccessfulSyncAt?: Date; playerVersion?: string; freeStorageBytes?: bigint; lastErrorCode?: string; computedAt: Date; }
export interface RecoveryTask { tenantId: string; deviceId: string; taskType: 'CONTENT_SYNC' | 'PLAYER_RESTART' | 'DIAGNOSTIC_UPLOAD' | 'CONFIG_REFRESH'; attemptCount: number; maxAttempts: number; lastErrorCode?: string; }
export interface RecoveryDecision { retry: boolean; nextAttemptAt?: Date; terminalReason?: string; }
