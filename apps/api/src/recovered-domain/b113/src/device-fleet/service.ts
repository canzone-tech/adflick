import { assertTransition, validateCommandRequest } from './commands';
import type { CommandAck, CommandRequest, CommandStatus, FleetCommand } from './types';

export interface FleetRepository {
  findByIdempotencyKey(tenantId: string, key: string): Promise<FleetCommand | null>;
  createCommandAndAuditAndOutbox(request: CommandRequest): Promise<FleetCommand>;
  getCommandForTenant(tenantId: string, commandId: string): Promise<FleetCommand | null>;
  transitionAndAudit(commandId: string, from: CommandStatus, to: CommandStatus, detail?: Record<string, unknown>): Promise<void>;
  verifyDeviceBinding(tenantId: string, deviceId: string): Promise<boolean>;
  verifyAckSequence(deviceId: string, sequence: number): Promise<boolean>;
  recordAckAndTransition(ack: CommandAck, next: CommandStatus): Promise<void>;
}
export class DeviceFleetService {
  constructor(private readonly repo: FleetRepository) {}
  async requestCommand(request: CommandRequest): Promise<FleetCommand> {
    validateCommandRequest(request);
    if (!(await this.repo.verifyDeviceBinding(request.tenantId, request.deviceId))) throw new Error('DEVICE_NOT_IN_TENANT');
    const existing = await this.repo.findByIdempotencyKey(request.tenantId, request.idempotencyKey);
    if (existing) {
      if (existing.deviceId !== request.deviceId || existing.type !== request.type) throw new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
      return existing;
    }
    return this.repo.createCommandAndAuditAndOutbox(request);
  }
  async acknowledge(tenantId: string, ack: CommandAck): Promise<void> {
    const command = await this.repo.getCommandForTenant(tenantId, ack.commandId);
    if (!command || command.deviceId !== ack.deviceId) throw new Error('COMMAND_DEVICE_SCOPE_MISMATCH');
    if (!(await this.repo.verifyAckSequence(ack.deviceId, ack.sequence))) throw new Error('INVALID_OR_REPLAYED_ACK_SEQUENCE');
    if (command.status !== 'DISPATCHED' && command.status !== 'ACKNOWLEDGED') throw new Error('COMMAND_NOT_ACKNOWLEDGEABLE');
    if (ack.result === 'ACKNOWLEDGED') { assertTransition(command.status, 'ACKNOWLEDGED'); await this.repo.recordAckAndTransition(ack, 'ACKNOWLEDGED'); return; }
    assertTransition(command.status, ack.result);
    await this.repo.recordAckAndTransition(ack, ack.result);
  }
}
