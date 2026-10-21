import type { AlertSeverity, SlaAlert } from "./fleet-ops.types";

export interface AlertFilters {
  tenantId: string;
  severity?: AlertSeverity | "ALL";
  status?: SlaAlert["status"] | "ALL";
  search?: string;
}

/** Pure in-memory policy helper. Production inbox still requires server-side tenant scope and pagination. */
export function filterAlertInbox(alerts: SlaAlert[], filters: AlertFilters): SlaAlert[] {
  const query = filters.search?.trim().toLowerCase() ?? "";
  const severityRank: Record<AlertSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  return alerts.filter((alert) => {
    if (alert.tenantId !== filters.tenantId) return false;
    if (filters.severity && filters.severity !== "ALL" && alert.severity !== filters.severity) return false;
    if (filters.status && filters.status !== "ALL" && alert.status !== filters.status) return false;
    if (query && !`${alert.id} ${alert.metricName}`.toLowerCase().includes(query)) return false;
    return true;
  }).sort((a, b) => severityRank[a.severity] - severityRank[b.severity]
    || Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt)
    || a.id.localeCompare(b.id));
}
