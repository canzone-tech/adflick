import type { ComplianceDevice, ComplianceSummary } from "./types";
export function summarizeCompliance(devices: ComplianceDevice[]): ComplianceSummary {
  const summary: ComplianceSummary = { total: devices.length, compliant: 0, drifted: 0, unknown: 0, incompatible: 0, pending: 0, failed: 0, offline: 0, compliancePercent: null };
  for (const device of devices) {
    if (!device.online) summary.offline++;
    switch (device.status) {
      case "IN_SYNC":
        if (device.desiredRevision !== undefined && device.reportedRevision === device.desiredRevision && !!device.desiredHash && device.desiredHash === device.reportedHash) summary.compliant++;
        else summary.unknown++;
        break;
      case "DRIFTED": summary.drifted++; break;
      case "UNKNOWN": summary.unknown++; break;
      case "INCOMPATIBLE": summary.incompatible++; break;
      case "RECONCILIATION_PENDING": summary.pending++; break;
      case "RECONCILIATION_FAILED": summary.failed++; break;
    }
  }
  summary.compliancePercent = summary.total === 0 ? null : Math.round((summary.compliant / summary.total) * 10000) / 100;
  return summary;
}
