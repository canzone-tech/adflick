import { assertNonNegativeMinorUnits, assertPositiveMinorUnits } from './money';

export type WalletStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type LedgerEntryType = 'PAYMENT_CREDIT' | 'CAMPAIGN_SPEND' | 'CAMPAIGN_RESERVATION' | 'RESERVATION_RELEASE' | 'REFUND_DEBIT' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT' | 'REVERSAL';

export interface WalletSnapshot {
  tenantId: string; walletId: string; currency: string; status: WalletStatus;
  availableMinor: bigint; reservedMinor: bigint; version: number;
}
export interface LedgerPost {
  tenantId: string; walletId: string; type: LedgerEntryType; amountMinor: bigint;
  currency: string; referenceType: string; referenceId: string; idempotencyKey: string;
  description?: string; createdByUserId?: string;
}

export function assertWalletCanMutate(wallet: WalletSnapshot): void {
  if (wallet.status !== 'ACTIVE') throw new Error('Wallet is not active');
  if (!wallet.tenantId || !wallet.walletId) throw new Error('Tenant and wallet are required');
  if (!/^[A-Z]{3}$/.test(wallet.currency)) throw new Error('Currency must be an ISO-style 3-letter code');
  assertNonNegativeMinorUnits(wallet.availableMinor);
  assertNonNegativeMinorUnits(wallet.reservedMinor);
}

export function validateLedgerPost(post: LedgerPost): void {
  assertPositiveMinorUnits(post.amountMinor);
  if (!post.tenantId || !post.walletId || !post.referenceType || !post.referenceId) throw new Error('Tenant, wallet, and reference are required');
  if (!post.idempotencyKey.trim()) throw new Error('Idempotency key is required');
  if (!/^[A-Z]{3}$/.test(post.currency)) throw new Error('Currency must be an ISO-style 3-letter code');
}

export function assertAvailableForDebit(wallet: WalletSnapshot, amountMinor: bigint): void {
  assertWalletCanMutate(wallet);
  assertPositiveMinorUnits(amountMinor);
  if (wallet.availableMinor < amountMinor) throw new Error('Insufficient available wallet balance');
}
