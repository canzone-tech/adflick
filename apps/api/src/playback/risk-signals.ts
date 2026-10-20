export type RiskSignal = {
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  evidence: Record<string, string | number | boolean>;
};

// Heuristic signals are triage aids, not conclusive fraud findings.
// Device fingerprinting must be privacy-reviewed and proportionate.
export function detectRiskSignals(input: {
  duplicatePayloadConflict: boolean;
  sequenceGapCount: number;
  eventsInLastMinute: number;
  expectedEventsPerMinute: number;
  clockDriftMs: number;
  distinctOwnersUsingDevice: number;
  revokedCredential: boolean;
}): RiskSignal[] {
  const signals: RiskSignal[] = [];
  if (input.revokedCredential) signals.push({
    code: 'REVOKED_DEVICE_CREDENTIAL',
    severity: 'CRITICAL', score: 100, evidence: { revokedCredential: true },
  });
  if (input.duplicatePayloadConflict) signals.push({
    code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
    severity: 'HIGH', score: 70, evidence: { conflict: true },
  });
  if (input.expectedEventsPerMinute > 0 &&
      input.eventsInLastMinute > input.expectedEventsPerMinute * 3) {
    signals.push({
      code: 'PLAYBACK_RATE_SPIKE',
      severity: 'MEDIUM', score: 35,
      evidence: {
        observed: input.eventsInLastMinute,
        expected: input.expectedEventsPerMinute,
      },
    });
  }
  if (input.sequenceGapCount > 20) signals.push({
    code: 'SEQUENCE_GAP_SPIKE',
    severity: 'LOW', score: 15, evidence: { gaps: input.sequenceGapCount },
  });
  if (Math.abs(input.clockDriftMs) > 5 * 60_000) signals.push({
    code: 'LARGE_CLOCK_DRIFT',
    severity: 'MEDIUM', score: 30, evidence: { driftMs: input.clockDriftMs },
  });
  if (input.distinctOwnersUsingDevice > 1) signals.push({
    code: 'DEVICE_OWNER_ASSOCIATION_CONFLICT',
    severity: 'HIGH', score: 60,
    evidence: { distinctOwners: input.distinctOwnersUsingDevice },
  });
  return signals;
}
