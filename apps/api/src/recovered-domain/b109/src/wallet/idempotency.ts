import { createHash } from 'node:crypto';

export function walletIdempotencyKey(tenantId: string, operation: string, sourceId: string): string {
  if (!tenantId.trim() || !operation.trim() || !sourceId.trim()) throw new Error('Tenant, operation, and source ID are required');
  const digest = createHash('sha256').update([tenantId, operation, sourceId].join('|')).digest('hex');
  return `${operation}:${digest}`;
}
