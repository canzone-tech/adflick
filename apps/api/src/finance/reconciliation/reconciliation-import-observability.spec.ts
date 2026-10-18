import { buildReconciliationOperationalEvent, classifyReconciliationFailure } from './reconciliation-import-observability';

describe('reconciliation import observability', () => {
  it('classifies malformed statement errors into stable codes', () => {
    expect(classifyReconciliationFailure(new Error('Invalid amountPaise on CSV row 3'))).toBe('STATEMENT_INVALID');
  });

  it('classifies lost claims and database availability errors', () => {
    expect(classifyReconciliationFailure(new Error('RECONCILIATION_IMPORT_CLAIM_LOST'))).toBe('CLAIM_LOST');
    expect(classifyReconciliationFailure(new Error('connect ECONNREFUSED mysql'))).toBe('DATABASE_UNAVAILABLE');
  });

  it('does not emit exception messages or arbitrary fields', () => {
    const event = buildReconciliationOperationalEvent({
      event: 'reconciliation_import_failed', importId: 'imp-1', organizationId: 'org-1', durationMs: -5,
      failureCode: 'STATEMENT_INVALID',
    } as any);
    expect(event.durationMs).toBe(0);
    expect(JSON.stringify(event)).not.toContain('rawPayload');
    expect(Object.keys(event).sort()).toEqual(['durationMs', 'event', 'failureCode', 'importId', 'organizationId'].sort());
  });
});
