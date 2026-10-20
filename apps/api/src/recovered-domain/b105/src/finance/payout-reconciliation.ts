export type InternalPayout = {
  id: string;
  amountMinor: bigint;
  currency: string;
  status: string;
  providerReference?: string | null;
};

export type ProviderPayout = {
  amountMinor: bigint;
  currency: string;
  status: string;
  providerReference?: string | null;
};

export type ReconciliationResult = {
  resultCode: 'MATCHED_SETTLED' | 'MATCHED_PENDING' | 'AMOUNT_MISMATCH' |
    'CURRENCY_MISMATCH' | 'REFERENCE_MISMATCH' | 'STATUS_CONFLICT' | 'PROVIDER_RECORD_MISSING';
  amountMatches: boolean;
  currencyMatches: boolean;
  mayMarkPaid: boolean;
};

export function reconcilePayout(internal: InternalPayout, provider: ProviderPayout | null): ReconciliationResult {
  if (!provider) return { resultCode: 'PROVIDER_RECORD_MISSING', amountMatches: false, currencyMatches: false, mayMarkPaid: false };
  const amountMatches = internal.amountMinor === provider.amountMinor;
  const currencyMatches = internal.currency === provider.currency;
  const referenceMatches = !!internal.providerReference && !!provider.providerReference && internal.providerReference === provider.providerReference;
  if (!amountMatches) return { resultCode: 'AMOUNT_MISMATCH', amountMatches, currencyMatches, mayMarkPaid: false };
  if (!currencyMatches) return { resultCode: 'CURRENCY_MISMATCH', amountMatches, currencyMatches, mayMarkPaid: false };
  if (!referenceMatches) return { resultCode: 'REFERENCE_MISMATCH', amountMatches, currencyMatches, mayMarkPaid: false };
  const settled = ['SETTLED', 'SUCCESS', 'COMPLETED'].includes(provider.status.toUpperCase());
  const pending = ['PENDING', 'PROCESSING', 'ACCEPTED'].includes(provider.status.toUpperCase());
  if (settled) return { resultCode: 'MATCHED_SETTLED', amountMatches, currencyMatches, mayMarkPaid: true };
  if (pending) return { resultCode: 'MATCHED_PENDING', amountMatches, currencyMatches, mayMarkPaid: false };
  return { resultCode: 'STATUS_CONFLICT', amountMatches, currencyMatches, mayMarkPaid: false };
}
