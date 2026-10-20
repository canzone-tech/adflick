import type { CommandRequest, CommandStatus, RolloutDecision, RolloutDecisionInput } from './types';

const ALLOWED: Record<CommandRequest['type'], string[]> = {
  REFRESH_PLAYLIST: [], SYNC_CONFIGURATION: ['profileId', 'profileVersion'], RESTART_PLAYER: ['reason'], CLEAR_CACHE: ['cacheScope'], UPDATE_PLAYER: ['releaseId', 'targetVersion'], PAUSE_PLAYBACK: ['reason'], RESUME_PLAYBACK: ['reason'],
};
const TRANSITIONS: Record<CommandStatus, CommandStatus[]> = {
  QUEUED: ['DISPATCHED', 'CANCELLED', 'EXPIRED'], DISPATCHED: ['ACKNOWLEDGED', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'], ACKNOWLEDGED: ['SUCCEEDED', 'FAILED', 'EXPIRED'], SUCCEEDED: [], FAILED: [], EXPIRED: [], CANCELLED: [],
};

export function validateCommandRequest(input: CommandRequest, now = new Date()): void {
  if (!input.tenantId || !input.deviceId || !input.requestedById) throw new Error('MISSING_SCOPE');
  if (!input.idempotencyKey || input.idempotencyKey.length > 128) throw new Error('INVALID_IDEMPOTENCY_KEY');
  if (!input.correlationId || input.correlationId.length > 100) throw new Error('INVALID_CORRELATION_ID');
  if (!Number.isFinite(input.expiresAt.getTime()) || input.expiresAt <= now) throw new Error('INVALID_EXPIRY');
  const payload = input.payload ?? {};
  const allowed = ALLOWED[input.type];
  if (!allowed) throw new Error('UNSUPPORTED_COMMAND');
  for (const key of Object.keys(payload)) if (!allowed.includes(key)) throw new Error(`UNSUPPORTED_PAYLOAD_FIELD:${key}`);
  for (const key of Object.keys(payload)) if (/secret|password|token|shell|commandline|script/i.test(key)) throw new Error('FORBIDDEN_PAYLOAD_FIELD');
}
export function canTransition(from: CommandStatus, to: CommandStatus): boolean { return TRANSITIONS[from].includes(to); }
export function assertTransition(from: CommandStatus, to: CommandStatus): void { if (!canTransition(from, to)) throw new Error(`INVALID_COMMAND_TRANSITION:${from}->${to}`); }
function fnv1a32(value: string): number { let hash = 0x811c9dc5; for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return hash >>> 0; }
export function cohortNumber(rolloutId: string, stableDeviceKey: string): number { return fnv1a32(`${rolloutId}:${stableDeviceKey}`) % 100; }
export function decideRollout(input: RolloutDecisionInput): RolloutDecision {
  if (input.currentlyPaused) return { action: 'PAUSE', reason: 'ROLLOUT_ALREADY_PAUSED' };
  if (input.cohortPercent < 1 || input.cohortPercent > 100) return { action: 'HOLD', reason: 'INVALID_COHORT_PERCENT' };
  if (input.maxFailurePercent < 0 || input.maxFailurePercent > 100) return { action: 'HOLD', reason: 'INVALID_FAILURE_THRESHOLD' };
  if (input.healthySample < input.minHealthySample) return { action: 'HOLD', reason: 'INSUFFICIENT_HEALTHY_SAMPLE' };
  if (input.failurePercent >= input.maxFailurePercent) return { action: 'PAUSE', reason: 'FAILURE_THRESHOLD_REACHED' };
  const cohort = cohortNumber(input.rolloutId, input.stableDeviceKey);
  if (cohort >= input.cohortPercent) return { action: 'HOLD', reason: 'DEVICE_OUTSIDE_CURRENT_COHORT' };
  return { action: 'CONTINUE', reason: 'DEVICE_IN_ACTIVE_COHORT' };
}
