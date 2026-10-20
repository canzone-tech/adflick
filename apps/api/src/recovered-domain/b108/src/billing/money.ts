export type Money = { amountMinor: bigint; currency: string };
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new Error('CURRENCY_MISMATCH');
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}
export function assertPositiveMoney(money: Money): void {
  if (money.amountMinor <= 0n) throw new Error('AMOUNT_MUST_BE_POSITIVE');
  if (!/^[A-Z]{3}$/.test(money.currency)) throw new Error('INVALID_CURRENCY_CODE');
}
export function calculateLineSubtotal(quantity: number, unitAmountMinor: bigint): bigint {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('INVALID_QUANTITY');
  if (unitAmountMinor < 0n) throw new Error('NEGATIVE_UNIT_AMOUNT');
  return BigInt(quantity) * unitAmountMinor;
}
export function calculateTaxMinor(subtotalMinor: bigint, taxRateBasisPoints: number): bigint {
  if (subtotalMinor < 0n) throw new Error('NEGATIVE_SUBTOTAL');
  if (!Number.isInteger(taxRateBasisPoints) || taxRateBasisPoints < 0 || taxRateBasisPoints > 10000) throw new Error('INVALID_TAX_RATE');
  return (subtotalMinor * BigInt(taxRateBasisPoints) + 5000n) / 10000n;
}
