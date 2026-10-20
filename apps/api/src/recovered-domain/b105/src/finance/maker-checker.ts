export type ApprovalContext = {
  makerUserId: string;
  checkerUserId: string;
  batchStatus: string;
  expectedValidationHash: string;
  currentValidationHash: string;
  organizationScopeMatches: boolean;
  checkerHasFinanceApprovalPermission: boolean;
};

export function validateBatchApproval(c: ApprovalContext): void {
  if (c.makerUserId === c.checkerUserId) throw new Error('MAKER_CHECKER_SEPARATION_VIOLATION');
  if (!c.organizationScopeMatches) throw new Error('ORGANIZATION_SCOPE_MISMATCH');
  if (!c.checkerHasFinanceApprovalPermission) throw new Error('FINANCE_APPROVAL_PERMISSION_REQUIRED');
  if (c.batchStatus !== 'PENDING_APPROVAL') throw new Error('BATCH_NOT_PENDING_APPROVAL');
  if (!c.expectedValidationHash || c.expectedValidationHash !== c.currentValidationHash) {
    throw new Error('PAYOUT_BATCH_CHANGED_AFTER_VALIDATION');
  }
}
