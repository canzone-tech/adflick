import { classifyHealth, buildAlertDedupeKey } from '../src/fleet-health/classify';
import { assertIncidentTransition, chooseSeverity } from '../src/fleet-health/incidents';

const thresholds = { offlineAfterSeconds: 180, degradedErrorCount: 3, degradedCommandFailures: 2, maxReportedClockSkewSeconds: 3600 };

describe('Batch 117 health classification', () => {
  it('classifies a fresh clean device as healthy', () => {
    const now = new Date('2026-10-15T08:00:00Z');
    expect(classifyHealth({ tenantId: 't', deviceId: 'd', serverReceivedAt: now, reportedAt: now, consecutiveMisses: 0, recentErrorCount: 0, commandFailureCount: 0 }, thresholds)).toBe('HEALTHY');
  });
  it('classifies old telemetry as offline', () => {
    expect(classifyHealth({ tenantId: 't', deviceId: 'd', serverReceivedAt: new Date('2026-10-15T08:10:00Z'), reportedAt: new Date('2026-10-15T08:00:00Z'), consecutiveMisses: 0, recentErrorCount: 0, commandFailureCount: 0 }, thresholds)).toBe('OFFLINE');
  });
  it('returns unknown for excessive reported clock skew', () => {
    expect(classifyHealth({ tenantId: 't', deviceId: 'd', serverReceivedAt: new Date('2026-10-15T08:00:00Z'), reportedAt: new Date('2026-10-15T00:00:00Z'), consecutiveMisses: 0, recentErrorCount: 0, commandFailureCount: 0 }, thresholds)).toBe('UNKNOWN');
  });
  it('keeps alert dedupe keys tenant/device scoped', () => {
    expect(buildAlertDedupeKey('t', 'd', 'r', 'w')).not.toBe(buildAlertDedupeKey('x', 'd', 'r', 'w'));
  });
});

describe('Batch 117 incident lifecycle', () => {
  it('rejects invalid state transition', () => { expect(() => assertIncidentTransition('OPEN', 'MITIGATED')).toThrow(); });
  it('does not lower incident severity', () => { expect(chooseSeverity('CRITICAL', 'WARNING')).toBe('CRITICAL'); });
});
