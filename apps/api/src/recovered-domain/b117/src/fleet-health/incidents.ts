import type { IncidentStatus, Severity } from './types';
const allowed: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['ACKNOWLEDGED', 'INVESTIGATING', 'SUPPRESSED', 'RESOLVED'],
  ACKNOWLEDGED: ['INVESTIGATING', 'MITIGATED', 'SUPPRESSED', 'RESOLVED'],
  INVESTIGATING: ['ACKNOWLEDGED', 'MITIGATED', 'SUPPRESSED', 'RESOLVED'],
  MITIGATED: ['INVESTIGATING', 'RESOLVED', 'OPEN'], RESOLVED: ['OPEN'], SUPPRESSED: ['OPEN', 'RESOLVED'],
};
export function assertIncidentTransition(from: IncidentStatus, to: IncidentStatus): void { if (!allowed[from].includes(to)) throw new Error(`INVALID_INCIDENT_TRANSITION:${from}->${to}`); }
export function severityRank(severity: Severity): number { return ({ INFO: 1, WARNING: 2, MAJOR: 3, CRITICAL: 4 })[severity]; }
export function chooseSeverity(current: Severity, incoming: Severity): Severity { return severityRank(incoming) > severityRank(current) ? incoming : current; }
