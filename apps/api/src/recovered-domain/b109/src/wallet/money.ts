import { Decimal } from '@prisma/client/runtime/library';

export type Money = { amountPaise: bigint; currency: 'INR' };

export function parseMoney(value: string | number | bigint): Money {
  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error('Invalid INR amount.');
  const [rupeesRaw, fractionRaw = ''] = raw.split('.');
  const rupees = BigInt(rupeesRaw || '0');
  const fraction = BigInt((fractionRaw + '00').slice(0, 2));
  return { amountPaise: rupees * 100n + fraction, currency: 'INR' };
}

export function decimalToMoney(value: Decimal | string | number): Money {
  const raw = String(value).trim();
  const match = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error('Invalid decimal money value.');
  const rupeesRaw = match[1];
  const fractionRaw = match[2] ?? '';
  return { amountPaise: BigInt(rupeesRaw) * 100n + BigInt((fractionRaw + '00').slice(0, 2)), currency: 'INR' };
}

export function addMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency) throw new Error('Currency mismatch.');
  return { amountPaise: left.amountPaise + right.amountPaise, currency: left.currency };
}

export function subtractMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency) throw new Error('Currency mismatch.');
  const amountPaise = left.amountPaise - right.amountPaise;
  if (amountPaise < 0n) throw new Error('Money amount cannot become negative.');
  return { amountPaise, currency: left.currency };
}
