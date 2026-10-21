export interface PendingCommandSummary {
  commandId: string;
  type: string;
  expiresAt: Date;
  status: string;
}

export function filterRecoverableCommands(commands: PendingCommandSummary[], now: Date, maxItems = 100): PendingCommandSummary[] {
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 500) throw new Error("INVALID_RECOVERY_LIMIT");
  return commands
    .filter(c => c.expiresAt > now && ["QUEUED", "DISPATCHED", "ACKNOWLEDGED"].includes(c.status))
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
    .slice(0, maxItems);
}

export function shouldApplyCommand(input: { alreadyProcessed: boolean; authenticatedDevice: boolean; tenantMatches: boolean; notExpired: boolean }): boolean {
  return input.authenticatedDevice && input.tenantMatches && input.notExpired && !input.alreadyProcessed;
}
