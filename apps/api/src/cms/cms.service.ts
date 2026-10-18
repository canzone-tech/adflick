import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { AssetStatus, LayoutStatus, PlaylistStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateLayoutDto } from './dto/create-layout.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { StorageService } from './storage.service';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
]);

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  private organizationId(actor: AuthenticatedUser): string {
    if (actor.roles.includes(UserRole.SUPER_ADMIN) && !actor.organizationId) {
      throw new BadRequestException('Super Admin must select an organization context for this operation.');
    }
    if (!actor.organizationId) throw new ForbiddenException('An organization is required for this operation.');
    return actor.organizationId;
  }

  async listAssets(actor: AuthenticatedUser) {
    const organizationId = this.organizationId(actor);
    const assets = await this.prisma.mediaAsset.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, title: true, originalName: true, mimeType: true, sizeBytes: true,
        checksumSha256: true, status: true, durationMs: true, width: true, height: true,
        createdAt: true, updatedAt: true,
      },
    });
    return assets.map((asset) => ({ ...asset, sizeBytes: asset.sizeBytes.toString() }));
  }

  async createAsset(actor: AuthenticatedUser, dto: CreateAssetDto) {
    const organizationId = this.organizationId(actor);
    if (!ALLOWED_MIME.has(dto.mimeType.toLowerCase())) {
      throw new BadRequestException('Unsupported media type. Allowed: common image, video and audio formats.');
    }
    if (dto.sizeBytes > 524288000) throw new BadRequestException('Asset exceeds the 500 MiB metadata limit.');
    if (dto.checksumSha256 && !/^[a-f0-9]{64}$/i.test(dto.checksumSha256)) {
      throw new BadRequestException('checksumSha256 must be a 64-character SHA-256 hex digest.');
    }

    const safeName = dto.originalName.replace(/[^\w.\-() ]/g, '_').slice(0, 180);
    const key = `${organizationId}/incoming/${randomUUID()}${extname(safeName).toLowerCase().slice(0, 12)}`;
    const asset = await this.prisma.mediaAsset.create({
      data: {
        organizationId, uploadedById: actor.sub,
        title: dto.title.trim(), originalName: safeName,
        mimeType: dto.mimeType.toLowerCase(), sizeBytes: BigInt(dto.sizeBytes),
        checksumSha256: dto.checksumSha256?.toLowerCase(),
        storageKey: key, status: AssetStatus.UPLOADING,
      },
      select: { id: true, title: true, originalName: true, mimeType: true, sizeBytes: true, status: true, storageKey: true },
    });

    let uploadUrl: string;
    try {
      uploadUrl = await this.storage.createUploadUrl(key, asset.mimeType, dto.sizeBytes);
    } catch (error) {
      await this.prisma.mediaAsset.update({ where: { id: asset.id, organizationId }, data: { status: AssetStatus.REJECTED } });
      throw error;
    }
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: actor.sub, organizationId, action: 'MEDIA_UPLOAD_URL_CREATED',
        entityType: 'MediaAsset', entityId: asset.id,
        metadataJson: { mimeType: asset.mimeType, sizeBytes: dto.sizeBytes },
      },
    });
    return { asset: { ...asset, sizeBytes: asset.sizeBytes.toString(), storageKey: undefined }, uploadUrl, uploadMethod: 'PUT', expiresInSeconds: 300 };
  }

  async markAssetReady(actor: AuthenticatedUser, assetId: string, checksumSha256: string) {
    const organizationId = this.organizationId(actor);
    if (!/^[a-f0-9]{64}$/i.test(checksumSha256)) throw new BadRequestException('A verified SHA-256 checksum is required.');
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id: assetId, organizationId } });
    if (!asset) throw new NotFoundException('Media asset not found.');
    if (!asset.storageKey) throw new BadRequestException('Media storage key is missing.');
    // This endpoint records a claimed verification; a trusted worker must independently inspect object bytes before production use.
    const updated = await this.prisma.mediaAsset.update({
      where: { id: asset.id, organizationId },
      data: { status: AssetStatus.PROCESSING, checksumSha256: checksumSha256.toLowerCase() },
      select: { id: true, title: true, status: true, checksumSha256: true },
    });
    await this.prisma.auditEvent.create({
      data: { actorUserId: actor.sub, organizationId, action: 'MEDIA_PROCESSING_REQUESTED', entityType: 'MediaAsset', entityId: asset.id },
    });
    return updated;
  }

  async listLayouts(actor: AuthenticatedUser) {
    return this.prisma.screenLayout.findMany({
      where: { organizationId: this.organizationId(actor) },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async createLayout(actor: AuthenticatedUser, dto: CreateLayoutDto) {
    const organizationId = this.organizationId(actor);
    const width = dto.canvasWidth ?? 1920;
    const height = dto.canvasHeight ?? 1080;
    if (dto.zones.length < 1 || dto.zones.length > 20) throw new BadRequestException('A layout must contain between 1 and 20 zones.');
    const ids = new Set<string>();
    for (const zone of dto.zones) {
      if (ids.has(zone.id)) throw new BadRequestException('Zone IDs must be unique.');
      ids.add(zone.id);
      if (zone.x + zone.width > width || zone.y + zone.height > height) {
        throw new BadRequestException(`Zone "${zone.name}" extends beyond the canvas.`);
      }
    }
    const layout = await this.prisma.screenLayout.create({
      data: {
        organizationId, createdById: actor.sub,
        name: dto.name.trim(), description: dto.description,
        canvasWidth: width, canvasHeight: height,
        status: LayoutStatus.DRAFT, zonesJson: dto.zones.map(({ id, name, x, y, width, height, type }) => ({ id, name, x, y, width, height, ...(type === undefined ? {} : { type }) })),
      },
    });
    await this.prisma.auditEvent.create({
      data: { actorUserId: actor.sub, organizationId, action: 'LAYOUT_CREATED', entityType: 'ScreenLayout', entityId: layout.id },
    });
    return layout;
  }

  async publishLayout(actor: AuthenticatedUser, layoutId: string) {
    const organizationId = this.organizationId(actor);
    const layout = await this.prisma.screenLayout.findFirst({ where: { id: layoutId, organizationId } });
    if (!layout) throw new NotFoundException('Layout not found.');
    const updated = await this.prisma.screenLayout.update({
      where: { id: layout.id, organizationId },
      data: { status: LayoutStatus.PUBLISHED, version: { increment: 1 } },
    });
    await this.prisma.auditEvent.create({
      data: { actorUserId: actor.sub, organizationId, action: 'LAYOUT_PUBLISHED', entityType: 'ScreenLayout', entityId: layout.id, severity: 'WARNING' },
    });
    return updated;
  }

  async listPlaylists(actor: AuthenticatedUser) {
    return this.prisma.playlist.findMany({
      where: { organizationId: this.organizationId(actor) },
      orderBy: { updatedAt: 'desc' }, take: 200,
    });
  }

  async createPlaylist(actor: AuthenticatedUser, dto: CreatePlaylistDto) {
    const organizationId = this.organizationId(actor);
    if (dto.items.length < 1 || dto.items.length > 100) throw new BadRequestException('A playlist must contain between 1 and 100 items.');
    const ids = [...new Set(dto.items.map((item) => item.assetId))];
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: ids }, organizationId, status: AssetStatus.READY },
      select: { id: true },
    });
    const readyIds = new Set(assets.map((asset) => asset.id));
    const missing = ids.filter((id) => !readyIds.has(id));
    if (missing.length) throw new BadRequestException('Every playlist asset must exist in this organization and have READY status.');
    const items = dto.items.map((item, index) => ({ ...item, order: item.order ?? index }));
    const playlist = await this.prisma.playlist.create({
      data: {
        organizationId, createdById: actor.sub,
        name: dto.name.trim(), description: dto.description,
        status: PlaylistStatus.DRAFT, itemsJson: items,
      },
    });
    await this.prisma.auditEvent.create({
      data: { actorUserId: actor.sub, organizationId, action: 'PLAYLIST_CREATED', entityType: 'Playlist', entityId: playlist.id },
    });
    return playlist;
  }

  async activatePlaylist(actor: AuthenticatedUser, playlistId: string) {
    const organizationId = this.organizationId(actor);
    const playlist = await this.prisma.playlist.findFirst({ where: { id: playlistId, organizationId } });
    if (!playlist) throw new NotFoundException('Playlist not found.');
    const items = playlist.itemsJson as unknown as Array<{ assetId: string }>;
    const ids = [...new Set(items.map((item) => item.assetId))];
    const readyCount = await this.prisma.mediaAsset.count({ where: { id: { in: ids }, organizationId, status: AssetStatus.READY } });
    if (readyCount !== ids.length) throw new BadRequestException('Playlist contains assets that are no longer READY.');
    const updated = await this.prisma.playlist.update({ where: { id: playlist.id, organizationId }, data: { status: PlaylistStatus.ACTIVE } });
    await this.prisma.auditEvent.create({
      data: { actorUserId: actor.sub, organizationId, action: 'PLAYLIST_ACTIVATED', entityType: 'Playlist', entityId: playlist.id, severity: 'WARNING' },
    });
    return updated;
  }

  async updateAssetStatus(actor: AuthenticatedUser, assetId: string, status: AssetStatus) {
    const organizationId = this.organizationId(actor);
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id: assetId, organizationId } });
    if (!asset) throw new NotFoundException('Media asset not found.');
    if (status === AssetStatus.READY) throw new BadRequestException('READY status can only be set by a trusted media verification worker.');
    const updated = await this.prisma.mediaAsset.update({ where: { id: asset.id, organizationId }, data: { status } });
    await this.prisma.auditEvent.create({
      data: { actorUserId: actor.sub, organizationId, action: `MEDIA_STATUS_${status}`, entityType: 'MediaAsset', entityId: asset.id, severity: status === AssetStatus.REJECTED ? 'WARNING' : 'INFO' },
    });
    return updated;
  }
}
