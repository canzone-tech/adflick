import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { CampaignStatus, AssetStatus, ScreenStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../cms/storage.service';

const MANIFEST_TTL_MS = 5 * 60 * 1000;
const GRANT_TTL_MS = 20 * 60 * 1000;
@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}
  private hash(v: string) { return createHash('sha256').update(v).digest('hex'); }

  private async authenticate(screenId: string, secret: string) {
    if (!secret || secret.length < 20 || secret.length > 256) throw new ForbiddenException('Invalid device credentials.');
    const screen = await this.prisma.screen.findUnique({ where: { id: screenId } });
    if (!screen || !screen.deviceKeyHash || new Set<ScreenStatus>([ScreenStatus.SUSPENDED, ScreenStatus.RETIRED, ScreenStatus.PENDING_PAIRING]).has(screen.status)) {
      throw new ForbiddenException('Device is not authorized for delivery.');
    }
    const actual = Buffer.from(this.hash(secret), 'hex');
    const expected = Buffer.from(screen.deviceKeyHash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ForbiddenException('Invalid device credentials.');
    return screen;
  }

  async getManifest(screenId: string, secret: string) {
    const screen = await this.authenticate(screenId, secret);
    const now = new Date();
    // Keep the authorization table bounded without deleting records still inside the retry window.
    await this.prisma.playbackAuthorization.deleteMany({
      where: { screenId, OR: [{ expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }, { consumedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }] },
    });
    const until = new Date(now.getTime() + MANIFEST_TTL_MS);
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        organizationId: screen.organizationId,
        status: CampaignStatus.ACTIVE,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          { OR: [{ screenTargets: { none: {} } }, { screenTargets: { some: { screenId } } }] },
        ],
      },
      include: {
        creatives: { orderBy: { sortOrder: 'asc' }, include: { asset: { select: { id: true, title: true, mimeType: true, durationMs: true, width: true, height: true, storageKey: true, status: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    const entries: Array<Record<string, unknown>> = [];
    for (const campaign of campaigns) {
      for (const creative of campaign.creatives) {
        const asset = creative.asset;
        if (asset.status !== AssetStatus.READY || !asset.storageKey) continue;
        let mediaUrl: string;
        try { mediaUrl = await this.storage.createDownloadUrl(asset.storageKey); }
        catch { throw new ServiceUnavailableException('Media storage is unavailable; delivery manifest was not issued.'); }
        const token = randomBytes(32).toString('base64url');
        const expiresAt = new Date(Math.min(until.getTime(), now.getTime() + GRANT_TTL_MS));
        const grant = await this.prisma.playbackAuthorization.create({
          data: {
            organizationId: screen.organizationId, screenId, assetId: asset.id, campaignId: campaign.id,
            tokenHash: this.hash(token), expiresAt,
          },
          select: { id: true, expiresAt: true },
        });
        entries.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          asset: { id: asset.id, title: asset.title, mimeType: asset.mimeType, durationMs: asset.durationMs, width: asset.width, height: asset.height, mediaUrl },
          authorization: { id: grant.id, token, expiresAt: grant.expiresAt.toISOString() },
        });
      }
    }
    const assignments = await this.prisma.screenPlaylistAssignment.findMany({
      where: {
        organizationId: screen.organizationId, screenId, isEnabled: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
        playlist: { organizationId: screen.organizationId, status: 'ACTIVE' },
      },
      include: { playlist: { select: { id: true, name: true, itemsJson: true } } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });
    for (const assignment of assignments) {
      const items = assignment.playlist.itemsJson as unknown as Array<{ assetId?: string; durationMs?: number }>;
      if (!Array.isArray(items)) continue;
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (!item?.assetId) continue;
        const asset = await this.prisma.mediaAsset.findFirst({
          where: { id: item.assetId, organizationId: screen.organizationId, status: AssetStatus.READY, storageKey: { not: null } },
          select: { id: true, title: true, mimeType: true, durationMs: true, width: true, height: true, storageKey: true },
        });
        if (!asset?.storageKey) continue;
        let mediaUrl: string;
        try { mediaUrl = await this.storage.createDownloadUrl(asset.storageKey); }
        catch { throw new ServiceUnavailableException('Media storage is unavailable; delivery manifest was not issued.'); }
        const token = randomBytes(32).toString('base64url');
        const expiresAt = new Date(Math.min(until.getTime(), now.getTime() + GRANT_TTL_MS));
        const grant = await this.prisma.playbackAuthorization.create({
          data: {
            organizationId: screen.organizationId, screenId, assetId: asset.id, playlistId: assignment.playlistId,
            tokenHash: this.hash(token), expiresAt,
          },
          select: { id: true, expiresAt: true },
        });
        entries.push({
          source: 'PLAYLIST',
          playlistId: assignment.playlistId,
          playlistName: assignment.playlist.name,
          playlistPriority: assignment.priority,
          playlistOrder: index,
          asset: { id: asset.id, title: asset.title, mimeType: asset.mimeType, durationMs: asset.durationMs ?? item.durationMs, width: asset.width, height: asset.height, mediaUrl },
          authorization: { id: grant.id, token, expiresAt: grant.expiresAt.toISOString() },
        });
      }
    }
    return {
      schemaVersion: 1,
      screen: { id: screen.id, name: screen.name, platform: screen.devicePlatform ?? screen.platform },
      generatedAt: now.toISOString(),
      expiresAt: until.toISOString(),
      refreshAfterSeconds: 60,
      entries,
      policy: { requireAuthorizationForPlaybackEvents: true, minimumCompletionRatio: 0.9, note: 'Manifest entries authorize telemetry only; player-reported events are not cryptographic proof of actual display.' },
    };
  }
}
