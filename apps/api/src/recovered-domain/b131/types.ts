export type SlaClockState = "RUNNING" | "PAUSED" | "STOPPED";
export type CostCategory = "LABOR" | "PART" | "TRAVEL" | "THIRD_PARTY" | "OTHER";
export type StockMovementType = "RECEIPT" | "RESERVATION" | "RESERVATION_RELEASE" | "CONSUMPTION" | "RETURN" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";

export interface SlaClock {
  tenantId: string; workOrderId: string; openedAt: string; firstResponseAt?: string;
  resolvedAt?: string; responseDueAt: string; resolutionDueAt: string;
  state: SlaClockState; accumulatedPauseSecs: number;
}
export interface StockMovement {
  tenantId: string; partId: string; movementType: StockMovementType;
  quantity: number; idempotencyKey: string;
}
export interface CostEntry {
  tenantId: string; workOrderId: string; category: CostCategory; quantity: number;
  unitCostMinor: bigint; totalCostMinor: bigint; currency: string; approved: boolean;
}
export interface InventoryPosition { partId: string; onHand: number; reserved: number; available: number; }
