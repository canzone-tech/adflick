import type { BundleRequestInput, BundleStatus } from './types';
export interface BundlePolicy { maxTtlSeconds: number; maxConcurrentPerDevice: number; maxBytes: number; }
export function validateBundleRequest(request: BundleRequestInput, policy: BundlePolicy, activeRequestsForDevice: number): void {
  if (!request.tenantId || !request.deviceId || !request.requestedById) throw new Error('BUNDLE_REQUEST_SCOPE_REQUIRED');
  if (request.reason.trim().length < 8 || request.reason.length > 500) throw new Error('BUNDLE_REASON_INVALID');
  const ttl = (request.expiresAt.getTime() - request.requestedAt.getTime()) / 1000;
  if (ttl <= 0 || ttl > policy.maxTtlSeconds) throw new Error('BUNDLE_TTL_OUT_OF_RANGE');
  if (activeRequestsForDevice >= policy.maxConcurrentPerDevice) throw new Error('BUNDLE_REQUEST_LIMIT_REACHED');
  if (policy.maxBytes <= 0) throw new Error('BUNDLE_MAX_BYTES_INVALID');
}
const transitions: Record<BundleStatus, BundleStatus[]> = {
  REQUESTED: ['QUEUED', 'FAILED', 'EXPIRED'], QUEUED: ['COLLECTING', 'FAILED', 'EXPIRED'], COLLECTING: ['UPLOADED', 'FAILED', 'EXPIRED'], UPLOADED: ['EXPIRED', 'DELETED'], EXPIRED: ['DELETED'], FAILED: ['QUEUED', 'EXPIRED', 'DELETED'], DELETED: [],
};
export function assertBundleTransition(from: BundleStatus, to: BundleStatus): void { if (!transitions[from].includes(to)) throw new Error(`INVALID_BUNDLE_TRANSITION:${from}->${to}`); }
