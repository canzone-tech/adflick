/** Stable operational codes only. Never persist raw exception messages or CSV/provider data. */
export type ReconciliationFailureCode =
  | 'STATEMENT_INVALID'
  | 'CLAIM_LOST'
  | 'DATABASE_UNAVAILABLE'
  | 'STATEMENT_PROCESSING_FAILED';

export function classifyReconciliationFailure(error: unknown): ReconciliationFailureCode {
  const message = error instanceof Error ? error.message : '';
  if (/Malformed CSV|Unterminated quoted CSV|Missing CSV column|Column count mismatch|Invalid provider reference|Invalid payout reference|Invalid amountPaise|Invalid currency|Invalid status|Duplicate statement row|Statement must include header/i.test(message)) {
    return 'STATEMENT_INVALID';
  }
  if (/RECONCILIATION_IMPORT_CLAIM_LOST/.test(message)) return 'CLAIM_LOST';
  if (/P1001|P1002|P1008|P1017|ECONNREFUSED|ETIMEDOUT|connection.*closed/i.test(message)) return 'DATABASE_UNAVAILABLE';
  return 'STATEMENT_PROCESSING_FAILED';
}

export interface ReconciliationOperationalEvent {
  event: 'reconciliation_import_completed' | 'reconciliation_import_failed';
  importId: string;
  organizationId: string;
  durationMs: number;
  rowCount?: number;
  matchedCount?: number;
  discrepancyCount?: number;
  failureCode?: ReconciliationFailureCode;
}

/** Allow-listed event fields prevent raw payloads, provider references and exception messages entering logs. */
export function buildReconciliationOperationalEvent(input: ReconciliationOperationalEvent): ReconciliationOperationalEvent {
  return {
    event: input.event,
    importId: input.importId,
    organizationId: input.organizationId,
    durationMs: Math.max(0, Math.floor(input.durationMs)),
    ...(input.rowCount === undefined ? {} : { rowCount: Math.max(0, Math.floor(input.rowCount)) }),
    ...(input.matchedCount === undefined ? {} : { matchedCount: Math.max(0, Math.floor(input.matchedCount)) }),
    ...(input.discrepancyCount === undefined ? {} : { discrepancyCount: Math.max(0, Math.floor(input.discrepancyCount)) }),
    ...(input.failureCode === undefined ? {} : { failureCode: input.failureCode }),
  };
}
