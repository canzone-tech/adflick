import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

export interface ProviderStatementRow {
  providerReference: string;
  payoutReference: string;
  amountPaise: number;
  currency: string;
  status: 'PAID' | 'FAILED' | 'PENDING';
  occurredAt?: string;
}

/** Verify provider webhooks against the exact raw request body. Never parse and re-stringify first. */
export function verifyHmacSha256(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !secret || rawBody.length === 0) return false;
  const supplied = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const actual = Buffer.from(supplied, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function payloadSha256(rawBody: Buffer): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

/** Small strict CSV parser supporting quoted fields and escaped double quotes. Rejects malformed rows. */
export function parseReconciliationCsv(csv: string): ProviderStatementRow[] {
  if (csv.length > 10_000_000) throw new Error('Statement exceeds 10 MB limit');
  const records: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') {
      if (field.length) throw new Error('Malformed CSV quoting');
      quoted = true;
    } else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v.trim() !== '')) records.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error('Unterminated quoted CSV field');
  if (field.length || row.length) { row.push(field); records.push(row); }
  if (records.length < 2) throw new Error('Statement must include header and at least one row');
  const headers = records.shift()!.map(v => v.trim());
  const required = ['providerReference', 'payoutReference', 'amountPaise', 'currency', 'status'];
  for (const name of required) if (!headers.includes(name)) throw new Error(`Missing CSV column: ${name}`);
  const seen = new Set<string>();
  return records.map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`Column count mismatch on CSV row ${index + 2}`);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cells[i].trim(); });
    const providerReference = obj.providerReference;
    const payoutReference = obj.payoutReference;
    const amountPaise = Number(obj.amountPaise);
    const currency = obj.currency.toUpperCase();
    const status = obj.status.toUpperCase();
    if (!providerReference || providerReference.length > 160) throw new Error(`Invalid provider reference on row ${index + 2}`);
    if (!payoutReference || payoutReference.length > 160) throw new Error(`Invalid payout reference on row ${index + 2}`);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new Error(`Invalid amountPaise on row ${index + 2}`);
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`Invalid currency on row ${index + 2}`);
    if (!['PAID', 'FAILED', 'PENDING'].includes(status)) throw new Error(`Invalid status on row ${index + 2}`);
    const key = `${providerReference}\u0000${payoutReference}`;
    if (seen.has(key)) throw new Error(`Duplicate statement row on CSV row ${index + 2}`);
    seen.add(key);
    return { providerReference, payoutReference, amountPaise, currency, status: status as ProviderStatementRow['status'], ...(obj.occurredAt ? { occurredAt: obj.occurredAt } : {}) };
  });
}

/** Provider adapter boundary. Implementations must use provider idempotency keys and never log secrets. */
export interface PayoutProviderAdapter {
  readonly providerName: string;
  createPayout(input: { payoutReference: string; amountPaise: number; currency: 'INR'; beneficiaryToken: string; idempotencyKey: string }): Promise<{ providerReference: string; status: 'ACCEPTED' | 'PENDING' }>;
  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean;
}
