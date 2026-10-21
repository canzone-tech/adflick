import type { MaintenanceWorkOrder } from "./types";

export interface MaintenanceOperationsSummary {
  total: number;
  open: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  completedAwaitingVerification: number;
  verified: number;
  unassigned: number;
}

export function summarizeMaintenanceWorkOrders(orders: MaintenanceWorkOrder[], nowIso: string): MaintenanceOperationsSummary {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) throw new Error("INVALID_NOW_TIMESTAMP");
  const summary: MaintenanceOperationsSummary = {
    total: orders.length, open: 0, inProgress: 0, blocked: 0, overdue: 0,
    completedAwaitingVerification: 0, verified: 0, unassigned: 0,
  };
  for (const order of orders) {
    if (order.status === "OPEN") summary.open++;
    if (order.status === "IN_PROGRESS") summary.inProgress++;
    if (order.status === "BLOCKED") summary.blocked++;
    if (order.status === "WORK_COMPLETED") summary.completedAwaitingVerification++;
    if (order.status === "VERIFIED") summary.verified++;
    if (!order.technicianId && !["VERIFIED", "CANCELLED"].includes(order.status)) summary.unassigned++;
    if (order.dueAt && Date.parse(order.dueAt) < now && !["VERIFIED", "CANCELLED"].includes(order.status)) summary.overdue++;
  }
  return summary;
}
