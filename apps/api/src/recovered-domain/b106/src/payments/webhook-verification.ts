import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

export type WebhookVerification = { valid: boolean; reasonCode?: string };

/** Generic HMAC-SHA256 example only; use only when the selected provider documents this exact scheme. */
export function verifyHmacSha256Webhook(input: {
  rawBody: Buffer; signatureHex?: string; timestampSeconds?: string;
  secret: string; nowSeconds?: number; toleranceSeconds?: number;
}): WebhookVerification {
  if (!input.signatureHex || !input.timestampSeconds || !input.secret) return { valid: false, reasonCode: 'MISSING_HEADER' };
  if (!/^\d+$/.test(input.timestampSeconds)) return { valid: false, reasonCode: 'TIMESTAMP_INVALID' };
  const ts = Number(input.timestampSeconds), now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(ts) || Math.abs(now - ts) > (input.toleranceSeconds ?? 300)) return { valid: false, reasonCode: 'TIMESTAMP_OUT_OF_RANGE' };
  const signed = Buffer.concat([Buffer.from(`${input.timestampSeconds}.`, 'utf8'), input.rawBody]);
  const expected = createHmac('sha256', input.secret).update(signed).digest();
  if (!/^[a-fA-F0-9]{64}$/.test(input.signatureHex)) return { valid: false, reasonCode: 'SIGNATURE_INVALID' };
  const provided = Buffer.from(input.signatureHex, 'hex');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return { valid: false, reasonCode: 'SIGNATURE_INVALID' };
  return { valid: true };
}

export function payloadFingerprint(rawBody: Buffer): string {
  return createHash('sha256').update(rawBody).digest('hex');
}
