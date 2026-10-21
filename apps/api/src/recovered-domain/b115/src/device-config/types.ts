export type ProfileStatus = "DRAFT" | "APPROVED" | "RETIRED";
export type DriftStatus = "IN_SYNC" | "DRIFTED" | "UNKNOWN" | "INCOMPATIBLE" | "RECONCILIATION_PENDING" | "RECONCILIATION_FAILED";
export interface ConfigProfile { tenantId: string; profileKey: string; version: number; status: ProfileStatus; schemaVersion: string; payload: Record<string, unknown>; canonicalHash: string; minPlayerVersion?: string; maxPlayerVersion?: string; }
export interface ConfigReport { tenantId: string; deviceId: string; desiredRevision: number; schemaVersion: string; playerVersion: string; reportedPayload: Record<string, unknown>; reportedHash: string; receivedAt: Date; }
export interface ConfigComparison { status: DriftStatus; desiredHash?: string; reportedHash?: string; reason: string; }
export interface ReconciliationPlan { tenantId: string; deviceId: string; desiredRevision: number; desiredProfileId: string; desiredVersion: number; expectedHash: string; idempotencyKey: string; action: "SYNC_CONFIGURATION" | "NO_ACTION" | "BLOCK"; reason: string; }
