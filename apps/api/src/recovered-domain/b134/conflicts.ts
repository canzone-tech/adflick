import type { AvailabilityWindow, CalendarWorkOrder, ScheduleConflict, Technician } from "./types";

const active = (workOrder: CalendarWorkOrder) => !["CANCELLED", "COMPLETED"].includes(workOrder.status);
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

export function detectScheduleConflicts(
  candidate: CalendarWorkOrder,
  allOrders: CalendarWorkOrder[],
  technician: Technician,
  availability: AvailabilityWindow[],
): ScheduleConflict[] {
  const start = Date.parse(candidate.startsAt);
  const end = Date.parse(candidate.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [{ type: "OUTSIDE_AVAILABILITY", resourceId: technician.id, message: "Invalid schedule interval.", workOrderIds: [candidate.id], blocking: true }];
  }

  const conflicts: ScheduleConflict[] = [];
  if (!technician.active) conflicts.push({
    type: "OUTSIDE_AVAILABILITY", resourceId: technician.id,
    message: "Technician is inactive.", workOrderIds: [candidate.id], blocking: true,
  });

  const missingSkills = candidate.requiredSkills.filter((skill) => !technician.skills.includes(skill));
  if (missingSkills.length) conflicts.push({
    type: "SKILL_MISMATCH", resourceId: technician.id,
    message: `Missing required skills: ${missingSkills.join(", ")}`,
    workOrderIds: [candidate.id], blocking: true,
  });

  const covering = availability.some((window) => {
    if (window.technicianId !== technician.id || !window.available) return false;
    const windowStart = Date.parse(window.startsAt);
    const windowEnd = Date.parse(window.endsAt);
    return Number.isFinite(windowStart) && Number.isFinite(windowEnd)
      && windowStart <= start && windowEnd >= end;
  });
  if (!covering) conflicts.push({
    type: "OUTSIDE_AVAILABILITY", resourceId: technician.id,
    message: "No availability window covers the proposed interval.", workOrderIds: [candidate.id], blocking: true,
  });

  for (const other of allOrders) {
    if (other.id === candidate.id || other.tenantId !== candidate.tenantId || !active(other)) continue;
    const otherStart = Date.parse(other.startsAt);
    const otherEnd = Date.parse(other.endsAt);
    if (![otherStart, otherEnd].every(Number.isFinite) || !overlaps(start, end, otherStart, otherEnd)) continue;

    if (other.technicianId === technician.id) conflicts.push({
      type: "TECHNICIAN_OVERLAP", resourceId: technician.id,
      message: `Technician overlaps work order ${other.id}.`, workOrderIds: [candidate.id, other.id], blocking: true,
    });
    if (other.deviceId === candidate.deviceId) conflicts.push({
      type: "DEVICE_OVERLAP", resourceId: candidate.deviceId,
      message: `Device overlaps work order ${other.id}.`, workOrderIds: [candidate.id, other.id], blocking: true,
    });
    if (other.plannedDowntime && candidate.plannedDowntime && other.deviceId === candidate.deviceId) conflicts.push({
      type: "MAINTENANCE_WINDOW_OVERLAP", resourceId: candidate.deviceId,
      message: `Planned downtime overlaps work order ${other.id}.`, workOrderIds: [candidate.id, other.id], blocking: true,
    });
  }
  return conflicts;
}

export function buildScheduleProposal(
  candidate: CalendarWorkOrder,
  allOrders: CalendarWorkOrder[],
  technician: Technician,
  availability: AvailabilityWindow[],
) {
  const conflicts = detectScheduleConflicts(candidate, allOrders, technician, availability);
  return {
    workOrderId: candidate.id,
    technicianId: technician.id,
    startsAt: candidate.startsAt,
    endsAt: candidate.endsAt,
    conflicts,
    canConfirm: conflicts.every((conflict) => !conflict.blocking),
  };
}
