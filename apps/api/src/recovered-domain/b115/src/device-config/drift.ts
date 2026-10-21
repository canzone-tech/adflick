import type { ConfigComparison, ConfigProfile, ConfigReport, DriftStatus } from "./types";
function compareVersion(a: string, b: string): number { const aa = a.split(".").map(n => Number.parseInt(n, 10) || 0); const bb = b.split(".").map(n => Number.parseInt(n, 10) || 0); for (let i = 0; i < Math.max(aa.length, bb.length); i++) { const d = (aa[i] ?? 0) - (bb[i] ?? 0); if (d !== 0) return d < 0 ? -1 : 1; } return 0; }
export function isPlayerCompatible(profile: ConfigProfile, playerVersion: string): boolean { if (profile.minPlayerVersion && compareVersion(playerVersion, profile.minPlayerVersion) < 0) return false; if (profile.maxPlayerVersion && compareVersion(playerVersion, profile.maxPlayerVersion) > 0) return false; return true; }
export function compareConfig(desired: { hash: string; schemaVersion: string } | null, report: ConfigReport | null, compatible: boolean): ConfigComparison {
  if (!report || !desired) return { status: "UNKNOWN", reason: !report ? "NO_DEVICE_REPORT" : "NO_DESIRED_ASSIGNMENT" };
  if (!compatible || desired.schemaVersion !== report.schemaVersion) return { status: "INCOMPATIBLE", desiredHash: desired.hash, reportedHash: report.reportedHash, reason: "PLAYER_OR_SCHEMA_INCOMPATIBLE" };
  if (!/^[a-f0-9]{64}$/i.test(report.reportedHash)) return { status: "UNKNOWN", desiredHash: desired.hash, reason: "INVALID_REPORTED_HASH" };
  if (desired.hash.toLowerCase() === report.reportedHash.toLowerCase()) return { status: "IN_SYNC", desiredHash: desired.hash, reportedHash: report.reportedHash, reason: "HASH_MATCH" };
  return { status: "DRIFTED", desiredHash: desired.hash, reportedHash: report.reportedHash, reason: "HASH_MISMATCH" };
}
export function reconciliationAction(status: DriftStatus, isOnline: boolean, revisionCurrent: boolean): "SYNC_CONFIGURATION" | "NO_ACTION" | "BLOCK" {
  if (!revisionCurrent) return "BLOCK";
  if (status === "IN_SYNC") return "NO_ACTION";
  if (status === "INCOMPATIBLE" || status === "UNKNOWN" || status === "RECONCILIATION_FAILED") return "BLOCK";
  if (!isOnline) return "BLOCK";
  if (status === "DRIFTED" || status === "RECONCILIATION_PENDING") return "SYNC_CONFIGURATION";
  return "BLOCK";
}
