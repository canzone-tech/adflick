export const COMMAND_STATUSES = [
  "QUEUED",
  "DISPATCHED",
  "ACKNOWLEDGED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "DENIED",
  "DELIVERY_UNKNOWN",
] as const;

export type CommandStatus = (typeof COMMAND_STATUSES)[number];

const allowedTransitions: Record<CommandStatus, readonly CommandStatus[]> = {
  QUEUED: ["DISPATCHED", "CANCELLED", "DENIED", "EXPIRED"],
  DISPATCHED: ["ACKNOWLEDGED", "DELIVERY_UNKNOWN", "FAILED", "EXPIRED", "CANCELLED"],
  ACKNOWLEDGED: ["EXECUTING", "COMPLETED", "FAILED", "DELIVERY_UNKNOWN"],
  EXECUTING: ["COMPLETED", "FAILED", "DELIVERY_UNKNOWN"],
  DELIVERY_UNKNOWN: ["ACKNOWLEDGED", "EXECUTING", "COMPLETED", "FAILED", "EXPIRED"],
  COMPLETED: [],
  FAILED: [],
  EXPIRED: [],
  CANCELLED: [],
  DENIED: [],
};

export function canTransitionCommand(from: CommandStatus, to: CommandStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export interface CommandEventCursor {
  status: CommandStatus;
  lastSequence: number;
}

export interface CommandEventUpdate {
  status: CommandStatus;
  sequence: number;
}

export function applyCommandEvent(
  current: CommandEventCursor,
  event: CommandEventUpdate,
): CommandEventCursor & { applied: boolean } {
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) {
    throw new Error("INVALID_EVENT_SEQUENCE");
  }
  if (event.sequence <= current.lastSequence) return { ...current, applied: false };
  if (!canTransitionCommand(current.status, event.status)) {
    throw new Error(`INVALID_COMMAND_TRANSITION:${current.status}:${event.status}`);
  }
  return { status: event.status, lastSequence: event.sequence, applied: true };
}

export interface BulkCommandCandidate {
  deviceId: string;
  tenantMatches: boolean;
  trusted: boolean;
  credentialActive: boolean;
  online: boolean;
  compatible: boolean;
  hasPendingCommand: boolean;
}

export interface BulkCommandPreview {
  eligibleDeviceIds: string[];
  rejected: Array<{ deviceId: string; reasonCode: string }>;
  requiresApproval: true;
  dryRun: true;
}

export function previewBulkCommand(
  candidates: BulkCommandCandidate[],
  maxBatchSize = 100,
): BulkCommandPreview {
  if (!Number.isSafeInteger(maxBatchSize) || maxBatchSize < 1) {
    throw new Error("INVALID_BULK_BATCH_LIMIT");
  }
  if (candidates.length > maxBatchSize) {
    throw new Error("BULK_SELECTION_LIMIT_EXCEEDED");
  }

  const seen = new Set<string>();
  const eligibleDeviceIds: string[] = [];
  const rejected: Array<{ deviceId: string; reasonCode: string }> = [];

  for (const candidate of candidates) {
    const deviceId = candidate.deviceId.trim();
    if (!deviceId) {
      rejected.push({ deviceId: candidate.deviceId, reasonCode: "DEVICE_ID_REQUIRED" });
      continue;
    }
    if (seen.has(deviceId)) {
      rejected.push({ deviceId, reasonCode: "DUPLICATE_DEVICE_SELECTION" });
      continue;
    }
    seen.add(deviceId);

    const reasonCode =
      !candidate.tenantMatches ? "TENANT_SCOPE_MISMATCH" :
      !candidate.trusted ? "DEVICE_NOT_TRUSTED" :
      !candidate.credentialActive ? "CREDENTIAL_NOT_ACTIVE" :
      !candidate.compatible ? "DEVICE_INCOMPATIBLE" :
      candidate.hasPendingCommand ? "PENDING_COMMAND_EXISTS" :
      !candidate.online ? "DEVICE_OFFLINE" : undefined;

    if (reasonCode) rejected.push({ deviceId, reasonCode });
    else eligibleDeviceIds.push(deviceId);
  }

  return { eligibleDeviceIds, rejected, requiresApproval: true, dryRun: true };
}
