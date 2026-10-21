export interface MaintenanceReminderCandidate {
  id: string;
  tenantId: string;
  dueAt?: string;
  status: string;
  technicianId?: string;
}

export interface MaintenanceReminderProposal {
  workOrderId: string;
  tenantId: string;
  kind: "UPCOMING" | "OVERDUE" | "UNASSIGNED";
  idempotencyKey: string;
}

/** Produces deterministic proposals only; persist to a durable outbox before delivery. */
export function proposeMaintenanceReminders(
  orders: MaintenanceReminderCandidate[],
  nowIso: string,
  upcomingMinutes = 120,
): MaintenanceReminderProposal[] {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now) || !Number.isFinite(upcomingMinutes) || upcomingMinutes < 0) {
    throw new Error("INVALID_REMINDER_POLICY");
  }
  const proposals: MaintenanceReminderProposal[] = [];
  for (const order of orders) {
    if (!order.tenantId.trim() || !order.id.trim()) throw new Error("REMINDER_SCOPE_REQUIRED");
    if (["VERIFIED", "CANCELLED"].includes(order.status)) continue;
    const due = order.dueAt ? Date.parse(order.dueAt) : Number.NaN;
    let kind: MaintenanceReminderProposal["kind"] | undefined;
    if (!order.technicianId?.trim()) kind = "UNASSIGNED";
    else if (Number.isFinite(due) && due < now) kind = "OVERDUE";
    else if (Number.isFinite(due) && due <= now + upcomingMinutes * 60_000) kind = "UPCOMING";
    if (kind) proposals.push({
      workOrderId: order.id,
      tenantId: order.tenantId,
      kind,
      idempotencyKey: `maintenance-reminder:${order.tenantId}:${order.id}:${kind}:${order.dueAt ?? "no-due-date"}`,
    });
  }
  return proposals;
}
