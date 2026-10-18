import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma, AssetStatus, PlaybackEventStatus, PlaybackEventType, ScreenStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PlaybackEventDto } from './dto/playback-event.dto';

const MIN_COMPLETION_RATIO = 0.9;
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

@Injectable()
export class PlaybackService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(v: string) { return createHash('sha256').update(v).digest('hex'); }

  private async device(screenId: string, secret: string) {
    if (!secret || secret.length < 20 || secret.length > 256) throw new ForbiddenException('Invalid device credentials.');
    const screen = await this.prisma.screen.findUnique({ where: { id: screenId } });
    if (!screen || !screen.deviceKeyHash || [ScreenStatus.SUSPENDED, ScreenStatus.RETIRED].includes(screen.status)) {
      throw new ForbiddenException('Device is not authorized.');
    }
    const actual=Buffer.from(this.hash(secret),'hex');
    const expected=Buffer.from(screen.deviceKeyHash,'hex');
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected)) throw new ForbiddenException('Invalid device credentials.');
    return screen;
  }

  private async validateEvent(screen: any, event: PlaybackEventDto) {
    if (!event.authorizationId || !event.authorizationToken) {
      return { ok: false, reason: 'SERVER_ISSUED_PLAYBACK_AUTHORIZATION_REQUIRED' };
    }
    const grant = await this.prisma.playbackAuthorization.findFirst({
      where: {
        id: event.authorizationId, screenId: screen.id, organizationId: screen.organizationId,
        assetId: event.assetId, campaignId: event.campaignId ?? null, playlistId: event.playlistId ?? null,
        tokenHash: this.hash(event.authorizationToken), expiresAt: { gt: new Date() },
        consumedAt: null,
      },
      select: { id: true },
    });
    if (!grant) return { ok: false, reason: 'PLAYBACK_AUTHORIZATION_INVALID_EXPIRED_OR_CONSUMED' };
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: event.assetId, organizationId: screen.organizationId, status: AssetStatus.READY },
      select: { id: true, durationMs: true },
    });
    if (!asset) return { ok: false, reason: 'ASSET_NOT_READY_OR_OUTSIDE_ORGANIZATION' };
    let playlistExpectedDuration: number | undefined;
    if (event.campaignId) {
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: event.campaignId, organizationId: screen.organizationId },
        select: { id: true, status: true, startsAt: true, endsAt: true },
      });
      if (!campaign) return { ok: false, reason: 'CAMPAIGN_NOT_FOUND_IN_ORGANIZATION' };
      if (!['APPROVED','SCHEDULED','ACTIVE','COMPLETED'].includes(campaign.status)) return { ok: false, reason: 'CAMPAIGN_NOT_APPROVED' };
      if (campaign.startsAt && event.completedAt && new Date(event.completedAt) < campaign.startsAt) return { ok: false, reason: 'PLAY_BEFORE_CAMPAIGN_START' };
      if (campaign.endsAt && event.completedAt && new Date(event.completedAt) > campaign.endsAt) return { ok: false, reason: 'PLAY_AFTER_CAMPAIGN_END' };
    }
    if (event.playlistId) {
      const playlist = await this.prisma.playlist.findFirst({
        where: { id: event.playlistId, organizationId: screen.organizationId, status: 'ACTIVE' },
        select: { id: true, itemsJson: true },
      });
      if (!playlist) return { ok: false, reason: 'PLAYLIST_NOT_ACTIVE_OR_OUTSIDE_ORGANIZATION' };
      const items = playlist.itemsJson as unknown as Array<{assetId?: string; durationMs?: number}>;
      const playlistItem = Array.isArray(items) ? items.find((i) => i.assetId === event.assetId) : undefined;
      if (!playlistItem) return { ok: false, reason: 'ASSET_NOT_IN_PLAYLIST' };
      if (typeof playlistItem.durationMs === 'number' && Number.isInteger(playlistItem.durationMs) && playlistItem.durationMs > 0) {
        playlistExpectedDuration = playlistItem.durationMs;
      }
    }
    if (event.eventType === PlaybackEventType.PLAY_COMPLETED) {
      if (!event.startedAt || !event.completedAt || event.durationMs === undefined) return { ok: false, reason: 'COMPLETION_REQUIRES_START_END_AND_DURATION' };
      const started = new Date(event.startedAt).getTime();
      const completed = new Date(event.completedAt).getTime();
      const now = Date.now();
      if (completed < started || completed - started > 24 * 60 * 60 * 1000) return { ok: false, reason: 'INVALID_PLAYBACK_TIME_RANGE' };
      if (started < now - MAX_EVENT_AGE_MS || completed > now + FUTURE_CLOCK_SKEW_MS) return { ok: false, reason: 'EVENT_OUTSIDE_ACCEPTED_TIME_WINDOW' };
      const expected = asset.durationMs ?? playlistExpectedDuration;
      if (!expected) return { ok: false, reason: 'SERVER_KNOWN_EXPECTED_DURATION_REQUIRED' };
      if (event.expectedDurationMs !== undefined && event.expectedDurationMs !== expected) return { ok: false, reason: 'CLIENT_EXPECTED_DURATION_MISMATCH' };
      if (event.durationMs < Math.floor(expected * MIN_COMPLETION_RATIO)) return { ok: false, reason: 'PLAYBACK_BELOW_MINIMUM_COMPLETION_RATIO' };
      if (Math.abs((completed-started)-event.durationMs) > Math.max(5000, Math.floor(event.durationMs * 0.15))) return { ok: false, reason: 'DURATION_DOES_NOT_MATCH_TIMESTAMPS' };
    }
    if (event.eventType === PlaybackEventType.PLAY_STARTED && !event.startedAt) return { ok: false, reason: 'START_EVENT_REQUIRES_STARTED_AT' };
    return { ok: true, reason: 'VALIDATION_RULES_PASSED' };
  }

  async ingestBatch(screenId: string, secret: string, events: PlaybackEventDto[]) {
    const screen = await this.device(screenId, secret);
    const results: Array<{eventId:string;status:string;reason?:string;countedForEligibility:boolean}> = [];
    for (const event of events) {
      const existing = await this.prisma.playbackEvent.findUnique({
        where: { screenId_eventId: { screenId, eventId: event.eventId } },
        select: { id: true, status: true, validationReason: true },
      });
      if (existing) {
        results.push({ eventId: event.eventId, status: 'DUPLICATE', reason: 'EVENT_ID_ALREADY_RECEIVED', countedForEligibility: false });
        continue;
      }
      if (event.sequenceNumber !== undefined && !/^\d+$/.test(event.sequenceNumber)) {
        results.push({ eventId: event.eventId, status: 'REJECTED', reason: 'INVALID_SEQUENCE_NUMBER', countedForEligibility: false });
        continue;
      }
      const validation = await this.validateEvent(screen, event);
      const status = validation.ok ? PlaybackEventStatus.ACCEPTED : PlaybackEventStatus.REJECTED;
      const seq = event.sequenceNumber && /^\d+$/.test(event.sequenceNumber) ? BigInt(event.sequenceNumber) : undefined;
      try {
        const saved = await this.prisma.playbackEvent.create({
          data: {
            organizationId: screen.organizationId, screenId, assetId: event.assetId,
            campaignId: event.campaignId, playlistId: event.playlistId, authorizationId: event.authorizationId,
            eventId: event.eventId, eventType: event.eventType, status, validationReason: validation.reason,
            startedAt: event.startedAt ? new Date(event.startedAt) : undefined,
            completedAt: event.completedAt ? new Date(event.completedAt) : undefined,
            clientReportedAt: event.clientReportedAt ? new Date(event.clientReportedAt) : undefined,
            durationMs: event.durationMs, expectedDurationMs: event.expectedDurationMs,
            sequenceNumber: seq, metadataJson: event.metadata as Prisma.InputJsonValue | undefined,
          },
          select: { id: true },
        });
        let finalStatus = status;
        let finalReason = validation.reason;
        let eligible = validation.ok && event.eventType === PlaybackEventType.PLAY_COMPLETED;
        const terminalPlaybackEvent = [PlaybackEventType.PLAY_COMPLETED, PlaybackEventType.PLAY_INTERRUPTED, PlaybackEventType.PLAY_ERROR].includes(event.eventType as PlaybackEventType);
        if (validation.ok && terminalPlaybackEvent && event.authorizationId) {
          const consumed = await this.prisma.playbackAuthorization.updateMany({
            where: { id: event.authorizationId, screenId, assetId: event.assetId, campaignId: event.campaignId ?? null, playlistId: event.playlistId ?? null, consumedAt: null, expiresAt: { gt: new Date() } },
            data: { consumedAt: new Date() },
          });
          if (consumed.count !== 1) {
            finalStatus = PlaybackEventStatus.REJECTED;
            finalReason = 'PLAYBACK_AUTHORIZATION_ALREADY_CONSUMED';
            eligible = false;
            await this.prisma.playbackEvent.update({ where: { id: saved.id }, data: { status: finalStatus, validationReason: finalReason } });
          }
        }
        results.push({ eventId: event.eventId, status: finalStatus, reason: finalReason, countedForEligibility: eligible });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          results.push({ eventId: event.eventId, status: 'DUPLICATE', reason: 'EVENT_ID_ALREADY_RECEIVED', countedForEligibility: false });
        } else throw err;
      }
    }
    await this.prisma.screen.update({
      where: { id: screenId },
      data: { lastSeenAt: new Date(), lastHeartbeatAt: new Date(), status: ScreenStatus.ONLINE },
    });
    return {
      received: events.length,
      accepted: results.filter((r) => r.status === 'ACCEPTED').length,
      rejected: results.filter((r) => r.status === 'REJECTED').length,
      duplicates: results.filter((r) => r.status === 'DUPLICATE').length,
      results,
      note: 'Accepted completed events are candidate playback records; payout eligibility requires policy checks and trusted player/server validation.',
    };
  }

  async report(actor: AuthenticatedUser, screenId?: string) {
    if (!actor.organizationId) throw new ForbiddenException('Organization context is required.');
    const allowed = [UserRole.SUPER_ADMIN,UserRole.ORGANIZATION_ADMIN,UserRole.OPERATIONS_MANAGER,UserRole.FINANCE_MANAGER,UserRole.AUDITOR_COMPLIANCE];
    if (!actor.roles.some((r) => allowed.includes(r as UserRole))) throw new ForbiddenException('Your role cannot view playback reports.');
    const where: any = { organizationId: actor.organizationId, status: PlaybackEventStatus.ACCEPTED, eventType: PlaybackEventType.PLAY_COMPLETED };
    if (screenId) where.screenId = screenId;
    const [total, byScreen] = await Promise.all([
      this.prisma.playbackEvent.count({ where }),
      this.prisma.playbackEvent.groupBy({
        by: ['screenId'], where, _count: { _all: true }, orderBy: { _count: { screenId: 'desc' } }, take: 100,
      }),
    ]);
    return { organizationId: actor.organizationId, acceptedCompletedPlays: total, byScreen };
  }
}
