import { createHmac } from 'node:crypto';
import { parseReconciliationCsv, verifyHmacSha256, payloadSha256 } from './provider-safety';

describe('provider safety primitives', () => {
  const secret = 'test-secret-only';
  const body = Buffer.from('{"id":"evt_1","status":"paid"}');
  it('accepts a valid HMAC and rejects invalid signatures', () => {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyHmacSha256(body, `sha256=${sig}`, secret)).toBe(true);
    expect(verifyHmacSha256(body, '0'.repeat(64), secret)).toBe(false);
    expect(verifyHmacSha256(body, undefined, secret)).toBe(false);
  });
  it('hashes the exact raw payload deterministically', () => {
    expect(payloadSha256(body)).toHaveLength(64);
    expect(payloadSha256(body)).toBe(payloadSha256(Buffer.from(body)));
  });
  it('parses valid statement rows and quoted commas', () => {
    const rows = parseReconciliationCsv('providerReference,payoutReference,amountPaise,currency,status,occurredAt\n"ref,1",PAY-1,12500,INR,PAID,2026-10-14T10:00:00Z');
    expect(rows[0].providerReference).toBe('ref,1');
    expect(rows[0].amountPaise).toBe(12500);
  });
  it('rejects duplicate, invalid and malformed statement rows', () => {
    expect(() => parseReconciliationCsv('providerReference,payoutReference,amountPaise,currency,status\nr1,p1,10,INR,PAID\nr1,p1,10,INR,PAID')).toThrow(/Duplicate/);
    expect(() => parseReconciliationCsv('providerReference,payoutReference,amountPaise,currency,status\nr1,p1,1.2,INR,PAID')).toThrow(/amountPaise/);
    expect(() => parseReconciliationCsv('providerReference,payoutReference,amountPaise,currency,status\n"r1,p1,10,INR,PAID')).toThrow(/Unterminated/);
  });
});
