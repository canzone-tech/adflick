import { createHash, timingSafeEqual } from 'node:crypto';

export interface ProviderCallbackEnvelope {
  eventId: string;
  eventType: string;
  occurredAt: string;
  accountId: string;
  payoutReference: string;
  providerReference: string;
}

/** Reject stale/future callbacks before processing. Signature must be verified separately on raw bytes. */
export function validateCallbackEnvelope(
  envelope: ProviderCallbackEnvelope,
  options: { nowMs?: number; maxAgeMs?: number; allowedAccountIds: string[] },
): { ok: true; eventDigest: string } | { ok: false; reason: string } {
  const now = options.nowMs ?? Date.now();
  const maxAge = options.maxAgeMs ?? 5 * 60_000;
  if (!envelope || typeof envelope !== 'object') return { ok: false, reason: 'INVALID_ENVELOPE' };
  for (const key of ['eventId','eventType','occurredAt','accountId','payoutReference','providerReference'] as const) {
    if (typeof envelope[key] !== 'string' || !envelope[key].trim() || envelope[key].length > 200) {
      return { ok: false, reason: `INVALID_${key.toUpperCase()}` };
    }
  }
  const occurred = Date.parse(envelope.occurredAt);
  if (!Number.isFinite(occurred)) return { ok: false, reason: 'INVALID_TIMESTAMP' };
  if (occurred > now + 30_000) return { ok: false, reason: 'TIMESTAMP_IN_FUTURE' };
  if (now - occurred > maxAge) return { ok: false, reason: 'CALLBACK_STALE' };
  if (!options.allowedAccountIds.includes(envelope.accountId)) return { ok: false, reason: 'ACCOUNT_NOT_ALLOWED' };
  const eventDigest = createHash('sha256')
    .update([envelope.accountId, envelope.eventId, envelope.eventType, envelope.payoutReference, envelope.providerReference].join('\u0000'))
    .digest('hex');
  return { ok: true, eventDigest };
}

/** Compares opaque digests safely. Rejects differing lengths before timingSafeEqual. */
export function safeDigestEqual(expectedHex: string, suppliedHex: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHex) || !/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
  const a = Buffer.from(expectedHex, 'hex');
  const b = Buffer.from(suppliedHex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
