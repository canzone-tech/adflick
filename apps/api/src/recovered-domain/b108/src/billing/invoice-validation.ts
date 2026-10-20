import { calculateLineSubtotal, calculateTaxMinor } from './money';

export type InvoiceLineInput = { quantity: number; unitAmountMinor: bigint; taxRateBasisPoints: number };
export type InvoiceTotals = { subtotalMinor: bigint; taxMinor: bigint; totalMinor: bigint };

export function calculateInvoiceTotals(lines: InvoiceLineInput[]): InvoiceTotals {
  if (!lines.length) throw new Error('INVOICE_REQUIRES_LINES');
  let subtotalMinor = 0n, taxMinor = 0n;
  for (const line of lines) {
    const subtotal = calculateLineSubtotal(line.quantity, line.unitAmountMinor);
    subtotalMinor += subtotal;
    taxMinor += calculateTaxMinor(subtotal, line.taxRateBasisPoints);
  }
  return { subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor };
}

export function assertCanIssueInvoice(input: {
  status: string; pricingApproved: boolean; advertiserActive: boolean;
  allCampaignOrdersApproved: boolean; legalEntityConfigured: boolean;
}): void {
  if (input.status !== 'DRAFT') throw new Error('INVOICE_NOT_DRAFT');
  if (!input.pricingApproved) throw new Error('PRICING_NOT_APPROVED');
  if (!input.advertiserActive) throw new Error('ADVERTISER_NOT_ACTIVE');
  if (!input.allCampaignOrdersApproved) throw new Error('CAMPAIGN_ORDER_NOT_APPROVED');
  if (!input.legalEntityConfigured) throw new Error('LEGAL_ENTITY_NOT_CONFIGURED');
}
