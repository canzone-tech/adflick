import { evaluatePaymentReleaseGate, ReleaseGateEvidence } from './release-gate';

const allPassed: ReleaseGateEvidence = {
  prismaValidated: true, apiBuildPassed: true, webBuildPassed: true, unitTestsPassed: true,
  mysqlIntegrationPassed: true, providerSandboxPassed: true, reconciliationPassed: true,
  financeApprovalPassed: true, productionProviderConfigured: true, liveTransfersExplicitlyEnabled: true,
};

describe('payment release gate', () => {
  it('blocks by default when evidence is missing', () => {
    const result = evaluatePaymentReleaseGate({ ...allPassed, liveTransfersExplicitlyEnabled: false });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('Live transfers are not explicitly enabled by an authorized release decision.');
  });
  it('lists all outstanding gates', () => {
    const result = evaluatePaymentReleaseGate({
      prismaValidated: false, apiBuildPassed: false, webBuildPassed: false, unitTestsPassed: false,
      mysqlIntegrationPassed: false, providerSandboxPassed: false, reconciliationPassed: false,
      financeApprovalPassed: false, productionProviderConfigured: false, liveTransfersExplicitlyEnabled: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toHaveLength(10);
  });
  it('allows only when every evidence item is true', () => {
    expect(evaluatePaymentReleaseGate(allPassed)).toEqual({ allowed: true, blockers: [] });
  });
});
