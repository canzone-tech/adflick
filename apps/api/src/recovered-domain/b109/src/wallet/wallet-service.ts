import { assertAvailableForDebit, assertWalletCanMutate, LedgerPost, WalletSnapshot, validateLedgerPost } from './ledger';
import { assertPositiveMinorUnits } from './money';
import { validateBudgetReservation, CampaignBudgetPolicy, validateSpendAgainstReservation } from './budget-policy';

export interface WalletTransaction {
  getWalletForUpdate(tenantId: string, walletId: string): Promise<WalletSnapshot>;
  findLedgerByIdempotency(tenantId: string, key: string): Promise<{ id: string } | null>;
  insertLedger(post: LedgerPost): Promise<{ id: string }>;
  updateBalances(input: { tenantId: string; walletId: string; expectedVersion: number; availableMinor: bigint; reservedMinor: bigint }): Promise<void>;
  createReservation(input: { tenantId: string; walletId: string; campaignId: string; currency: string; amountMinor: bigint; idempotencyKey: string }): Promise<void>;
  updateReservation(input: { tenantId: string; campaignId: string; consumedDeltaMinor: bigint; remainingMinor: bigint; status: 'ACTIVE' | 'PARTIALLY_CONSUMED' | 'CONSUMED' | 'RELEASED' }): Promise<void>;
}
export interface WalletDatabase { transaction<T>(fn: (tx: WalletTransaction) => Promise<T>): Promise<T>; }

export class AdvertiserWalletService {
  constructor(private readonly db: WalletDatabase) {}

  async creditVerifiedPayment(input: { tenantId: string; walletId: string; paymentAllocationId: string; amountMinor: bigint; currency: string; idempotencyKey: string }): Promise<{ duplicate: boolean }> {
    assertPositiveMinorUnits(input.amountMinor);
    return this.db.transaction(async tx => {
      const duplicate = await tx.findLedgerByIdempotency(input.tenantId, input.idempotencyKey);
      if (duplicate) return { duplicate: true };
      const wallet = await tx.getWalletForUpdate(input.tenantId, input.walletId);
      assertWalletCanMutate(wallet);
      if (wallet.currency !== input.currency) throw new Error('Currency mismatch');
      const post: LedgerPost = { tenantId: input.tenantId, walletId: input.walletId, type: 'PAYMENT_CREDIT', amountMinor: input.amountMinor, currency: input.currency, referenceType: 'PAYMENT_ALLOCATION', referenceId: input.paymentAllocationId, idempotencyKey: input.idempotencyKey };
      validateLedgerPost(post);
      await tx.insertLedger(post);
      await tx.updateBalances({ tenantId: input.tenantId, walletId: input.walletId, expectedVersion: wallet.version, availableMinor: wallet.availableMinor + input.amountMinor, reservedMinor: wallet.reservedMinor });
      return { duplicate: false };
    });
  }

  async reserveCampaignBudget(input: { tenantId: string; walletId: string; campaignId: string; currency: string; amountMinor: bigint; idempotencyKey: string; policy: CampaignBudgetPolicy }): Promise<{ reservedMinor: bigint }> {
    assertPositiveMinorUnits(input.amountMinor);
    validateBudgetReservation(input.policy);
    if (input.policy.requestedReservationMinor !== input.amountMinor) throw new Error('Budget policy amount does not match reservation amount');
    return this.db.transaction(async tx => {
      const duplicate = await tx.findLedgerByIdempotency(input.tenantId, input.idempotencyKey);
      if (duplicate) return { reservedMinor: 0n };
      const wallet = await tx.getWalletForUpdate(input.tenantId, input.walletId);
      assertWalletCanMutate(wallet);
      if (wallet.currency !== input.currency) throw new Error('Currency mismatch');
      assertAvailableForDebit(wallet, input.amountMinor);
      const post: LedgerPost = { tenantId: input.tenantId, walletId: input.walletId, type: 'CAMPAIGN_RESERVATION', amountMinor: input.amountMinor, currency: input.currency, referenceType: 'CAMPAIGN', referenceId: input.campaignId, idempotencyKey: input.idempotencyKey };
      validateLedgerPost(post);
      await tx.insertLedger(post);
      await tx.updateBalances({ tenantId: input.tenantId, walletId: input.walletId, expectedVersion: wallet.version, availableMinor: wallet.availableMinor - input.amountMinor, reservedMinor: wallet.reservedMinor + input.amountMinor });
      await tx.createReservation({ tenantId: input.tenantId, walletId: input.walletId, campaignId: input.campaignId, currency: input.currency, amountMinor: input.amountMinor, idempotencyKey: input.idempotencyKey });
      return { reservedMinor: input.amountMinor };
    });
  }

  async recordCampaignSpend(input: { tenantId: string; walletId: string; campaignId: string; currency: string; spendMinor: bigint; remainingReservationMinor: bigint; idempotencyKey: string; reservationRemainingAfterMinor: bigint }): Promise<{ spentMinor: bigint }> {
    assertPositiveMinorUnits(input.spendMinor);
    validateSpendAgainstReservation(input.remainingReservationMinor, input.spendMinor);
    if (input.reservationRemainingAfterMinor !== input.remainingReservationMinor - input.spendMinor) throw new Error('Reservation remainder mismatch');
    return this.db.transaction(async tx => {
      const duplicate = await tx.findLedgerByIdempotency(input.tenantId, input.idempotencyKey);
      if (duplicate) return { spentMinor: 0n };
      const wallet = await tx.getWalletForUpdate(input.tenantId, input.walletId);
      assertWalletCanMutate(wallet);
      if (wallet.currency !== input.currency) throw new Error('Currency mismatch');
      if (wallet.reservedMinor < input.spendMinor) throw new Error('Wallet reserved balance is insufficient');
      const post: LedgerPost = { tenantId: input.tenantId, walletId: input.walletId, type: 'CAMPAIGN_SPEND', amountMinor: input.spendMinor, currency: input.currency, referenceType: 'CAMPAIGN', referenceId: input.campaignId, idempotencyKey: input.idempotencyKey };
      validateLedgerPost(post);
      await tx.insertLedger(post);
      await tx.updateBalances({ tenantId: input.tenantId, walletId: input.walletId, expectedVersion: wallet.version, availableMinor: wallet.availableMinor, reservedMinor: wallet.reservedMinor - input.spendMinor });
      await tx.updateReservation({ tenantId: input.tenantId, campaignId: input.campaignId, consumedDeltaMinor: input.spendMinor, remainingMinor: input.reservationRemainingAfterMinor, status: input.reservationRemainingAfterMinor === 0n ? 'CONSUMED' : 'PARTIALLY_CONSUMED' });
      return { spentMinor: input.spendMinor };
    });
  }
}
