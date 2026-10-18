import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IncidentCategory, IncidentSeverity, IncidentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { NotificationOutboxService } from '../notifications/notification-outbox.service';

const READ_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPPORT_AGENT, UserRole.AUDITOR_COMPLIANCE, UserRole.FINANCE_MANAGER];
const WRITE_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPPORT_AGENT];

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationOutboxService) {}

  private context(actor: AuthenticatedUser, write = false) {
    const allowed = write ? WRITE_ROLES : READ_ROLES;
    if (!allowed.some((r) => actor.roles.includes(r))) throw new ForbiddenException('Your role cannot access incident management.');
    if (!actor.organizationId) throw new ForbiddenException('Select an organization context before managing incidents.');
    return actor.organizationId;
  }

  async list(actor: AuthenticatedUser, status?: IncidentStatus) {
    const organizationId = this.context(actor);
    if (status && !Object.values(IncidentStatus).includes(status)) throw new BadRequestException('Invalid incident status filter.');
    return this.prisma.incident.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: { screen: { select: { id: true, name: true, status: true, platform: true } } },
    });
  }

  async summary(actor: AuthenticatedUser) {
    const organizationId = this.context(actor);
    const [open, acknowledged, inProgress, critical, resolvedToday] = await Promise.all([
      this.prisma.incident.count({ where: { organizationId, status: IncidentStatus.OPEN } }),
      this.prisma.incident.count({ where: { organizationId, status: IncidentStatus.ACKNOWLEDGED } }),
      this.prisma.incident.count({ where: { organizationId, status: IncidentStatus.IN_PROGRESS } }),
      this.prisma.incident.count({ where: { organizationId, severity: IncidentSeverity.CRITICAL, status: { notIn: [IncidentStatus.RESOLVED, IncidentStatus.DISMISSED] } } }),
      this.prisma.incident.count({ where: { organizationId, status: IncidentStatus.RESOLVED, resolvedAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
    ]);
    return { generatedAt: new Date().toISOString(), open, acknowledged, inProgress, critical, resolvedToday };
  }

  async scanAlerts(actor: AuthenticatedUser) {
    const organizationId = this.context(actor, true);
    const screens = await this.prisma.screen.findMany({
      where: { organizationId, status: { not: 'RETIRED' } },
      select: { id: true, name: true, status: true, lastHeartbeatAt: true, lastPlayerError: true, cpuPercent: true, memoryPercent: true, storagePercent: true },
      take: 500,
    });
    const created: string[] = [];
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 2 * 60_000);
    for (const screen of screens) {
      const candidates: Array<{ category: IncidentCategory; severity: IncidentSeverity; title: string; description: string }> = [];
      if (screen.status === 'OFFLINE' || (screen.status === 'ONLINE' && (!screen.lastHeartbeatAt || screen.lastHeartbeatAt < staleBefore))) {
        candidates.push({ category: IncidentCategory.SCREEN_OFFLINE, severity: IncidentSeverity.HIGH, title: `Screen offline: ${screen.name}`, description: 'No recent heartbeat was received. Verify connectivity, player process and device power.' });
      }
      if (screen.lastPlayerError) {
        candidates.push({ category: IncidentCategory.PLAYER_ERROR, severity: IncidentSeverity.HIGH, title: `Player error: ${screen.name}`, description: screen.lastPlayerError });
      }
      const maxResource = Math.max(screen.cpuPercent ?? 0, screen.memoryPercent ?? 0, screen.storagePercent ?? 0);
      if (maxResource >= 95) {
        candidates.push({ category: IncidentCategory.RESOURCE_PRESSURE, severity: maxResource >= 99 ? IncidentSeverity.CRITICAL : IncidentSeverity.HIGH, title: `Resource pressure: ${screen.name}`, description: `Reported resource pressure is at least ${maxResource}%. Check CPU, memory and disk telemetry.` });
      }
      for (const candidate of candidates) {
        const existing = await this.prisma.incident.findFirst({
          where: { organizationId, screenId: screen.id, category: candidate.category, status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED, IncidentStatus.IN_PROGRESS] } },
          select: { id: true },
        });
        if (existing) continue;
        const incident = await this.prisma.incident.create({
          data: { organizationId, screenId: screen.id, openedById: actor.sub, category: candidate.category, severity: candidate.severity, title: candidate.title, description: candidate.description },
          select: { id: true },
        });
        created.push(incident.id);
        await this.notifications.enqueueIncident({ incidentId: incident.id, organizationId, title: candidate.title, severity: candidate.severity, category: candidate.category, description: candidate.description, source: 'operator_scan' });
        await this.prisma.auditEvent.create({
          data: { actorUserId: actor.sub, organizationId, action: 'INCIDENT_ALERT_GENERATED', entityType: 'Incident', entityId: incident.id, severity: candidate.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING', metadataJson: { screenId: screen.id, category: candidate.category } },
        });
      }
    }
    return { scannedScreens: screens.length, incidentsCreated: created.length, incidentIds: created, generatedAt: now.toISOString() };
  }

  async create(actor: AuthenticatedUser, dto: CreateIncidentDto) {
    const organizationId = this.context(actor, true);
    if (dto.screenId) {
      const screen = await this.prisma.screen.findFirst({ where: { id: dto.screenId, organizationId }, select: { id: true } });
      if (!screen) throw new NotFoundException('Screen not found in this organization.');
    }
    const incident = await this.prisma.incident.create({
      data: {
        organizationId, screenId: dto.screenId, title: dto.title.trim(),
        description: dto.description?.trim(), category: dto.category ?? 'OTHER',
        severity: dto.severity ?? 'MEDIUM', openedById: actor.sub,
      },
      include: { screen: { select: { id: true, name: true, status: true, platform: true } } },
    });
    await this.prisma.auditEvent.create({
      data: { actorUserId: actor.sub, organizationId, action: 'INCIDENT_CREATED', entityType: 'Incident', entityId: incident.id, severity: incident.severity === 'CRITICAL' ? 'CRITICAL' : incident.severity === 'HIGH' ? 'WARNING' : 'INFO', metadataJson: { category: incident.category, screenId: incident.screenId } },
    });
    await this.notifications.enqueueIncident({ incidentId: incident.id, organizationId, title: incident.title, severity: incident.severity, category: incident.category, description: incident.description, source: 'manual' });
    return incident;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateIncidentDto) {
    const organizationId = this.context(actor, true);
    const current = await this.prisma.incident.findFirst({ where: { id, organizationId } });
    if (!current) throw new NotFoundException('Incident not found.');
    if (current.status === IncidentStatus.DISMISSED || current.status === IncidentStatus.RESOLVED) {
      throw new BadRequestException('Resolved or dismissed incidents are read-only; create a follow-up incident instead.');
    }
    if (dto.status === IncidentStatus.RESOLVED && !dto.resolutionNote?.trim() && !current.resolutionNote) {
      throw new BadRequestException('A resolution note is required before resolving an incident.');
    }
    if (dto.assignedToId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assignedToId, organizationId, status: 'ACTIVE' }, select: { id: true },
      });
      if (!assignee) throw new BadRequestException('Assignee must be an active user in this organization.');
    }
    const now = new Date();
    const updated = await this.prisma.incident.update({
      where: { id, organizationId },
      data: {
        status: dto.status,
        severity: dto.severity,
        assignedToId: dto.assignedToId,
        resolutionNote: dto.resolutionNote?.trim(),
        acknowledgedAt: dto.status === IncidentStatus.ACKNOWLEDGED && !current.acknowledgedAt ? now : undefined,
        resolvedAt: dto.status === IncidentStatus.RESOLVED ? now : dto.status ? null : undefined,
      },
      include: { screen: { select: { id: true, name: true, status: true, platform: true } } },
    });
    await this.prisma.auditEvent.create({
      data: { actorUserId: actor.sub, organizationId, action: 'INCIDENT_UPDATED', entityType: 'Incident', entityId: id, severity: 'INFO', metadataJson: { previousStatus: current.status, status: updated.status, assignedToId: updated.assignedToId } },
    });
    return updated;
  }
}
