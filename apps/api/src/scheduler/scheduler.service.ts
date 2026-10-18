import { Injectable, Logger } from '@nestjs/common';
import { CampaignStatus, DeviceCommandType, ScreenStatus, IncidentCategory, IncidentSeverity, IncidentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlertNotifierService } from '../notifications/alert-notifier.service';

const INTERVAL_MS = Math.max(30_000, Number(process.env.SCHEDULER_INTERVAL_MS ?? 60_000));
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly notifier: AlertNotifierService) {}

  async runOnce() {
    if (this.running) return { skipped: true, reason: 'SCHEDULER_ALREADY_RUNNING' };
    this.running = true;
    try {
      const now = new Date();
      const activated = await this.prisma.campaign.updateMany({
        where: { status: CampaignStatus.SCHEDULED, startsAt: { lte: now }, endsAt: { gt: now } },
        data: { status: CampaignStatus.ACTIVE },
      });
      const completed = await this.prisma.campaign.updateMany({
        where: { status: { in: [CampaignStatus.ACTIVE, CampaignStatus.PAUSED, CampaignStatus.SCHEDULED] }, endsAt: { lte: now } },
        data: { status: CampaignStatus.COMPLETED },
      });
      const missed = await this.prisma.campaign.updateMany({
        where: { status: CampaignStatus.SCHEDULED, startsAt: { lte: now }, endsAt: null },
        data: { status: CampaignStatus.ACTIVE },
      });
      // Re-issue refresh commands for enabled assignments only when a screen has not already got a pending refresh.
      const assignments = await this.prisma.screenPlaylistAssignment.findMany({
        where: { isEnabled: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
        select: { organizationId: true, screenId: true },
        take: 5000,
      });
      let refreshCommands = 0;
      for (const assignment of assignments) {
        const screen = await this.prisma.screen.findFirst({
          where: { id: assignment.screenId, organizationId: assignment.organizationId, status: { in: [ScreenStatus.ONLINE, ScreenStatus.OFFLINE] } },
          select: { id: true },
        });
        if (!screen) continue;
        const recentRefresh = await this.prisma.deviceCommand.findFirst({
          where: { screenId: screen.id, type: DeviceCommandType.REFRESH_PLAYLIST, requestedAt: { gt: new Date(now.getTime() - 5 * 60_000) } },
          select: { id: true },
        });
        if (recentRefresh) continue;
        await this.prisma.deviceCommand.create({
          data: {
            organizationId: assignment.organizationId, screenId: screen.id, type: DeviceCommandType.REFRESH_PLAYLIST,
            payloadJson: { reason: 'SCHEDULED_PLAYLIST_ASSIGNMENT_SYNC' }, expiresAt: new Date(now.getTime() + 10 * 60_000),
          },
        });
        refreshCommands++;
      }
      let alertIncidentsCreated = 0;
      if (process.env.ALERT_SCAN_ENABLED !== 'false') {
        const alertScreens = await this.prisma.screen.findMany({
          where: { status: { notIn: [ScreenStatus.RETIRED, ScreenStatus.SUSPENDED] } },
          select: { id: true, name: true, organizationId: true, status: true, lastHeartbeatAt: true, lastPlayerError: true, cpuPercent: true, memoryPercent: true, storagePercent: true },
          take: 5000,
        });
        const staleBefore = new Date(now.getTime() - 2 * 60_000);
        for (const screen of alertScreens) {
          const candidates: Array<{category: IncidentCategory; severity: IncidentSeverity; title: string; description: string}> = [];
          if (screen.status === ScreenStatus.OFFLINE || (screen.status === ScreenStatus.ONLINE && (!screen.lastHeartbeatAt || screen.lastHeartbeatAt < staleBefore))) {
            candidates.push({ category: IncidentCategory.SCREEN_OFFLINE, severity: IncidentSeverity.HIGH, title: `Screen offline: ${screen.name}`, description: 'Automated alert: no recent heartbeat was received.' });
          }
          if (screen.lastPlayerError) candidates.push({ category: IncidentCategory.PLAYER_ERROR, severity: IncidentSeverity.HIGH, title: `Player error: ${screen.name}`, description: screen.lastPlayerError });
          const maxResource = Math.max(screen.cpuPercent ?? 0, screen.memoryPercent ?? 0, screen.storagePercent ?? 0);
          if (maxResource >= 95) candidates.push({ category: IncidentCategory.RESOURCE_PRESSURE, severity: maxResource >= 99 ? IncidentSeverity.CRITICAL : IncidentSeverity.HIGH, title: `Resource pressure: ${screen.name}`, description: `Automated alert: reported resource pressure is at least ${maxResource}%.` });
          if (!candidates.length) continue;
          const opener = await this.prisma.user.findFirst({
            where: { organizationId: screen.organizationId, status: 'ACTIVE', roleAssignments: { some: { role: { in: [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER] } } } },
            select: { id: true },
          });
          if (!opener) { this.logger.warn(`Alert scan skipped screen ${screen.id}: no active operational user in organization.`); continue; }
          for (const candidate of candidates) {
            const existing = await this.prisma.incident.findFirst({
              where: { organizationId: screen.organizationId, screenId: screen.id, category: candidate.category, status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED, IncidentStatus.IN_PROGRESS] } },
              select: { id: true },
            });
            if (existing) continue;
            const incident = await this.prisma.incident.create({
              data: { organizationId: screen.organizationId, screenId: screen.id, openedById: opener.id, category: candidate.category, severity: candidate.severity, title: candidate.title, description: candidate.description },
              select: { id: true },
            });
            await this.prisma.auditEvent.create({
              data: { actorUserId: opener.id, organizationId: screen.organizationId, action: 'INCIDENT_AUTO_ALERT_GENERATED', entityType: 'Incident', entityId: incident.id, severity: candidate.severity === IncidentSeverity.CRITICAL ? 'CRITICAL' : 'WARNING', metadataJson: { screenId: screen.id, category: candidate.category, source: 'scheduler' } },
            });
            alertIncidentsCreated++;
            void this.notifier.notifyIncident({ incidentId: incident.id, organizationId: screen.organizationId, title: candidate.title, severity: candidate.severity, category: candidate.category, description: candidate.description, source: 'scheduled_scan' });
          }
        }
      }
      const result = { activated: activated.count + missed.count, completed: completed.count, refreshCommands, alertIncidentsCreated, ranAt: now.toISOString() };
      this.logger.log(`Scheduler cycle: ${JSON.stringify(result)}`);
      return result;
    } finally {
      this.running = false;
    }
  }

  start() {
    if (process.env.SCHEDULER_ENABLED === 'false') {
      this.logger.warn('Campaign scheduler disabled by SCHEDULER_ENABLED=false');
      return;
    }
    const timer = setInterval(() => {
      void this.runOnce().catch((error) => this.logger.error('Scheduler cycle failed', error?.stack ?? String(error)));
    }, INTERVAL_MS);
    timer.unref?.();
    void this.runOnce().catch((error) => this.logger.error('Initial scheduler cycle failed', error?.stack ?? String(error)));
    this.logger.log(`Scheduler enabled; cycle interval ${INTERVAL_MS}ms`);
  }
}
