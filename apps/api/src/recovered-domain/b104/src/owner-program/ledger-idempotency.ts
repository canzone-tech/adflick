export function accrualIdempotencyKey(input: {
  organizationId: string;
  ownerId: string;
  deviceId: string;
  targetPeriodId: string;
  policyVersion: number;
}): string {
  return [
    'owner-target-accrual', input.organizationId, input.ownerId, input.deviceId,
    input.targetPeriodId, `policy-v${input.policyVersion}`,
  ].join(':');
}
