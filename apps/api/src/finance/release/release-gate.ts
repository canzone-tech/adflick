export interface ReleaseGateEvidence {
  prismaValidated: boolean;
  apiBuildPassed: boolean;
  webBuildPassed: boolean;
  unitTestsPassed: boolean;
  mysqlIntegrationPassed: boolean;
  providerSandboxPassed: boolean;
  reconciliationPassed: boolean;
  financeApprovalPassed: boolean;
  productionProviderConfigured: boolean;
  liveTransfersExplicitlyEnabled: boolean;
}

export interface ReleaseGateResult {
  allowed: boolean;
  blockers: string[];
}

/** Pure release policy. Production transfer activation requires every technical and finance gate. */
export function evaluatePaymentReleaseGate(e: ReleaseGateEvidence): ReleaseGateResult {
  const checks: Array<[keyof ReleaseGateEvidence, string]> = [
    ['prismaValidated', 'Prisma schema validation has not passed.'],
    ['apiBuildPassed', 'API production build has not passed.'],
    ['webBuildPassed', 'Web production build has not passed.'],
    ['unitTestsPassed', 'Unit tests have not passed.'],
    ['mysqlIntegrationPassed', 'MySQL 8.4 integration tests have not passed.'],
    ['providerSandboxPassed', 'Provider sandbox tests have not passed.'],
    ['reconciliationPassed', 'Payout reconciliation acceptance tests have not passed.'],
    ['financeApprovalPassed', 'Finance approval controls have not passed.'],
    ['productionProviderConfigured', 'A production provider has not been approved and configured.'],
    ['liveTransfersExplicitlyEnabled', 'Live transfers are not explicitly enabled by an authorized release decision.'],
  ];
  const blockers = checks.filter(([key]) => e[key] !== true).map(([, message]) => message);
  return { allowed: blockers.length === 0, blockers };
}
