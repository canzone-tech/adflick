import { RecoveryDecision, RecoveryTask } from './types';

export interface RecoveryPolicy { baseDelaySeconds: number; maxDelaySeconds: number; maxAttempts: number; }

export function evaluateRecoveryRetry(task: RecoveryTask, policy: RecoveryPolicy, now: Date): RecoveryDecision {
  if (!Number.isInteger(task.attemptCount) || task.attemptCount < 0 || !Number.isInteger(task.maxAttempts) || task.maxAttempts < 1) throw new Error('Recovery attempt counters are invalid');
  if (!Number.isInteger(policy.baseDelaySeconds) || policy.baseDelaySeconds < 1 || !Number.isInteger(policy.maxDelaySeconds) || policy.maxDelaySeconds < policy.baseDelaySeconds || !Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) throw new Error('Recovery retry policy is invalid');
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid current time');
  const limit = Math.min(task.maxAttempts, policy.maxAttempts);
  if (task.attemptCount >= limit) return { retry: false, terminalReason: 'MAX_ATTEMPTS_REACHED' };
  const exponent = Math.min(task.attemptCount, 30);
  const delay = Math.min(policy.maxDelaySeconds, policy.baseDelaySeconds * (2 ** exponent));
  return { retry: true, nextAttemptAt: new Date(now.getTime() + delay * 1000) };
}
