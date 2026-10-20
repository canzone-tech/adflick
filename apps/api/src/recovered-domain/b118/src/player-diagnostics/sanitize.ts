import type { DiagnosticInput } from './types';

const SECRET_KEY = /(authorization|cookie|password|passwd|secret|token|api[-_]?key|private[-_]?key|wifi|ssid|credential)/i;
const MAX_MESSAGE = 1000; const MAX_METADATA_KEYS = 40; const MAX_DEPTH = 4;
export function redactText(input: string): string {
  return input.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]').replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]').replace(/([?&](?:token|key|password|secret)=)[^&\s]+/gi, '$1[REDACTED]');
}
function cleanValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactText(value.slice(0, 500));
  if (Array.isArray(value)) return value.slice(0, 20).map(v => cleanValue(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>).slice(0, MAX_METADATA_KEYS)) out[key] = SECRET_KEY.test(key) ? '[REDACTED]' : cleanValue(val, depth + 1);
    return out;
  }
  return '[UNSUPPORTED]';
}
export function sanitizeDiagnostic(input: DiagnosticInput): DiagnosticInput {
  if (!input.tenantId || !input.deviceId || !input.eventId || !input.eventType) throw new Error('MISSING_REQUIRED_DIAGNOSTIC_FIELDS');
  if (input.eventId.length > 128 || input.eventType.length > 100) throw new Error('DIAGNOSTIC_FIELD_TOO_LONG');
  const message = input.message ? redactText(input.message).slice(0, MAX_MESSAGE) : undefined;
  const metadata = input.metadata ? cleanValue(input.metadata, 0) as Record<string, unknown> : undefined;
  return { ...input, message, metadata };
}
