export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type IncidentStatus = "OPEN" | "ACKNOWLEDGED" | "INVESTIGATING" | "MITIGATED" | "RESOLVED" | "CLOSED";

export interface SlaAlert {
  id: string;
  tenantId: string;
  metricName: string;
  severity: AlertSeverity;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  observedValue: number;
  thresholdValue: number;
  sampleSize: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface Incident {
  id: string;
  tenantId: string;
  title: string;
  severity: AlertSeverity;
  status: IncidentStatus;
  ownerUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationRule {
  id: string;
  enabled: boolean;
  afterMinutes: number;
  targetRole: string;
  channel: "IN_APP" | "EMAIL" | "SMS" | "WEBHOOK";
  maxAttempts: number;
}
