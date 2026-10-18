import { Injectable, Logger } from '@nestjs/common';

export type AlertNotification = {
  incidentId: string;
  organizationId: string;
  title: string;
  severity: string;
  category: string;
  description?: string | null;
  source: 'manual' | 'operator_scan' | 'scheduled_scan';
};

@Injectable()
export class AlertNotifierService {
  private readonly logger = new Logger(AlertNotifierService.name);

  async notifyIncident(event: AlertNotification): Promise<{ delivered: boolean; reason?: string }> {
    const endpoint = process.env.ALERT_WEBHOOK_URL?.trim();
    if (!endpoint) return { delivered: false, reason: 'WEBHOOK_NOT_CONFIGURED' };
    let parsed: URL;
    try { parsed = new URL(endpoint); } catch { return { delivered: false, reason: 'WEBHOOK_URL_INVALID' }; }
    if (parsed.protocol !== 'https:') {
      this.logger.error('Alert webhook refused: HTTPS is required.');
      return { delivered: false, reason: 'HTTPS_REQUIRED' };
    }
    if (parsed.username || parsed.password || parsed.hash) {
      this.logger.error('Alert webhook refused: URL credentials and fragments are not allowed.');
      return { delivered: false, reason: 'WEBHOOK_URL_NOT_ALLOWED' };
    }
    const allowedHosts = (process.env.ALERT_WEBHOOK_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    if (!allowedHosts.length || !allowedHosts.includes(parsed.hostname.toLowerCase())) {
      this.logger.error('Alert webhook refused: hostname is not in ALERT_WEBHOOK_ALLOWED_HOSTS.');
      return { delivered: false, reason: 'WEBHOOK_HOST_NOT_ALLOWLISTED' };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(parsed.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ALERT_WEBHOOK_BEARER_TOKEN ? { Authorization: `Bearer ${process.env.ALERT_WEBHOOK_BEARER_TOKEN}` } : {}),
        },
        redirect: 'manual',
        body: JSON.stringify({
          event: 'adflick.incident.created',
          occurredAt: new Date().toISOString(),
          incident: event,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn(`Alert webhook returned HTTP ${response.status} for incident ${event.incidentId}.`);
        return { delivered: false, reason: `WEBHOOK_HTTP_${response.status}` };
      }
      return { delivered: true };
    } catch (error) {
      this.logger.warn(`Alert webhook failed for incident ${event.incidentId}: ${error instanceof Error ? error.message : 'unknown error'}`);
      return { delivered: false, reason: 'WEBHOOK_REQUEST_FAILED' };
    } finally {
      clearTimeout(timeout);
    }
  }
}
