import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  DeviceCommandStatus, DeviceCommandType, PairingCodeStatus, ScreenStatus, UserRole, Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateScreenDto } from './dto/create-screen.dto';
import { PairDeviceDto } from './dto/pair-device.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { CreateCommandDto } from './dto/create-command.dto';
import { CommandResultDto } from './dto/command-result.dto';

function isJsonSafeValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonSafeValue);
  if (value === null || typeof value !== 'object') return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every(isJsonSafeValue);
}
function isInputJsonObject(value: unknown): value is Prisma.InputJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(isJsonSafeValue);
}

const FLEET_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN,
  UserRole.OPERATIONS_MANAGER, UserRole.SUPPORT_AGENT, UserRole.AUDITOR_COMPLIANCE,
];
const COMMAND_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER];

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private org(actor: AuthenticatedUser): string {
    if (!actor.organizationId) throw new ForbiddenException('Select an organization context before managing devices.');
    return actor.organizationId;
  }

  private requireRole(actor: AuthenticatedUser, roles: UserRole[]) {
    if (!roles.some((role) => actor.roles.includes(role))) {
      throw new ForbiddenException('Your role cannot perform this device operation.');
    }
  }

  async createScreen(actor: AuthenticatedUser, dto: CreateScreenDto) {
    this.requireRole(actor, FLEET_ROLES);
    const organizationId = this.org(actor);
    if (dto.ownerUserId) {
      const owner = await this.prisma.user.findFirst({
        where: { id: dto.ownerUserId, organizationId, status: 'ACTIVE',
          roleAssignments: { some: { role: UserRole.SCREEN_OWNER } } },
        select: { id: true },
      });
      if (!owner) throw new BadRequestException('Screen owner must be an active SCREEN_OWNER in this organization.');
    }
    if (dto.externalCode) {
      const existing = await this.prisma.screen.findUnique({ where: { externalCode: dto.externalCode } });
      if (existing) throw new BadRequestException('externalCode is already in use.');
    }
    const screen = await this.prisma.screen.create({
      data: {
        organizationId, ownerUserId: dto.ownerUserId,
        name: dto.name.trim(), platform: dto.platform.trim(),
        externalCode: dto.externalCode?.trim() || undefined,
        timezone: dto.timezone || 'Asia/Kolkata',
        status: ScreenStatus.PENDING_PAIRING,
      },
      select: { id: true, name: true, platform: true, externalCode: true, timezone: true, status: true, createdAt: true },
    });
    const code = randomBytes(6).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.devicePairingCode.create({
      data: {
        organizationId, screenId: screen.id, codeHash: this.hash(code),
        expiresAt, createdById: actor.sub,
      },
    });
    await this.prisma.auditEvent.create({
      data: { actorUserId: actor.sub, organizationId, action: 'DEVICE_REGISTERED', entityType: 'Screen', entityId: screen.id },
    });
    // Code is shown once. Store only its hash.
    return { screen, pairingCode: code, expiresAt, instructions: 'Enter this one-time code in the player within 10 minutes. The code will not be shown again.' };
  }

  async listScreens(actor: AuthenticatedUser) {
    this.requireRole(actor, FLEET_ROLES);
    const organizationId = this.org(actor);
    const now = new Date();
    // Mark stale ONLINE screens offline; this is also performed during list refresh as a safety net.
    await this.prisma.screen.updateMany({
      where: { organizationId, status: ScreenStatus.ONLINE, OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: new Date(now.getTime() - 2 * 60 * 1000) } }] },
      data: { status: ScreenStatus.OFFLINE },
    });
    return this.prisma.screen.findMany({
      where: { organizationId, status: { not: ScreenStatus.RETIRED } },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      take: 500,
      select: {
        id: true, name: true, platform: true, devicePlatform: true, playerVersion: true,
        externalCode: true, timezone: true, status: true, lastSeenAt: true,
        lastHeartbeatAt: true, lastIpAddress: true, cpuPercent: true, memoryPercent: true,
        storagePercent: true, lastSyncAt: true, lastPlayerError: true, ownerUserId: true, createdAt: true,
      },
    });
  }

  async healthSummary(actor: AuthenticatedUser) {
    this.requireRole(actor, FLEET_ROLES);
    const organizationId = this.org(actor);
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 2 * 60_000);
    const [total, online, offline, maintenance, unhealthy, recentCommands, failedCommands] = await Promise.all([
      this.prisma.screen.count({ where: { organizationId, status: { not: ScreenStatus.RETIRED } } }),
      this.prisma.screen.count({ where: { organizationId, status: ScreenStatus.ONLINE, lastHeartbeatAt: { gte: staleBefore } } }),
      this.prisma.screen.count({ where: { organizationId, status: ScreenStatus.OFFLINE } }),
      this.prisma.screen.count({ where: { organizationId, status: ScreenStatus.MAINTENANCE } }),
      this.prisma.screen.count({ where: { organizationId, status: { not: ScreenStatus.RETIRED }, OR: [{ lastPlayerError: { not: null } }, { cpuPercent: { gte: 95 } }, { memoryPercent: { gte: 95 } }, { storagePercent: { gte: 95 } }] } }),
      this.prisma.deviceCommand.count({ where: { organizationId, requestedAt: { gte: new Date(now.getTime() - 24 * 60 * 60_000) } } }),
      this.prisma.deviceCommand.count({ where: { organizationId, status: DeviceCommandStatus.FAILED, requestedAt: { gte: new Date(now.getTime() - 24 * 60 * 60_000) } } }),
    ]);
    return { generatedAt: now.toISOString(), heartbeatStaleAfterSeconds: 120, screens: { total, online, offline, maintenance, unhealthy }, commandsLast24Hours: recentCommands, failedCommandsLast24Hours: failedCommands };
  }

  async pair(dto: PairDeviceDto) {
    const codeHash = this.hash(dto.code);
    const pairing = await this.prisma.devicePairingCode.findUnique({
      where: { codeHash },
      include: { screen: true },
    });
    const now = new Date();
    if (!pairing || pairing.status !== PairingCodeStatus.ACTIVE || pairing.expiresAt <= now || pairing.screen.status !== ScreenStatus.PENDING_PAIRING) {
      throw new UnauthorizedException('Pairing code is invalid, expired or already used.');
    }
    if (dto.deviceSecret.length < 20 || dto.deviceSecret.length > 256) throw new BadRequestException('Device secret length is invalid.');
    const deviceKeyHash = this.hash(dto.deviceSecret);
    const nextStatus = ScreenStatus.OFFLINE;
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.devicePairingCode.updateMany({
        where: { id: pairing.id, status: PairingCodeStatus.ACTIVE, expiresAt: { gt: now } },
        data: { status: PairingCodeStatus.CONSUMED, consumedAt: now },
      });
      if (consumed.count !== 1) throw new UnauthorizedException('Pairing code has already been used.');
      await tx.devicePairingCode.updateMany({
        where: { screenId: pairing.screenId, status: PairingCodeStatus.ACTIVE, id: { not: pairing.id } },
        data: { status: PairingCodeStatus.REVOKED },
      });
      await tx.screen.update({
        where: { id: pairing.screenId },
        data: {
          deviceKeyHash, devicePlatform: dto.platform, playerVersion: dto.playerVersion,
          status: nextStatus, lastSeenAt: now,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: pairing.organizationId, action: 'DEVICE_PAIRED',
          entityType: 'Screen', entityId: pairing.screenId,
          metadataJson: { platform: dto.platform, playerVersion: dto.playerVersion },
        },
      });
    });
    return { success: true, screenId: pairing.screenId, message: 'Device paired. Store the device secret securely; it cannot be retrieved from the server.' };
  }

  private async authenticateDevice(screenId: string, rawSecret: string) {
    if (!rawSecret || rawSecret.length < 20 || rawSecret.length > 256) throw new UnauthorizedException('Device credentials are invalid.');
    const screen = await this.prisma.screen.findUnique({
      where: { id: screenId },
      select: { id: true, organizationId: true, status: true, deviceKeyHash: true },
    });
    if (!screen || !screen.deviceKeyHash || screen.status === ScreenStatus.SUSPENDED || screen.status === ScreenStatus.RETIRED) {
      throw new UnauthorizedException('Device is not authorized.');
    }
    const actual = Buffer.from(this.hash(rawSecret), 'hex');
    const expected = Buffer.from(screen.deviceKeyHash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new UnauthorizedException('Device credentials are invalid.');
    return screen;
  }

  async heartbeat(screenId: string, rawSecret: string, dto: HeartbeatDto, ip?: string) {
    const screen = await this.authenticateDevice(screenId, rawSecret);
    const now = new Date();
    const capabilities = dto.capabilities;
    if (capabilities !== undefined && !isInputJsonObject(capabilities)) {
      throw new BadRequestException('Device capabilities must be a JSON object of finite, JSON-safe values.');
    }
    const updated = await this.prisma.screen.update({
      where: { id: screen.id },
      data: {
        status: screen.status === ScreenStatus.MAINTENANCE ? ScreenStatus.MAINTENANCE : ScreenStatus.ONLINE,
        devicePlatform: dto.platform, playerVersion: dto.playerVersion,
        lastHeartbeatAt: now, lastSeenAt: now, lastIpAddress: (ip || dto.ipAddress)?.slice(0, 45),
        cpuPercent: dto.cpuPercent, memoryPercent: dto.memoryPercent, storagePercent: dto.storagePercent,
        capabilitiesJson: capabilities,
        lastSyncAt: dto.syncStatus === 'SYNCED' ? now : undefined,
        lastPlayerError: dto.playerError ? dto.playerError.slice(0, 500) : null,
      },
      select: { id: true, status: true, lastHeartbeatAt: true, playerVersion: true, cpuPercent: true, memoryPercent: true, storagePercent: true, lastSyncAt: true },
    });
    return { success: true, screen: updated, serverTime: now.toISOString(), manifestVersion: dto.manifestVersion ?? null };
  }

  async deviceCommands(screenId: string, rawSecret: string) {
    const screen = await this.authenticateDevice(screenId, rawSecret);
    const now = new Date();
    await this.prisma.deviceCommand.updateMany({
      where: { screenId: screen.id, status: DeviceCommandStatus.PENDING, expiresAt: { lte: now } },
      data: { status: DeviceCommandStatus.EXPIRED },
    });
    // Commands are idempotent: players must deduplicate by command ID. Retry delivery
    // after 30 seconds, cap deliveries, and stop retrying expired commands.
    await this.prisma.deviceCommand.updateMany({
      where: { screenId: screen.id, status: DeviceCommandStatus.PENDING, expiresAt: { gt: now }, deliveryCount: { gte: 10 } },
      data: { status: DeviceCommandStatus.FAILED, lastError: 'DELIVERY_RETRY_LIMIT_REACHED' },
    });
    const due = await this.prisma.deviceCommand.findMany({
      where: {
        screenId: screen.id, status: DeviceCommandStatus.PENDING, expiresAt: { gt: now }, deliveryCount: { lt: 10 },
        OR: [{ lastDeliveredAt: null }, { lastDeliveredAt: { lt: new Date(now.getTime() - 30_000) } }],
      },
      orderBy: { requestedAt: 'asc' }, take: 50,
      select: { id: true, type: true, payloadJson: true, requestedAt: true, expiresAt: true, deliveryCount: true },
    });
    const delivered = [];
    for (const command of due) {
      const claimed = await this.prisma.deviceCommand.updateMany({
        where: { id: command.id, status: DeviceCommandStatus.PENDING, deliveryCount: command.deliveryCount },
        data: { deliveryCount: { increment: 1 }, lastDeliveredAt: now },
      });
      if (claimed.count === 1) delivered.push({ id: command.id, type: command.type, payloadJson: command.payloadJson, requestedAt: command.requestedAt, expiresAt: command.expiresAt, deliveryAttempt: command.deliveryCount + 1 });
    }
    return delivered;
  }

  async reportCommand(screenId: string, rawSecret: string, commandId: string, dto: CommandResultDto) {
    const screen = await this.authenticateDevice(screenId, rawSecret);
    const command = await this.prisma.deviceCommand.findFirst({
      where: { id: commandId, screenId: screen.id, status: DeviceCommandStatus.PENDING, expiresAt: { gt: new Date() } },
      select: { id: true, organizationId: true },
    });
    if (!command) throw new NotFoundException('Pending command not found or expired.');
    const updated = await this.prisma.deviceCommand.update({
      where: { id: command.id },
      data: {
        status: dto.status === 'ACKNOWLEDGED' ? DeviceCommandStatus.ACKNOWLEDGED : DeviceCommandStatus.FAILED,
        acknowledgedAt: new Date(),
        lastError: dto.status === 'FAILED' ? (dto.errorMessage ?? 'PLAYER_REPORTED_COMMAND_FAILURE').slice(0, 500) : null,
        resultJson: dto.result ? { ...dto.result, errorMessage: dto.errorMessage } : dto.errorMessage ? { errorMessage: dto.errorMessage } : undefined,
      },
      select: { id: true, status: true, acknowledgedAt: true },
    });
    return updated;
  }

  async createCommand(actor: AuthenticatedUser, screenId: string, dto: CreateCommandDto) {
    this.requireRole(actor, COMMAND_ROLES);
    const organizationId = this.org(actor);
    const screen = await this.prisma.screen.findFirst({
      where: { id: screenId, organizationId, status: { notIn: [ScreenStatus.RETIRED, ScreenStatus.SUSPENDED] } },
      select: { id: true, status: true },
    });
    if (!screen) throw new NotFoundException('Screen not found.');
    const payload = dto.payload ?? {};
    if (!isInputJsonObject(payload)) throw new BadRequestException('Device command payload must be a JSON-compatible object.');
    if (dto.type === DeviceCommandType.SET_VOLUME) {
      const volume = payload.volume;
      if (typeof volume !== 'number' || !Number.isInteger(volume) || volume < 0 || volume > 100) {
        throw new BadRequestException('SET_VOLUME requires payload.volume as an integer from 0 to 100.');
      }
    }
    const ttlSeconds = dto.ttlSeconds ?? 300;
    const command = await this.prisma.deviceCommand.create({
      data: {
        organizationId, screenId, type: dto.type, payloadJson: payload,
        requestedById: actor.sub, expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
      select: { id: true, screenId: true, type: true, payloadJson: true, status: true, requestedAt: true, expiresAt: true },
    });
    await this.prisma.auditEvent.create({
      data: { actorUserId: actor.sub, organizationId, action: 'DEVICE_COMMAND_QUEUED', entityType: 'DeviceCommand', entityId: command.id, metadataJson: { screenId, type: dto.type } },
    });
    return command;
  }

  async setScreenStatus(actor: AuthenticatedUser, screenId: string, status: 'SUSPENDED'|'RETIRED'|'OFFLINE') {
    this.requireRole(actor, COMMAND_ROLES);
    const organizationId = this.org(actor);
    const screen = await this.prisma.screen.findFirst({ where: { id: screenId, organizationId } });
    if (!screen) throw new NotFoundException('Screen not found.');
    const updated = await this.prisma.screen.update({
      where: { id: screen.id, organizationId },
      data: { status: status as ScreenStatus },
      select: { id: true, name: true, status: true },
    });
    if (status === 'SUSPENDED' || status === 'RETIRED') {
      await this.prisma.devicePairingCode.updateMany({ where: { screenId, status: PairingCodeStatus.ACTIVE }, data: { status: PairingCodeStatus.REVOKED } });
    }
    await this.prisma.auditEvent.create({
      data: { actorUserId: actor.sub, organizationId, action: `DEVICE_STATUS_${status}`, entityType: 'Screen', entityId: screen.id, severity: 'WARNING' },
    });
    return updated;
  }
}
