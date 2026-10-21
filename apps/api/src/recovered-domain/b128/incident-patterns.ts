import type { IncidentFact, PatternSummary } from "./incident-review.types";

/**
 * Groups explicitly recorded incident taxonomy only. Results are review candidates,
 * never causal conclusions. Tenant and time-window filtering happen here so callers
 * cannot accidentally aggregate mixed tenants or unbounded historical data.
 */
export function groupIncidentPatterns(
  incidents: IncidentFact[],
  input: {
    tenantId: string;
    from: Date;
    to: Date;
    categoryOf: (incident: IncidentFact) => string;
  },
): PatternSummary[] {
  if (!input.tenantId.trim()) throw new Error("TENANT_REQUIRED");
  if (!Number.isFinite(input.from.getTime()) || !Number.isFinite(input.to.getTime()) || input.from >= input.to) {
    throw new Error("INVALID_TIME_WINDOW");
  }

  const groups = new Map<string, {
    category: string; ids: Set<string>; devices: Set<string>; times: number[];
  }>();
  for (const incident of incidents) {
    if (incident.tenantId !== input.tenantId) continue;
    const time = Date.parse(incident.createdAt);
    if (!Number.isFinite(time) || time < input.from.getTime() || time >= input.to.getTime()) continue;

    const category = input.categoryOf(incident).trim() || "UNCLASSIFIED";
    const cause = incident.rootCauseCode?.trim() || "UNCONFIRMED";
    const patternKey = `${category}:${cause}`;
    const group = groups.get(patternKey) ?? {
      category, ids: new Set<string>(), devices: new Set<string>(), times: [],
    };
    group.ids.add(incident.incidentId);
    for (const deviceId of incident.affectedDeviceIds ?? []) {
      if (deviceId.trim()) group.devices.add(deviceId);
    }
    group.times.push(time);
    groups.set(patternKey, group);
  }

  return [...groups.entries()].map(([patternKey, group]) => ({
    patternKey,
    category: group.category,
    incidentCount: group.ids.size,
    affectedDevices: group.devices.size,
    firstObservedAt: new Date(Math.min(...group.times)).toISOString(),
    lastObservedAt: new Date(Math.max(...group.times)).toISOString(),
    requiresHumanReview: true as const,
  })).sort((a, b) => b.incidentCount - a.incidentCount || a.patternKey.localeCompare(b.patternKey));
}
