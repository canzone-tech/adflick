export type MinorUnits = bigint;

export function parseMinorUnits(value: string, fractionDigits = 2): MinorUnits {
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 6) throw new Error('fractionDigits must be an integer from 0 to 6');
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new Error('Invalid non-negative decimal amount');
  const fraction = match[2] ?? '';
  if (fraction.length > fractionDigits) throw new Error('Too many fractional digits');
  const scale = 10n ** BigInt(fractionDigits);
  const padded = (fraction + '0'.repeat(fractionDigits)).slice(0, fractionDigits);
  return BigInt(match[1]) * scale + BigInt(padded || '0');
}

export function assertPositiveMinorUnits(amount: bigint): void {
  if (amount <= 0n) throw new Error('Amount must be greater than zero');
}

export function assertNonNegativeMinorUnits(amount: bigint): void {
  if (amount < 0n) throw new Error('Amount cannot be negative');
}
