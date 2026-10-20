import { DeviceHeartbeat, HealthPolicy, HealthSnapshot, RecoveryDecision, RecoveryTask } from './types';
import { buildHealthSnapshot, validateHeartbeat } from './heartbeat';
import { evaluateRecoveryRetry, RecoveryPolicy } from './recovery-policy';

export interface DeviceHealthRepository {
  findRegisteredDevice(tenantId: string, deviceId: string): Promise<{ enabled: boolean } | null>;
  insertHeartbeatIfNew(input: DeviceHeartbeat, receivedAt: Date): Promise<'INSERTED' | 'DUPLICATE' | 'STALE_SEQUENCE'>;
  upsertHealthSnapshot(snapshot: HealthSnapshot): Promise<void>;
  getLatestHeartbeatAt(tenantId: string, deviceId: string): Promise<Date | undefined>;
  enqueueRecoveryTask(input: { tenantId: string; deviceId: string; taskType: RecoveryTask['taskType']; idempotencyKey: string }): Promise<void>;
  recordRecoveryDecision(input: { tenantId: string; deviceId: string; decision: RecoveryDecision; attemptCount: number }): Promise<void>;
}

export class DeviceHealthService {
  constructor(private readonly repo: DeviceHealthRepository, private readonly healthPolicy: HealthPolicy, private readonly recoveryPolicy: RecoveryPolicy) {}

  async receiveHeartbeat(input: DeviceHeartbeat, serverNow = new Date()): Promise<{ accepted: boolean; duplicate: boolean }> {
    validateHeartbeat(input);
    const device = await this.repo.findRegisteredDevice(input.tenantId, input.deviceId);
    if (!device || !device.enabled) throw new Error('Device is not registered or enabled');
    const result = await this.repo.insertHeartbeatIfNew(input, serverNow);
    if (result === 'STALE_SEQUENCE') throw new Error('Heartbeat sequence is stale');
    if (result === 'DUPLICATE') return { accepted: true, duplicate: true };
    const lastHeartbeatAt = await this.repo.getLatestHeartbeatAt(input.tenantId, input.deviceId);
    const snapshot = buildHealthSnapshot({ tenantId: input.tenantId, deviceId: input.deviceId, lastHeartbeatAt, lastSuccessfulSyncAt: input.lastSuccessfulSyncAt, playerVersion: input.playerVersion, freeStorageBytes: input.freeStorageBytes, lastErrorCode: input.errorCode, serverNow, policy: this.healthPolicy });
    await this.repo.upsertHealthSnapshot(snapshot);
    return { accepted: true, duplicate: false };
  }

  async requestRecovery(input: { tenantId: string; deviceId: string; taskType: RecoveryTask['taskType']; idempotencyKey: string }): Promise<void> {
    if (!input.tenantId || !input.deviceId || !input.idempotencyKey) throw new Error('Tenant, device and idempotency key are required');
    const device = await this.repo.findRegisteredDevice(input.tenantId, input.deviceId);
    if (!device) throw new Error('Device not found in tenant');
    await this.repo.enqueueRecoveryTask(input);
  }

  async evaluateRetry(task: RecoveryTask, now = new Date()): Promise<RecoveryDecision> {
    const decision = evaluateRecoveryRetry(task, this.recoveryPolicy, now);
    await this.repo.recordRecoveryDecision({ tenantId: task.tenantId, deviceId: task.deviceId, decision, attemptCount: task.attemptCount });
    return decision;
  }
}
