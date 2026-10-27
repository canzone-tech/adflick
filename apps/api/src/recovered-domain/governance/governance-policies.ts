/**
 * Source-backed, side-effect-free review and release guardrails from recovery
 * batches 136–150. These do NOT authorize persistence, device commands,
 * finance transactions, or production deployment.
 *
 * Live services must revalidate tenant/RBAC, expected version and approvals
 * inside transactions with append-only audit and an outbox.
 */
export type Decision = { allowed: boolean; reasons: string[] };
const validInstant = (value: string): number => {
  const date = Date.parse(value);
  if (!Number.isFinite(date)) throw new Error("Invalid timestamp.");
  return date;
};
const fail = (reason: string): Decision => ({ allowed: false, reasons: [reason] });

/** B136 — independent review of completed technician work. */
export function reviewWorkOrder(input: {
  status: "PENDING" | "IN_REVIEW" | "ESCALATED" | "APPROVED";
  technicianId: string; reviewerId: string; independent: boolean;
  decision: "APPROVE" | "REJECT_FOR_REWORK" | "REQUEST_MORE_EVIDENCE" | "ESCALATE";
  reason?: string; requiredChecksPassed: boolean;
  evidence: Array<"UPLOADED" | "PENDING" | "REJECTED">;
}): Decision {
  const reasons: string[] = [];
  if (!input.reviewerId.trim()) reasons.push("Reviewer identity required.");
  if (input.independent && input.reviewerId === input.technicianId) reasons.push("Self-review forbidden.");
  if (!["PENDING", "IN_REVIEW", "ESCALATED"].includes(input.status)) reasons.push("Not reviewable.");
  if (input.decision !== "APPROVE" && !input.reason?.trim()) reasons.push("Reason required.");
  if (input.decision === "APPROVE") {
    if (!input.requiredChecksPassed) reasons.push("Required checklist failed.");
    if (input.evidence.some(s => s !== "UPLOADED")) reasons.push("Evidence pending or rejected.");
  }
  return { allowed: reasons.length === 0, reasons };
}

/** B137 — calendar-time SLA classification only, no implied warranty coverage. */
export function classifySla(dueAt: string, nowAt: string, warningMinutes: number, resolved: boolean):
  "RESOLVED" | "OVERDUE" | "DUE_SOON" | "ON_TRACK" {
  const due = validInstant(dueAt), now = validInstant(nowAt);
  if (!Number.isSafeInteger(warningMinutes) || warningMinutes < 0) throw new Error("Invalid SLA policy.");
  if (resolved) return "RESOLVED";
  if (now > due) return "OVERDUE";
  return due - now <= warningMinutes * 60_000 ? "DUE_SOON" : "ON_TRACK";
}

/** B138 — reports must identify tenant, bounded window and timezone. */
export function validateGovernanceWindow(tenantId: string, startAt: string, endAt: string, timezone: string): Decision {
  const reasons: string[] = [];
  if (!tenantId.trim()) reasons.push("Tenant required.");
  try { if (validInstant(startAt) >= validInstant(endAt)) reasons.push("Invalid report window."); }
  catch { reasons.push("Invalid report timestamps."); }
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); }
  catch { reasons.push("Invalid IANA timezone."); }
  if (!timezone.trim()) reasons.push("Timezone required.");
  return { allowed: reasons.length === 0, reasons };
}

/** B139 — export jobs require bounded attempts and explicit transitions. */
export type ExportStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "CANCELLED";
const exportNext: Record<ExportStatus, ExportStatus[]> = {
  QUEUED: ["RUNNING", "CANCELLED"], RUNNING: ["SUCCEEDED", "FAILED", "CANCELLED"],
  SUCCEEDED: ["EXPIRED"], FAILED: ["QUEUED", "EXPIRED"], EXPIRED: [], CANCELLED: [],
};
export function exportTransition(status: ExportStatus, next: ExportStatus, attempts: number, limit: number): number {
  if (!Number.isSafeInteger(attempts) || !Number.isSafeInteger(limit) || attempts < 0 || limit < 1)
    throw new Error("Invalid attempt policy.");
  if (!exportNext[status].includes(next)) throw new Error("Invalid export transition.");
  if ((next === "RUNNING" || next === "QUEUED") && attempts >= limit) throw new Error("Retry exhausted.");
  return attempts + Number(next === "RUNNING");
}

/** B140 — tenant/role/report policy lookup denies missing or ambiguous policies. */
export interface ReportPolicy {
  tenantId: string; role: string; reportType: string; enabled: boolean;
  actions: string[]; allowedFields: string[]; deniedFields: string[];
}
export function authorizeReport(
  tenantId: string, role: string, reportType: string, action: string,
  fields: string[], policies: ReportPolicy[],
): Decision {
  const matching = policies.filter(p => p.enabled && p.tenantId === tenantId && p.role === role && p.reportType === reportType);
  if (matching.length !== 1) return fail("Missing or ambiguous policy.");
  const policy = matching[0];
  if (!policy) return fail("Missing policy.");
  if (!policy.actions.includes(action)) return fail("Action denied.");
  const allowed = new Set(policy.allowedFields.filter(x => !policy.deniedFields.includes(x)));
  if (fields.some(x => !allowed.has(x))) return fail("Field not allowlisted.");
  return { allowed: true, reasons: [] };
}

/** B141 — metadata check; caller must separately authenticate the key hash. */
export function authorizeApiKey(input: {
  tenantId: string; requestedTenant: string; active: boolean;
  scopes: string[]; requiredScopes: string[]; expiresAt?: string; nowAt: string;
}): Decision {
  if (!input.tenantId.trim() || input.tenantId !== input.requestedTenant) return fail("Tenant mismatch.");
  if (!input.active) return fail("Inactive key.");
  if (input.expiresAt && validInstant(input.nowAt) >= validInstant(input.expiresAt)) return fail("Expired key.");
  if (!input.requiredScopes.every(s => input.scopes.includes(s))) return fail("Scope missing.");
  return { allowed: true, reasons: ["Metadata only; credential verification still required."] };
}

/** B142 — security alert triage uses optimistic concurrency and an audit reason. */
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED" | "FALSE_POSITIVE";
const alertNext: Record<AlertStatus, AlertStatus[]> = {
  OPEN: ["ACKNOWLEDGED", "INVESTIGATING", "FALSE_POSITIVE"],
  ACKNOWLEDGED: ["INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"],
  INVESTIGATING: ["ACKNOWLEDGED", "RESOLVED", "FALSE_POSITIVE"],
  RESOLVED: ["INVESTIGATING"], FALSE_POSITIVE: ["OPEN"],
};
export function transitionAlert(status: AlertStatus, next: AlertStatus, version: number, expected: number, actor: string, reason: string): number {
  if (!Number.isSafeInteger(version) || version < 0 || version !== expected) throw new Error("Stale version.");
  if (!actor.trim() || !reason.trim()) throw new Error("Audit identity and reason required.");
  if (!alertNext[status].includes(next)) throw new Error("Invalid alert transition.");
  return version + 1;
}

/** B143 — containment is a separately approved incident response action. */
export function permitContainment(
  current: "INVESTIGATING" | "CONTAINMENT_PENDING_APPROVAL" | "CONTAINING",
  next: "CONTAINMENT_PENDING_APPROVAL" | "CONTAINING",
  approved: boolean,
): Decision {
  if (current === "INVESTIGATING" && next === "CONTAINMENT_PENDING_APPROVAL") return { allowed: true, reasons: [] };
  if (current === "CONTAINMENT_PENDING_APPROVAL" && next === "CONTAINING" && approved) return { allowed: true, reasons: [] };
  return fail("Invalid transition or missing containment approval.");
}

/** B144 — report export scope, time-window and field authorization. */
export function validateSecurityEvidenceExport(input: {
  tenantId: string; requesterId: string; start: string; end: string;
  controls: string[]; permitted: Set<string>; sensitiveRequested: boolean; sensitiveAllowed: boolean;
}): Decision {
  const reasons: string[] = [];
  if (!input.tenantId.trim() || !input.requesterId.trim()) reasons.push("Tenant/requester required.");
  try {
    const period = validInstant(input.end) - validInstant(input.start);
    if (period <= 0 || period > 366 * 86_400_000) reasons.push("Window exceeds policy.");
  } catch { reasons.push("Invalid window."); }
  if (!input.controls.length || input.controls.length > 100) reasons.push("Invalid control count.");
  if (input.controls.some(x => !input.permitted.has(x))) reasons.push("Unauthorized control.");
  if (input.sensitiveRequested && !input.sensitiveAllowed) reasons.push("Sensitive export denied.");
  return { allowed: reasons.length === 0, reasons };
}

/** B145 — stale/unknown evidence cannot certify control compliance. */
export function evidenceFreshness(
  collected: string | undefined, expires: string | undefined,
  maxAgeDays: number, nowAt: string,
): "MISSING" | "CURRENT" | "STALE" | "REVIEW_REQUIRED" {
  if (!collected) return "MISSING";
  if (!Number.isSafeInteger(maxAgeDays) || maxAgeDays < 0) return "REVIEW_REQUIRED";
  try {
    const now = validInstant(nowAt), start = validInstant(collected);
    if (start > now) return "REVIEW_REQUIRED";
    if (expires && now >= validInstant(expires)) return "STALE";
    return now - start <= maxAgeDays * 86_400_000 ? "CURRENT" : "STALE";
  } catch { return "REVIEW_REQUIRED"; }
}

/** B146 — proposal only; production promotion requires independent authorization. */
export function validatePromotion(
  source: "DEVELOPMENT" | "STAGING" | "PRODUCTION",
  target: "DEVELOPMENT" | "STAGING" | "PRODUCTION",
  digest: string, requester: string, approver: string, checks: boolean[],
): Decision {
  const envs = ["DEVELOPMENT", "STAGING", "PRODUCTION"];
  const reasons: string[] = [];
  if (envs.indexOf(target) !== envs.indexOf(source) + 1) reasons.push("Only next-environment promotion permitted.");
  if (!/^[a-f0-9]{64}$/i.test(digest)) reasons.push("Invalid artifact digest.");
  if (!requester.trim() || !approver.trim() || requester === approver) reasons.push("Independent approval required.");
  if (!checks.length || checks.some(x => !x)) reasons.push("Required checks incomplete.");
  return { allowed: reasons.length === 0, reasons };
}

/** B147 — deployment state proposals only, never invokes infrastructure. */
export type DeploymentStatus = "PROPOSED" | "PRECHECK" | "BLOCKED" | "APPROVED" | "DEPLOYING" | "VERIFYING" | "SUCCEEDED" | "FAILED" | "PAUSED" | "ROLLBACK_REQUIRED" | "ROLLED_BACK" | "CANCELLED";
const deploymentNext: Record<DeploymentStatus, DeploymentStatus[]> = {
  PROPOSED: ["PRECHECK", "CANCELLED"], PRECHECK: ["BLOCKED", "APPROVED", "CANCELLED"],
  BLOCKED: ["PRECHECK", "CANCELLED"], APPROVED: ["DEPLOYING", "CANCELLED"],
  DEPLOYING: ["VERIFYING", "FAILED", "PAUSED"],
  VERIFYING: ["SUCCEEDED", "FAILED", "PAUSED", "ROLLBACK_REQUIRED"],
  SUCCEEDED: ["ROLLBACK_REQUIRED"], FAILED: ["ROLLBACK_REQUIRED"],
  PAUSED: ["DEPLOYING", "ROLLBACK_REQUIRED", "CANCELLED"],
  ROLLBACK_REQUIRED: ["ROLLED_BACK", "FAILED"], ROLLED_BACK: [], CANCELLED: [],
};
export function deploymentTransition(current: DeploymentStatus, next: DeploymentStatus, version: number, expected: number): number {
  if (!Number.isSafeInteger(version) || version < 0 || version !== expected) throw new Error("Stale deployment version.");
  if (!deploymentNext[current].includes(next)) throw new Error("Invalid deployment transition.");
  return version + 1;
}

/** B148 — incomplete telemetry yields UNKNOWN, not healthy service. */
export function sloHealth(
  samples: Array<{ at: string; availability: number }>, nowAt: string,
  maxAgeSeconds: number, minCoverage: number, target: number,
): { status: "UNKNOWN" | "MET" | "BREACHED"; sampleCount: number; coverage: number } {
  const now = validInstant(nowAt);
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0 ||
      !Number.isFinite(minCoverage) || minCoverage <= 0 || minCoverage > 1 ||
      !Number.isFinite(target) || target <= 0 || target > 1)
    return { status: "UNKNOWN", sampleCount: 0, coverage: 0 };
  const valid = samples.filter(s => Number.isFinite(Date.parse(s.at)) && Date.parse(s.at) <= now
    && now - Date.parse(s.at) <= maxAgeSeconds * 1000 && Number.isFinite(s.availability)
    && s.availability >= 0 && s.availability <= 1);
  const coverage = samples.length ? valid.length / samples.length : 0;
  if (!valid.length || coverage < minCoverage) return { status: "UNKNOWN", sampleCount: valid.length, coverage };
  const avg = valid.reduce((sum, s) => sum + s.availability, 0) / valid.length;
  return { status: avg >= target ? "MET" : "BREACHED", sampleCount: valid.length, coverage };
}

/** B149 — evidence is required for every reported PASS. */
export type GateStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN" | "EXEMPT";
export interface Gate { key: string; mandatory: boolean; status: GateStatus; evidenceRefs: string[]; }
export function auditRelease(gates: Gate[]): { eligible: boolean; blockers: string[]; warnings: string[] } {
  const blockers: string[] = [], warnings: string[] = [];
  if (!gates.length) blockers.push("No release evidence gates.");
  for (const gate of gates) {
    if (gate.status === "PASS" && !gate.evidenceRefs.some(ref => ref.trim())) blockers.push(gate.key + ": missing evidence.");
    if (gate.mandatory && gate.status !== "PASS") blockers.push(gate.key + ": mandatory gate not passed.");
    if (!gate.mandatory && gate.status !== "PASS") warnings.push(gate.key + ": nonmandatory gate incomplete.");
  }
  return { eligible: blockers.length === 0, blockers, warnings };
}

/** B150 — no automatic GO; independent human sign-off always remains. */
export interface GoLiveGate extends Gate { exceptionExpiry?: string; independentlyApprovedException?: boolean; }
export function assessGoLive(gates: GoLiveGate[], nowAt: string):
  { decision: "NO_GO" | "ELIGIBLE_FOR_HUMAN_SIGNOFF"; blockers: string[]; warnings: string[] } {
  const base = auditRelease(gates.filter(g => g.status !== "EXEMPT"));
  const blockers = [...base.blockers], warnings = [...base.warnings];
  if (!gates.length) blockers.push("No go-live gates.");
  for (const gate of gates.filter(g => g.status === "EXEMPT")) {
    let valid = false;
    try { valid = Boolean(gate.independentlyApprovedException && gate.exceptionExpiry &&
      validInstant(gate.exceptionExpiry) > validInstant(nowAt)); } catch { /* fail closed */ }
    if (gate.mandatory && !valid) blockers.push(gate.key + ": unapproved or expired exception.");
    else warnings.push(gate.key + ": exception requires human risk review.");
  }
  return { decision: blockers.length ? "NO_GO" : "ELIGIBLE_FOR_HUMAN_SIGNOFF", blockers, warnings };
}
