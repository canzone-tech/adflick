import type { DashboardSnapshot, MaintenanceAlertRow, MaintenancePlanRow } from "./types";

export interface DashboardFilters {
  search: string;
  planStatus: string;
  alertSeverity: string;
  alertStatus: string;
}

export function filterPlans(plans: MaintenancePlanRow[], filters: DashboardFilters): MaintenancePlanRow[] {
  const query = filters.search.trim().toLowerCase();
  return plans.filter((plan) =>
    (!query || plan.name.toLowerCase().includes(query) || plan.id.toLowerCase().includes(query))
    && (!filters.planStatus || plan.status === filters.planStatus),
  );
}

export function filterAlerts(alerts: MaintenanceAlertRow[], filters: DashboardFilters): MaintenanceAlertRow[] {
  const query = filters.search.trim().toLowerCase();
  return alerts.filter((alert) =>
    (!query || alert.title.toLowerCase().includes(query) || alert.deviceLabel.toLowerCase().includes(query))
    && (!filters.alertSeverity || alert.severity === filters.alertSeverity)
    && (!filters.alertStatus || alert.status === filters.alertStatus),
  );
}

export function summarizeDashboard(snapshot: DashboardSnapshot) {
  const boundedCoverage = Math.max(0, Math.min(1, snapshot.coverage));
  return {
    activePlans: snapshot.plans.filter((plan) => plan.status === "ACTIVE").length,
    dueSoon: snapshot.plans.filter((plan) => plan.status === "ACTIVE" && Boolean(plan.nextDueAt)).length,
    openAlerts: snapshot.alerts.filter((alert) => alert.status === "OPEN" || alert.status === "ACKNOWLEDGED").length,
    failedRuns: snapshot.runs.filter((run) => run.status === "FAILED" || run.status === "PARTIAL").length,
    telemetryCoveragePercent: Math.round(boundedCoverage * 100),
  };
}
