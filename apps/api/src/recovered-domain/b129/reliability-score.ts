import type { ReliabilityInputs, ReliabilityResult, RiskBand } from "./types";

const metrics: Array<{ key: keyof Omit<ReliabilityInputs, "sampleCount">; weight: number; invert?: boolean }> = [
  { key: "heartbeatCoverage", weight: 0.25 },
  { key: "commandSuccessRate", weight: 0.30 },
  { key: "playbackErrorRate", weight: 0.25, invert: true },
  { key: "updateFailureRate", weight: 0.20, invert: true },
];

/** Operational heuristic only. Thresholds/weights require operations approval before product use. */
export function calculateReliability(inputs: ReliabilityInputs): ReliabilityResult {
  const warnings: string[] = [];
  if (!Number.isInteger(inputs.sampleCount) || inputs.sampleCount < 0) {
    throw new Error("INVALID_SAMPLE_COUNT");
  }
  if (inputs.sampleCount < 10) {
    warnings.push("LOW_SAMPLE_SIZE");
    return { score: null, riskBand: "UNKNOWN", dataCoverage: 0, sampleCount: inputs.sampleCount, warnings };
  }

  let weighted = 0;
  let availableWeight = 0;
  for (const metric of metrics) {
    const raw = inputs[metric.key];
    if (raw === undefined || !Number.isFinite(raw) || raw < 0 || raw > 1) {
      warnings.push(`MISSING_OR_INVALID:${metric.key}`);
      continue;
    }
    weighted += (metric.invert ? 1 - raw : raw) * metric.weight;
    availableWeight += metric.weight;
  }
  const dataCoverage = availableWeight / metrics.reduce((sum, metric) => sum + metric.weight, 0);
  if (availableWeight === 0) {
    return { score: null, riskBand: "UNKNOWN", dataCoverage, sampleCount: inputs.sampleCount, warnings };
  }
  const score = Math.round((weighted / availableWeight) * 100);
  const riskBand: RiskBand = score >= 90 ? "LOW" : score >= 75 ? "GUARDED" : score >= 50 ? "HIGH" : "CRITICAL";
  return { score, riskBand, dataCoverage, sampleCount: inputs.sampleCount, warnings };
}
