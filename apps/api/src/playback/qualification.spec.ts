import { qualifyPlayback } from './qualification.types';
import { detectRiskSignals } from './risk-signals';

const base = {
  eventId: 'evt-1', organizationId: 'org-1', deviceId: 'dev-1', campaignId: 'camp-1',
  campaignApproved: true, deviceEnabled: true, deviceAssignedToCampaign: true,
  manifestPublished: true, scheduleSlotValid: true,
  eventStartMs: 1_000_000, eventEndMs: 1_030_000, receivedAtMs: 1_031_000,
  expectedDurationMs: 30_000, observedDurationMs: 30_000, clockDriftMs: 0,
  policy: {
    minimumCompletionPercent: 90, minimumDurationMs: 25_000, maxClockDriftMs: 120_000,
    maxEventAgeHours: 72, allowedOfflineGraceHours: 24, requireApprovedCampaign: true,
    requirePublishedManifest: true, requireValidScheduleSlot: true,
  },
};

describe('Batch 103 playback qualification', () => {
  it('qualifies a complete event with valid campaign/device/schedule', () => {
    expect(qualifyPlayback(base).decision).toBe('QUALIFIED');
  });

  it('rejects events for a disabled device', () => {
    expect(qualifyPlayback({ ...base, deviceEnabled: false }).reasonCodes)
      .toContain('DEVICE_NOT_ELIGIBLE');
  });

  it('rejects unapproved campaigns', () => {
    expect(qualifyPlayback({ ...base, campaignApproved: false }).decision).toBe('REJECTED');
  });

  it('rejects playback below configured completion threshold', () => {
    expect(qualifyPlayback({ ...base, observedDurationMs: 10_000 }).reasonCodes)
      .toContain('COMPLETION_BELOW_THRESHOLD');
  });

  it('flags anomalous timing for review', () => {
    expect(qualifyPlayback({ ...base, clockDriftMs: 999_999 }).decision).toBe('UNDER_REVIEW');
  });

  it('detects high-risk credential revocation', () => {
    expect(detectRiskSignals({
      duplicatePayloadConflict: false, sequenceGapCount: 0, eventsInLastMinute: 1,
      expectedEventsPerMinute: 10, clockDriftMs: 0, distinctOwnersUsingDevice: 1,
      revokedCredential: true,
    })[0].code).toBe('REVOKED_DEVICE_CREDENTIAL');
  });
});
