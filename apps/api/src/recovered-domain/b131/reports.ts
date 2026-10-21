import type { CostEntry, SlaClock } from "./types";
import { evaluateSla } from "./sla";
import { sumApprovedCosts } from "./costs";

export interface MaintenanceReport {
  workOrderCount: number; responseSlaMet: number; responseSlaBreached: number;
  resolutionSlaMet: number; resolutionSlaBreached: number; approvedCostMinor: string;
  currency: string; dataCoverage: number;
}

export function buildMaintenanceReport(
  clocks: SlaClock[], costs: CostEntry[], nowIso: string, currency: string, expectedCount: number,
): MaintenanceReport {
  const results = clocks.map(c => evaluateSla(c, nowIso)), denominator = Math.max(0, expectedCount);
  return {
    workOrderCount: clocks.length,
    responseSlaMet: results.filter(r => r.response === "MET").length,
    responseSlaBreached: results.filter(r => r.response === "BREACHED").length,
    resolutionSlaMet: results.filter(r => r.resolution === "MET").length,
    resolutionSlaBreached: results.filter(r => r.resolution === "BREACHED").length,
    approvedCostMinor: sumApprovedCosts(costs, currency).toString(), currency,
    dataCoverage: denominator === 0 ? (clocks.length === 0 ? 1 : 0) : Math.min(1, clocks.length / denominator),
  };
}
