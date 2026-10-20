export type HealthState = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';
export type Severity = 'INFO' | 'WARNING' | 'MAJOR' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'SUPPRESSED';
export interface HealthObservation { tenantId: string; deviceId: string; serverReceivedAt: Date; reportedAt?: Date; heartbeatSequence?: number; playerVersion?: string; consecutiveMisses: number; recentErrorCount: number; commandFailureCount: number; lastPlaybackErrorAt?: Date; }
export interface HealthThresholds { offlineAfterSeconds: number; degradedErrorCount: number; degradedCommandFailures: number; maxReportedClockSkewSeconds: number; }
export interface FleetHealthSummary { total: number; healthy: number; degraded: number; offline: number; unknown: number; lastCalculatedAt: Date; }
export interface IncidentTransition { incidentId: string; tenantId: string; actorId?: string; from: IncidentStatus; to: IncidentStatus; note?: string; }
