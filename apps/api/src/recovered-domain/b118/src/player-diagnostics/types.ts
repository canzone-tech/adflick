export type DiagnosticSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type BundleStatus = 'REQUESTED' | 'QUEUED' | 'COLLECTING' | 'UPLOADED' | 'EXPIRED' | 'FAILED' | 'DELETED';
export interface DiagnosticInput { tenantId: string; deviceId: string; eventId: string; eventType: string; severity: DiagnosticSeverity; errorCode?: string; message?: string; playerVersion?: string; appPlatform?: string; occurredAt?: string; correlationId?: string; metadata?: Record<string, unknown>; }
export interface BundleRequestInput { tenantId: string; deviceId: string; requestedById: string; reason: string; requestedAt: Date; expiresAt: Date; correlationId: string; }
export interface BundleMetadata { objectKey: string; sha256: string; byteSize: number; uploadedAt: Date; }
