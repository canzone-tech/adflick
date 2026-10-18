import { createHash, timingSafeEqual } from 'node:crypto';

export type ImportReservation =
  | { outcome: 'CREATED'; importId: string }
  | { outcome: 'REPLAY'; importId: string; status: string }
  | { outcome: 'PAYLOAD_CONFLICT'; importId: string }
  | { outcome: 'IN_PROGRESS'; importId: string }
  | { outcome: 'RECOVERABLE'; importId: string };

/**
 * Provider-neutral contract for reserving a durable import key.
 * Implementations must use the database unique constraint on
 * (organizationId, providerName, idempotencyKey) as the concurrency arbiter.
 * A duplicate key must be re-read within the same organization and provider.
 */
export interface ReconciliationImportStore {
  create(input: {
    organizationId: string;
    providerName: string;
    idempotencyKey: string;
    payloadSha256: string;
    createdById?: string;
  }): Promise<{ id: string; status: string }>;
  findByKey(input: {
    organizationId: string;
    providerName: string;
    idempotencyKey: string;
  }): Promise<{ id: string; payloadSha256: string; status: string; processingLeaseUntil?: Date | null } | null>;
}

export function sha256Hex(rawPayload: Buffer | string): string {
  return createHash('sha256').update(rawPayload).digest('hex');
}

function equalDigest(a: string, b: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Reserves an import idempotency key without processing the statement.
 * Callers must process rows and transition status in a transaction separately.
 * This helper does not pretend a REPLAY is safe to reapply.
 */
export async function reserveReconciliationImport(
  store: ReconciliationImportStore,
  input: { organizationId: string; providerName: string; idempotencyKey: string; rawPayload: Buffer | string; createdById?: string },
): Promise<ImportReservation> {
  if (!input.organizationId.trim() || !input.providerName.trim() || !input.idempotencyKey.trim()) {
    throw new Error('ORGANIZATION_PROVIDER_AND_IDEMPOTENCY_KEY_REQUIRED');
  }
  if (input.idempotencyKey.length > 180 || input.providerName.length > 100) {
    throw new Error('IDEMPOTENCY_KEY_OR_PROVIDER_NAME_TOO_LONG');
  }
  const payloadSha256 = sha256Hex(input.rawPayload);
  try {
    const created = await store.create({
      organizationId: input.organizationId,
      providerName: input.providerName,
      idempotencyKey: input.idempotencyKey,
      payloadSha256,
      createdById: input.createdById,
    });
    return { outcome: 'CREATED', importId: created.id };
  } catch (error) {
    // Prisma P2002 is the expected unique-key race. Other errors propagate.
    if (!error || typeof error !== 'object' || !('code' in error) || (error as { code?: string }).code !== 'P2002') throw error;
    const existing = await store.findByKey({
      organizationId: input.organizationId,
      providerName: input.providerName,
      idempotencyKey: input.idempotencyKey,
    });
    if (!existing) throw new Error('IDEMPOTENCY_KEY_CONFLICT_RECORD_NOT_FOUND');
    if (!equalDigest(existing.payloadSha256, payloadSha256)) return { outcome: 'PAYLOAD_CONFLICT', importId: existing.id };
    if (existing.status === 'RECEIVED') return { outcome: 'RECOVERABLE', importId: existing.id };
    if (existing.status === 'PROCESSING') {
      if (!existing.processingLeaseUntil || existing.processingLeaseUntil.getTime() <= Date.now()) return { outcome: 'RECOVERABLE', importId: existing.id };
      return { outcome: 'IN_PROGRESS', importId: existing.id };
    }
    return { outcome: 'REPLAY', importId: existing.id, status: existing.status };
  }
}
