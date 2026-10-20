import { decideRollout } from './commands';
import type { RolloutDecision, RolloutDecisionInput } from './types';
export interface RolloutPolicy { cohortPercent: number; maxFailurePercent: number; minHealthySample: number; }
export function nextCohortPercent(current: number, increment = 10): number {
  if (!Number.isInteger(current) || !Number.isInteger(increment) || current < 1 || current > 100 || increment < 1) throw new Error('INVALID_COHORT_CONFIGURATION');
  return Math.min(100, current + increment);
}
export function evaluateRollout(input: Omit<RolloutDecisionInput, 'cohortPercent' | 'maxFailurePercent' | 'minHealthySample'>, policy: RolloutPolicy): RolloutDecision {
  return decideRollout({ ...input, cohortPercent: policy.cohortPercent, maxFailurePercent: policy.maxFailurePercent, minHealthySample: policy.minHealthySample });
}
export function validateRolloutPolicy(policy: RolloutPolicy): void {
  if (!Number.isInteger(policy.cohortPercent) || policy.cohortPercent < 1 || policy.cohortPercent > 100) throw new Error('INVALID_COHORT_PERCENT');
  if (!Number.isInteger(policy.maxFailurePercent) || policy.maxFailurePercent < 0 || policy.maxFailurePercent > 100) throw new Error('INVALID_MAX_FAILURE_PERCENT');
  if (!Number.isInteger(policy.minHealthySample) || policy.minHealthySample < 1) throw new Error('INVALID_MIN_HEALTHY_SAMPLE');
}
