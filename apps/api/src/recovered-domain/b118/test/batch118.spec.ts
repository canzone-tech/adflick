import { redactText, sanitizeDiagnostic } from '../src/player-diagnostics/sanitize';
import { assertBundleTransition, validateBundleRequest } from '../src/player-diagnostics/bundle-policy';

describe('Batch 118 diagnostic sanitation', () => {
  it('redacts bearer credentials in message text', () => {
    expect(redactText('request failed: Bearer abc.def.ghi')).toContain('Bearer [REDACTED]');
  });
  it('redacts sensitive metadata keys', () => {
    const result = sanitizeDiagnostic({ tenantId: 't', deviceId: 'd', eventId: 'e1', eventType: 'player.crash', severity: 'FATAL', metadata: { token: 'abc', screen: 'lobby-tv' } });
    expect(result.metadata?.token).toBe('[REDACTED]');
    expect(result.metadata?.screen).toBe('lobby-tv');
  });
  it('rejects missing event identity', () => {
    expect(() => sanitizeDiagnostic({ tenantId: 't', deviceId: 'd', eventId: '', eventType: 'error', severity: 'ERROR' })).toThrow();
  });
});

describe('Batch 118 bundle policy', () => {
  const request = { tenantId: 't', deviceId: 'd', requestedById: 'u', reason: 'Investigate player crash', requestedAt: new Date('2026-10-15T08:00:00Z'), expiresAt: new Date('2026-10-15T08:30:00Z'), correlationId: 'corr-1' };
  it('accepts a bounded request', () => {
    expect(() => validateBundleRequest(request, { maxTtlSeconds: 3600, maxConcurrentPerDevice: 2, maxBytes: 10_000_000 }, 0)).not.toThrow();
  });
  it('rejects invalid lifecycle transition', () => {
    expect(() => assertBundleTransition('REQUESTED', 'UPLOADED')).toThrow();
  });
});
