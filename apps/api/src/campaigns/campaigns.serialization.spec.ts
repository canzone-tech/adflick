import { serializeCampaignAmount } from './campaigns.controller';

describe('Campaign REST JSON boundary', () => {
  it('serializes exact large minor-unit amounts as decimal strings without rounding', () => {
    const source = { id: 'draft', budgetPaise: 9007199254740993n, currency: 'INR', creatives: [{ assetId: 'test' }] };
    const json = serializeCampaignAmount(source);
    expect(json).toEqual({ ...source, budgetPaise: '9007199254740993' });
    expect(JSON.stringify(json)).toContain('"budgetPaise":"9007199254740993"');
    expect(source.budgetPaise).toBe(9007199254740993n);
  });
  it('handles list, null and undefined without inventing prices', () => {
    const json = serializeCampaignAmount([{ budgetPaise: null }, { budgetPaise: 0n }]);
    expect(JSON.stringify(json)).toBe('[{"budgetPaise":null},{"budgetPaise":"0"}]');
    expect(serializeCampaignAmount(undefined)).toBeUndefined();
  });
});
