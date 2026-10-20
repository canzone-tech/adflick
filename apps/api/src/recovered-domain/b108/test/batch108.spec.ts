import { calculateTaxMinor, calculateLineSubtotal, addMoney } from '../src/billing/money';
import { calculateInvoiceTotals, assertCanIssueInvoice } from '../src/billing/invoice-validation';
import { validateAllocation } from '../src/billing/payment-allocation';

describe('Batch 108 advertiser billing', () => {
  it('calculates invoice totals using integer minor units', () => {
    expect(calculateInvoiceTotals([{ quantity: 2, unitAmountMinor: 10000n, taxRateBasisPoints: 1800 }]))
      .toEqual({ subtotalMinor: 20000n, taxMinor: 3600n, totalMinor: 23600n });
  });
  it('rejects invalid quantity and currency mixing', () => {
    expect(() => calculateLineSubtotal(0, 100n)).toThrow('INVALID_QUANTITY');
    expect(() => addMoney({ amountMinor: 1n, currency: 'INR' }, { amountMinor: 1n, currency: 'USD' })).toThrow('CURRENCY_MISMATCH');
  });
  it('rounds tax in minor units', () => {
    expect(calculateTaxMinor(100n, 500)).toBe(5n);
  });
  it('requires approved orders and pricing before invoice issue', () => {
    expect(() => assertCanIssueInvoice({
      status: 'DRAFT', pricingApproved: false, advertiserActive: true,
      allCampaignOrdersApproved: true, legalEntityConfigured: true,
    })).toThrow('PRICING_NOT_APPROVED');
  });
  it('blocks payment over-allocation', () => {
    expect(() => validateAllocation({
      paymentAmountMinor: 1000n, paymentAllocatedMinor: 900n,
      invoiceTotalMinor: 5000n, invoiceAllocatedMinor: 0n,
      paymentCurrency: 'INR', invoiceCurrency: 'INR',
    }, 200n)).toThrow('PAYMENT_OVERALLOCATED');
  });
  it('blocks invoice over-allocation and cross-currency allocation', () => {
    expect(() => validateAllocation({
      paymentAmountMinor: 5000n, paymentAllocatedMinor: 0n,
      invoiceTotalMinor: 1000n, invoiceAllocatedMinor: 900n,
      paymentCurrency: 'INR', invoiceCurrency: 'INR',
    }, 200n)).toThrow('INVOICE_OVERALLOCATED');
    expect(() => validateAllocation({
      paymentAmountMinor: 5000n, paymentAllocatedMinor: 0n,
      invoiceTotalMinor: 5000n, invoiceAllocatedMinor: 0n,
      paymentCurrency: 'USD', invoiceCurrency: 'INR',
    }, 100n)).toThrow('CURRENCY_MISMATCH');
  });
});
