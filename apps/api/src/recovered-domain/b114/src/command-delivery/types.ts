export type OutboxStatus = "PENDING" | "CLAIMED" | "PUBLISHED" | "RETRY_WAIT" | "COMPLETED" | "DEAD_LETTER" | "CANCELLED";
export interface OutboxRecord { id: string; tenantId: string; commandId: string; eventType: string; status: OutboxStatus; attemptCount: number; availableAt: Date; claimUntil?: Date; expiresAt: Date; }
export interface DeliveryPolicy { maxAttempts: number; baseDelayMs: number; maxDelayMs: number; jitterRatio: number; claimLeaseMs: number; }
export interface DeliveryTransport { publish(input: { tenantId: string; deviceId: string; commandId: string; eventType: string; payload: Record<string, unknown>; expiresAt: Date }): Promise<{ receipt?: string }>; }
export interface DeliveryRepository {
  claimDueOutbox(workerId: string, now: Date, leaseUntil: Date, limit: number): Promise<OutboxRecord[]>;
  loadAuthorizedCommand(tenantId: string, commandId: string): Promise<{ deviceId: string; payload: Record<string, unknown>; expiresAt: Date; status: string } | null>;
  recordAttempt(input: { tenantId: string; commandId: string; attemptNumber: number; outcome: string; errorCode?: string; errorSummary?: string; receipt?: string }): Promise<void>;
  markPublished(outboxId: string, receipt?: string): Promise<void>;
  scheduleRetry(outboxId: string, availableAt: Date, code: string, summary?: string): Promise<void>;
  deadLetter(outboxId: string, code: string, summary?: string): Promise<void>;
  markExpired(outboxId: string): Promise<void>;
}
