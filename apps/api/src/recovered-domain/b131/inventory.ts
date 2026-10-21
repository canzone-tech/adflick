import type { InventoryPosition, StockMovement, StockMovementType } from "./types";

const delta: Record<StockMovementType, (q: number) => number> = {
  RECEIPT: q => q, RESERVATION: _q => 0, RESERVATION_RELEASE: _q => 0,
  CONSUMPTION: q => -q, RETURN: q => q, ADJUSTMENT_IN: q => q, ADJUSTMENT_OUT: q => -q,
};

export function calculateInventory(partId: string, movements: StockMovement[], reserved: number): InventoryPosition {
  if (!Number.isInteger(reserved) || reserved < 0) throw new Error("Reserved quantity must be a non-negative integer.");
  const rows = movements.filter(m => m.partId === partId);
  const seen = new Set<string>(); let onHand = 0;
  for (const m of rows) {
    if (!Number.isInteger(m.quantity) || m.quantity <= 0) throw new Error("Movement quantity must be positive.");
    if (seen.has(m.idempotencyKey)) throw new Error("Duplicate idempotency key.");
    seen.add(m.idempotencyKey); onHand += delta[m.movementType](m.quantity);
  }
  if (onHand < 0) throw new Error("Inventory would become negative; reject and reconcile.");
  if (reserved > onHand) throw new Error("Reservations exceed on-hand inventory; reconcile.");
  return { partId, onHand, reserved, available: onHand - reserved };
}

export function validateReservation(position: InventoryPosition, requested: number): string[] {
  if (!Number.isInteger(requested) || requested <= 0) return ["Requested quantity must be a positive integer."];
  return requested > position.available ? ["Insufficient available stock."] : [];
}
