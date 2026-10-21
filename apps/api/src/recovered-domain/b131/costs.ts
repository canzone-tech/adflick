import type { CostEntry } from "./types";

export function validateCostEntry(entry: CostEntry): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(entry.quantity) || entry.quantity <= 0) errors.push("Quantity must be a positive integer.");
  if (entry.unitCostMinor < 0n || entry.totalCostMinor < 0n) errors.push("Costs cannot be negative.");
  if (entry.totalCostMinor !== BigInt(entry.quantity) * entry.unitCostMinor) errors.push("Total must equal quantity × unit cost.");
  if (!/^[A-Z]{3}$/.test(entry.currency)) errors.push("Currency must be a three-letter uppercase code.");
  if (!entry.approved) errors.push("Cost entry requires approval before approved-cost reporting.");
  return errors;
}

export function sumApprovedCosts(entries: CostEntry[], currency: string): bigint {
  return entries.filter(e => e.approved && e.currency === currency).reduce((sum, e) => sum + e.totalCostMinor, 0n);
}

// Never combine currencies without an approved FX rate, effective timestamp and audit trail.
