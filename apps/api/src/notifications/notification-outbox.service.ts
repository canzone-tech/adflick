import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationOutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlertNotification, AlertNotifierService } from './alert-notifier.service';

const BATCH_SIZE = 20;
const RETRY_BASE_MS = 15_000;
const STALE_LOCK_MS = 2 * 60_000;

@Injectable()
export class NotificationOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationOutboxService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly notifier: AlertNotifierService) {}

  onModuleInit() {
    if (process.env.NOTIFICATION_OUTBOX_ENABLED === 'false') return;
    const configuredInterval = Number(process.env.NOTIFICATION_OUTBOX_INTERVAL_MS ?? 15_000);
    const intervalMs = Number.isFinite(configuredInterval) ? Math.max(5_000, configuredInterval) : 15_000;
    this.timer = setInterval(() => { void this.drain(); }, intervalMs);
    this.timer.unref?.();
    void this.drain();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async enqueueIncident(event: AlertNotification) {
    const eventKey = `incident.created:${event.incidentId}`;
    try {
      await this.prisma.notificationOutbox.create({
        data: { eventKey, eventType: 'adflick.incident.created', organizationId: event.organizationId, payload: event as unknown as Prisma.InputJsonValue },
      });
      return { queued: true, duplicate: false };
    } catch (error) {
      // P2002 means the idempotency key already exists; do not create a duplicate notification.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return { queued: true, duplicate: true };
      this.logger.error(`Unable to enqueue incident notification ${event.incidentId}.`);
      throw error;
    }
  }

  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < BATCH_SIZE; i++) {
        const now = new Date();
        const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
        const candidate = await this.prisma.notificationOutbox.findFirst({
          where: { OR: [
            { status: NotificationOutboxStatus.PENDING, availableAt: { lte: now } },
            { status: NotificationOutboxStatus.PROCESSING, lockedAt: { lt: staleBefore } },
          ] }, orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
        });
        if (!candidate) break;
        const claim = await this.prisma.notificationOutbox.updateMany({
          where: { id: candidate.id, status: candidate.status, ...(candidate.status === NotificationOutboxStatus.PROCESSING ? { lockedAt: candidate.lockedAt } : { availableAt: { lte: now } }) },
          data: { status: NotificationOutboxStatus.PROCESSING, lockedAt: now, attempts: { increment: 1 } },
        });
        if (claim.count !== 1) continue;
        const current = await this.prisma.notificationOutbox.findUnique({ where: { id: candidate.id } });
        if (!current) continue;
        let result: { delivered: boolean; reason?: string };
        try {
          const payload = current.payload as unknown as AlertNotification;
          result = await this.notifier.notifyIncident(payload);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'UNKNOWN_DELIVERY_ERROR';
          await this.retryOrFail(current.id, current.organizationId, current.attempts, current.maxAttempts, message);
          continue;
        }
        if (result.delivered) {
          await this.prisma.notificationOutbox.update({ where: { id: current.id }, data: { status: NotificationOutboxStatus.DELIVERED, deliveredAt: new Date(), lockedAt: null, lastError: null } });
          try {
            await this.prisma.auditEvent.create({ data: { organizationId: current.organizationId, action: 'NOTIFICATION_DELIVERED', entityType: 'NotificationOutbox', entityId: current.id, severity: 'INFO', metadataJson: { eventType: current.eventType, attempts: current.attempts } } });
          } catch {
            this.logger.error(`Notification ${current.id} delivered, but delivery audit record could not be written.`);
          }
        } else {
          await this.retryOrFail(current.id, current.organizationId, current.attempts, current.maxAttempts, result.reason ?? 'DELIVERY_FAILED');
        }
      }
    } catch (error) {
      this.logger.error(`Notification outbox drain failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally { this.running = false; }
  }

  private async retryOrFail(id: string, organizationId: string, attempts: number, maxAttempts: number, reason: string) {
    const exhausted = attempts >= maxAttempts;
    const delayMs = Math.min(60 * 60_000, RETRY_BASE_MS * (2 ** Math.min(attempts - 1, 8)));
    await this.prisma.notificationOutbox.update({ where: { id }, data: {
      status: exhausted ? NotificationOutboxStatus.FAILED : NotificationOutboxStatus.PENDING,
      availableAt: exhausted ? undefined : new Date(Date.now() + delayMs), lockedAt: null, lastError: reason.slice(0, 500),
    } });
    await this.prisma.auditEvent.create({ data: { organizationId, action: exhausted ? 'NOTIFICATION_FAILED' : 'NOTIFICATION_RETRY_SCHEDULED', entityType: 'NotificationOutbox', entityId: id, severity: exhausted ? 'CRITICAL' : 'WARNING', metadataJson: { attempts, maxAttempts, reason: reason.slice(0, 160) } } });
    if (exhausted) this.logger.error(`Notification ${id} exhausted retries.`);
  }
}
