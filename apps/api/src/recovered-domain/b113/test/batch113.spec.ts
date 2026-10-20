import { assertTransition, canTransition, cohortNumber, decideRollout, validateCommandRequest } from '../src/device-fleet/commands';
import { nextCohortPercent, validateRolloutPolicy } from '../src/device-fleet/rollouts';

describe('Batch 113 command lifecycle', () => {
  it('allows dispatched -> acknowledged -> succeeded', () => {
    expect(canTransition('DISPATCHED', 'ACKNOWLEDGED')).toBe(true);
    expect(canTransition('ACKNOWLEDGED', 'SUCCEEDED')).toBe(true);
  });
  it('rejects terminal transitions', () => {
    expect(() => assertTransition('SUCCEEDED', 'DISPATCHED')).toThrow();
  });
  it('rejects arbitrary command-like payload fields', () => {
    const request = { tenantId: 't1', deviceId: 'd1', type: 'RESTART_PLAYER' as const, payload: { shell: 'rm -rf /' }, idempotencyKey: 'k1', requestedById: 'u1', expiresAt: new Date(Date.now() + 60_000), correlationId: 'c1' };
    expect(() => validateCommandRequest(request)).toThrow();
  });
  it('rejects expired commands', () => {
    const request = { tenantId: 't1', deviceId: 'd1', type: 'REFRESH_PLAYLIST' as const, payload: {}, idempotencyKey: 'k2', requestedById: 'u1', expiresAt: new Date(Date.now() - 1000), correlationId: 'c2' };
    expect(() => validateCommandRequest(request)).toThrow('INVALID_EXPIRY');
  });
  it('assigns a device to a stable deterministic cohort', () => {
    expect(cohortNumber('r1', 'device-key')).toBe(cohortNumber('r1', 'device-key'));
  });
  it('holds when health sample is too small and pauses at failure threshold', () => {
    const base = { cohortPercent: 100, stableDeviceKey: 'd1', rolloutId: 'r1', maxFailurePercent: 10, healthySample: 2, minHealthySample: 10, currentlyPaused: false };
    expect(decideRollout({ ...base, failurePercent: 0 }).action).toBe('HOLD');
    expect(decideRollout({ ...base, healthySample: 20, failurePercent: 10 }).action).toBe('PAUSE');
  });
  it('caps cohort expansion and validates bounds', () => {
    expect(nextCohortPercent(95, 10)).toBe(100);
    expect(() => validateRolloutPolicy({ cohortPercent: 0, maxFailurePercent: 10, minHealthySample: 1 })).toThrow();
  });
});
