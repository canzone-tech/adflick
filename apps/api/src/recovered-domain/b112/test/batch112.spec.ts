import { classifyConnectionStatus, validateHeartbeat, buildHealthSnapshot } from '../src/device-health/heartbeat';
import { evaluateRecoveryRetry } from '../src/device-health/recovery-policy';
import { DeviceHeartbeat, HealthPolicy } from '../src/device-health/types';

const policy: HealthPolicy = { onlineWithinSeconds: 45, degradedWithinSeconds: 120, offlineAfterSeconds: 300, maxClockSkewSeconds: 300, minimumFreeStorageBytes: 1000n };
const now = new Date('2026-01-01T00:10:00Z');

describe('Batch 112 device health', () => {
  it('classifies heartbeat freshness', () => {
    expect(classifyConnectionStatus(new Date(now.getTime() - 10_000), now, policy)).toBe('ONLINE');
    expect(classifyConnectionStatus(new Date(now.getTime() - 90_000), now, policy)).toBe('DEGRADED');
    expect(classifyConnectionStatus(new Date(now.getTime() - 400_000), now, policy)).toBe('OFFLINE');
    expect(classifyConnectionStatus(undefined, now, policy)).toBe('UNKNOWN');
  });
  it('validates heartbeat identifiers and counters', () => {
    const heartbeat: DeviceHeartbeat = { tenantId: 't1', deviceId: 'd1', sequence: 1n, idempotencyKey: 'h1', uptimeSeconds: 10n, freeStorageBytes: 2000n };
    expect(() => validateHeartbeat(heartbeat)).not.toThrow();
    expect(() => validateHeartbeat({ ...heartbeat, sequence: -1n })).toThrow();
    expect(() => validateHeartbeat({ ...heartbeat, idempotencyKey: ' ' })).toThrow();
  });
  it('marks low-storage online devices as degraded', () => {
    const result = buildHealthSnapshot({ tenantId: 't1', deviceId: 'd1', lastHeartbeatAt: now, freeStorageBytes: 10n, serverNow: now, policy });
    expect(result.status).toBe('DEGRADED'); expect(result.lastErrorCode).toBe('LOW_STORAGE');
  });
  it('uses bounded exponential recovery backoff', () => {
    const result = evaluateRecoveryRetry({ tenantId: 't1', deviceId: 'd1', taskType: 'CONTENT_SYNC', attemptCount: 2, maxAttempts: 5 }, { baseDelaySeconds: 10, maxDelaySeconds: 60, maxAttempts: 5 }, now);
    expect(result.retry).toBe(true); expect(result.nextAttemptAt?.getTime()).toBe(now.getTime() + 40_000);
  });
  it('stops recovery after max attempts', () => {
    const result = evaluateRecoveryRetry({ tenantId: 't1', deviceId: 'd1', taskType: 'PLAYER_RESTART', attemptCount: 5, maxAttempts: 5 }, { baseDelaySeconds: 10, maxDelaySeconds: 60, maxAttempts: 5 }, now);
    expect(result.retry).toBe(false); expect(result.terminalReason).toBe('MAX_ATTEMPTS_REACHED');
  });
  it('rejects invalid freshness policy', () => {
    expect(() => classifyConnectionStatus(now, now, { ...policy, degradedWithinSeconds: 20 })).toThrow();
  });
});
