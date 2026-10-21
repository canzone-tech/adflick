export interface MetricPoint { windowStart: string; value?: number; sampleCount: number }

export function compareTrend(current: MetricPoint, previous: MetricPoint) {
  if (!Number.isInteger(current.sampleCount) || !Number.isInteger(previous.sampleCount)
      || current.sampleCount < 10 || previous.sampleCount < 10
      || current.value === undefined || previous.value === undefined
      || !Number.isFinite(current.value) || !Number.isFinite(previous.value)) {
    return { comparable: false as const, delta: null, percentChange: null, reasonCode: "INSUFFICIENT_DATA" };
  }
  const delta = current.value - previous.value;
  const percentChange = previous.value === 0 ? null : (delta / Math.abs(previous.value)) * 100;
  return { comparable: true as const, delta, percentChange, reasonCode: undefined };
}
