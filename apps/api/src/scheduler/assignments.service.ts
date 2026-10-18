import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PlaylistStatus, ScreenStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AssignPlaylistDto } from './dto/assign-playlist.dto';

const WRITE_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.CONTENT_MANAGER];
const READ_ROLES = [...WRITE_ROLES, UserRole.AUDITOR_COMPLIANCE, UserRole.SUPPORT_AGENT];
@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}
  private org(actor: AuthenticatedUser) {
    if (!actor.organizationId) throw new ForbiddenException('Organization context is required.');
    return actor.organizationId;
  }
  private role(actor: AuthenticatedUser, roles: UserRole[]) {
    if (!actor.roles.some((r) => roles.includes(r as UserRole))) throw new ForbiddenException('Your role cannot perform this operation.');
  }
  async list(actor: AuthenticatedUser, screenId: string) {
    this.role(actor, READ_ROLES);
    const organizationId = this.org(actor);
    const screen = await this.prisma.screen.findFirst({ where: { id: screenId, organizationId }, select: { id: true } });
    if (!screen) throw new NotFoundException('Screen not found.');
    return this.prisma.screenPlaylistAssignment.findMany({
      where: { organizationId, screenId },
      include: { playlist: { select: { id: true, name: true, status: true, updatedAt: true } } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }
  async assign(actor: AuthenticatedUser, screenId: string, dto: AssignPlaylistDto) {
    this.role(actor, WRITE_ROLES);
    const organizationId = this.org(actor);
    const [screen, playlist] = await Promise.all([
      this.prisma.screen.findFirst({ where: { id: screenId, organizationId, status: { not: ScreenStatus.RETIRED } }, select: { id: true } }),
      this.prisma.playlist.findFirst({ where: { id: dto.playlistId, organizationId, status: PlaylistStatus.ACTIVE }, select: { id: true } }),
    ]);
    if (!screen) throw new NotFoundException('Eligible screen not found.');
    if (!playlist) throw new BadRequestException('Playlist must be ACTIVE and belong to this organization.');
    if (dto.startsAt && dto.endsAt && new Date(dto.endsAt) <= new Date(dto.startsAt)) throw new BadRequestException('Assignment end must be after start.');
    const now = new Date();
    const assignment = await this.prisma.screenPlaylistAssignment.upsert({
      where: { screenId_playlistId: { screenId, playlistId: playlist.id } },
      create: {
        organizationId, screenId, playlistId: playlist.id, priority: dto.priority ?? 100,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null, assignedById: actor.sub, isEnabled: true,
      },
      update: {
        priority: dto.priority ?? 100, startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null, isEnabled: true, assignedById: actor.sub,
      },
    });
    await this.prisma.deviceCommand.create({
      data: {
        organizationId, screenId, type: 'REFRESH_PLAYLIST',
        payloadJson: { reason: 'PLAYLIST_ASSIGNMENT_CHANGED', assignmentId: assignment.id },
        expiresAt: new Date(now.getTime() + 10 * 60_000),
      },
    });
    return assignment;
  }
  async disable(actor: AuthenticatedUser, screenId: string, assignmentId: string) {
    this.role(actor, WRITE_ROLES);
    const organizationId = this.org(actor);
    const assignment = await this.prisma.screenPlaylistAssignment.findFirst({ where: { id: assignmentId, screenId, organizationId }, select: { id: true } });
    if (!assignment) throw new NotFoundException('Playlist assignment not found.');
    const updated = await this.prisma.screenPlaylistAssignment.update({ where: { id: assignment.id, organizationId }, data: { isEnabled: false } });
    await this.prisma.deviceCommand.create({
      data: { organizationId, screenId, type: 'REFRESH_PLAYLIST', payloadJson: { reason: 'PLAYLIST_ASSIGNMENT_DISABLED', assignmentId }, expiresAt: new Date(Date.now() + 10 * 60_000) },
    });
    return updated;
  }
}
