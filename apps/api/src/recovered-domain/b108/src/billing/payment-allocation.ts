export type AllocationState = {
  paymentAmountMinor: bigint;
  paymentAllocatedMinor: bigint;
  invoiceTotalMinor: bigint;
  invoiceAllocatedMinor: bigint;
  paymentCurrency: string;
  invoiceCurrency: string;
};

export function validateAllocation(s: AllocationState, allocationMinor: bigint): void {
  if (allocationMinor <= 0n) throw new Error('ALLOCATION_MUST_BE_POSITIVE');
  if (s.paymentCurrency !== s.invoiceCurrency) throw new Error('CURRENCY_MISMATCH');
  if (s.paymentAllocatedMinor < 0n || s.invoiceAllocatedMinor < 0n) throw new Error('INVALID_EXISTING_ALLOCATION');
  if (s.paymentAllocatedMinor + allocationMinor > s.paymentAmountMinor) throw new Error('PAYMENT_OVERALLOCATED');
  if (s.invoiceAllocatedMinor + allocationMinor > s.invoiceTotalMinor) throw new Error('INVOICE_OVERALLOCATED');
}
