import type { RemediationCandidate, RemediationPlan } from "./types";
export interface RemediationOptions { dryRun: boolean; batchSize: number; maxTargets: number; allowOfflineQueue: boolean; }
export function planRemediation(candidates: RemediationCandidate[], options: RemediationOptions): RemediationPlan {
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) throw new Error("INVALID_BATCH_SIZE");
  if (!Number.isInteger(options.maxTargets) || options.maxTargets < 1 || options.maxTargets > 100000) throw new Error("INVALID_MAX_TARGETS");
  const eligibleDeviceIds: string[] = []; const skipped: Array<{ deviceId: string; reason: string }> = []; const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.deviceId)) { skipped.push({ deviceId: candidate.deviceId, reason: "DUPLICATE_DEVICE" }); continue; }
    seen.add(candidate.deviceId);
    if (candidate.currentDesiredRevision !== candidate.desiredRevision) skipped.push({ deviceId: candidate.deviceId, reason: "STALE_DESIRED_REVISION" });
    else if (!candidate.compatible) skipped.push({ deviceId: candidate.deviceId, reason: "PLAYER_INCOMPATIBLE" });
    else if (!candidate.online && !options.allowOfflineQueue) skipped.push({ deviceId: candidate.deviceId, reason: "DEVICE_OFFLINE" });
    else if (candidate.status === "IN_SYNC") skipped.push({ deviceId: candidate.deviceId, reason: "ALREADY_IN_SYNC" });
    else if (candidate.status === "UNKNOWN" || candidate.status === "INCOMPATIBLE") skipped.push({ deviceId: candidate.deviceId, reason: "REQUIRES_REVIEW" });
    else eligibleDeviceIds.push(candidate.deviceId);
    if (eligibleDeviceIds.length > options.maxTargets) throw new Error("MAX_TARGETS_EXCEEDED");
  }
  return { dryRun: options.dryRun, total: candidates.length, eligibleDeviceIds, skipped, batchCount: Math.ceil(eligibleDeviceIds.length / options.batchSize), batchSize: options.batchSize };
}
