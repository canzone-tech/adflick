import { AlertNotifierService } from './alert-notifier.service';

describe('AlertNotifierService', () => {
  const originalEnv = { ...process.env };
  let notifier: AlertNotifierService;

  beforeEach(() => {
    notifier = new AlertNotifierService();
    delete process.env.ALERT_WEBHOOK_URL;
    delete process.env.ALERT_WEBHOOK_ALLOWED_HOSTS;
    delete process.env.ALERT_WEBHOOK_BEARER_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  const event = {
    incidentId: 'inc_test', organizationId: 'org_test', title: 'Screen offline',
    severity: 'HIGH', category: 'SCREEN_OFFLINE', description: 'No heartbeat',
    source: 'scheduled_scan' as const,
  };

  it('does not claim delivery when no endpoint is configured', async () => {
    await expect(notifier.notifyIncident(event)).resolves.toEqual({ delivered: false, reason: 'WEBHOOK_NOT_CONFIGURED' });
  });

  it('rejects non-HTTPS URLs', async () => {
    process.env.ALERT_WEBHOOK_URL = 'http://hooks.example.com/events';
    process.env.ALERT_WEBHOOK_ALLOWED_HOSTS = 'hooks.example.com';
    await expect(notifier.notifyIncident(event)).resolves.toEqual({ delivered: false, reason: 'HTTPS_REQUIRED' });
  });

  it('rejects hosts outside the explicit allowlist', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://127.0.0.1/events';
    process.env.ALERT_WEBHOOK_ALLOWED_HOSTS = 'hooks.example.com';
    await expect(notifier.notifyIncident(event)).resolves.toEqual({ delivered: false, reason: 'WEBHOOK_HOST_NOT_ALLOWLISTED' });
  });

  it('posts incident events to allowlisted HTTPS endpoint', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/events';
    process.env.ALERT_WEBHOOK_ALLOWED_HOSTS = 'hooks.example.com';
    process.env.ALERT_WEBHOOK_BEARER_TOKEN = 'test-secret';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
    await expect(notifier.notifyIncident(event)).resolves.toEqual({ delivered: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-secret');
    expect(String(init.body)).toContain('adflick.incident.created');
    expect(String(init.body)).not.toContain('test-secret');
  });

  it('does not report success for failed webhook responses', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/events';
    process.env.ALERT_WEBHOOK_ALLOWED_HOSTS = 'hooks.example.com';
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));
    await expect(notifier.notifyIncident(event)).resolves.toEqual({ delivered: false, reason: 'WEBHOOK_HTTP_503' });
  });
});
