import type { CalendarWorkOrder } from "./types";

export type CalendarView = "LIST" | "WEEK";

export function selectCalendarOrders(
  orders: CalendarWorkOrder[],
  from: string,
  to: string,
  search = "",
): CalendarWorkOrder[] {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  const query = search.trim().toLowerCase();
  if (![fromMs, toMs].every(Number.isFinite) || toMs <= fromMs) return [];

  return orders.filter((order) => {
    const start = Date.parse(order.startsAt);
    const end = Date.parse(order.endsAt);
    return start < toMs && end > fromMs
      && (!query
        || order.title.toLowerCase().includes(query)
        || order.deviceId.toLowerCase().includes(query)
        || order.id.toLowerCase().includes(query));
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export function durationMinutes(order: CalendarWorkOrder): number {
  const start = Date.parse(order.startsAt);
  const end = Date.parse(order.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export function isValidIanaTimezone(timezone: string): boolean {
  if (!timezone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}
