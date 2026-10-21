import type { DeliveryPolicy } from "./types";

export function validateDeliveryPolicy(policy: DeliveryPolicy): void {
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1 || policy.maxAttempts > 20) throw new Error("INVALID_MAX_ATTEMPTS");
  if (!Number.isFinite(policy.baseDelayMs) || policy.baseDelayMs < 100) throw new Error("INVALID_BASE_DELAY");
  if (!Number.isFinite(policy.maxDelayMs) || policy.maxDelayMs < policy.baseDelayMs) throw new Error("INVALID_MAX_DELAY");
  if (!Number.isFinite(policy.jitterRatio) || policy.jitterRatio < 0 || policy.jitterRatio > 1) throw new Error("INVALID_JITTER_RATIO");
  if (!Number.isFinite(policy.claimLeaseMs) || policy.claimLeaseMs < 1000) throw new Error("INVALID_CLAIM_LEASE");
}

export function retryDelayMs(attemptNumber: number, policy: DeliveryPolicy, randomValue = Math.random()): number {
  validateDeliveryPolicy(policy);
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) throw new Error("INVALID_ATTEMPT_NUMBER");
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue > 1) throw new Error("INVALID_RANDOM_VALUE");
  const exponent = Math.min(attemptNumber - 1, 30);
  const raw = Math.min(policy.maxDelayMs, policy.baseDelayMs * (2 ** exponent));
  const factor = 1 - policy.jitterRatio + (2 * policy.jitterRatio * randomValue);
  return Math.max(0, Math.floor(Math.min(policy.maxDelayMs, raw * factor)));
}

export function shouldDeadLetter(attemptCount: number, maxAttempts: number): boolean {
  return attemptCount >= maxAttempts;
}

export function classifyFailure(code: string): "TRANSIENT" | "PERMANENT" {
  const permanent = new Set(["DEVICE_REVOKED", "TENANT_SCOPE_MISMATCH", "UNSUPPORTED_COMMAND", "INVALID_SIGNATURE"]);
  return permanent.has(code) ? "PERMANENT" : "TRANSIENT";
}
