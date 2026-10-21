import type { AlertRule, MetricObservation } from "./types";

export interface AlertEvaluation { shouldAlert: boolean; reason: string; severity?: AlertRule["severity"]; dedupeKey?: string; }

export function evaluateRule(rule: AlertRule, observation: MetricObservation): AlertEvaluation {
  if (!rule.active) return { shouldAlert: false, reason: "RULE_INACTIVE" };
  if (rule.tenantId !== observation.tenantId || rule.metric !== observation.metric) return { shouldAlert: false, reason: "SCOPE_MISMATCH" };
  if (!Number.isFinite(observation.value) || !Number.isFinite(rule.threshold)) return { shouldAlert: false, reason: "INVALID_VALUE" };
  if (!Number.isInteger(rule.minimumSamples) || rule.minimumSamples < 1 || observation.sampleCount < rule.minimumSamples) return { shouldAlert: false, reason: "INSUFFICIENT_SAMPLES" };
  if (!Number.isFinite(observation.coverage) || observation.coverage < 0 || observation.coverage > 1) return { shouldAlert: false, reason: "INVALID_COVERAGE" };
  if (observation.coverage < 0.8) return { shouldAlert: false, reason: "INSUFFICIENT_COVERAGE" };
  const matched = rule.comparator === "GT" ? observation.value > rule.threshold
    : rule.comparator === "GTE" ? observation.value >= rule.threshold
    : rule.comparator === "LT" ? observation.value < rule.threshold
    : observation.value <= rule.threshold;
  if (!matched) return { shouldAlert: false, reason: "THRESHOLD_NOT_MET" };
  return { shouldAlert: true, reason: "THRESHOLD_MET", severity: rule.severity,
    dedupeKey: `${rule.id}:${observation.deviceId}:${observation.metric}` };
}
