export type CommandType = 'REFRESH_PLAYLIST' | 'SYNC_CONFIGURATION' | 'RESTART_PLAYER' | 'CLEAR_CACHE' | 'UPDATE_PLAYER' | 'PAUSE_PLAYBACK' | 'RESUME_PLAYBACK';
export type CommandStatus = 'QUEUED' | 'DISPATCHED' | 'ACKNOWLEDGED' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
export interface FleetCommand { id: string; tenantId: string; deviceId: string; type: CommandType; status: CommandStatus; payload?: Record<string, unknown>; idempotencyKey: string; requestedById: string; requestedAt: Date; expiresAt: Date; attemptCount: number; correlationId: string; }
export interface CommandRequest { tenantId: string; deviceId: string; type: CommandType; payload?: Record<string, unknown>; idempotencyKey: string; requestedById: string; expiresAt: Date; correlationId: string; }
export interface CommandAck { commandId: string; deviceId: string; sequence: number; result: 'ACKNOWLEDGED' | 'SUCCEEDED' | 'FAILED'; resultCode?: string; summary?: string; receivedAt: Date; }
export interface RolloutDecisionInput { cohortPercent: number; stableDeviceKey: string; rolloutId: string; failurePercent: number; maxFailurePercent: number; healthySample: number; minHealthySample: number; currentlyPaused: boolean; }
export type RolloutDecision = { action: 'HOLD'; reason: string } | { action: 'PAUSE'; reason: string } | { action: 'CONTINUE'; reason: string };
