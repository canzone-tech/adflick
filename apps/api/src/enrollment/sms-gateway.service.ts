import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/**
 * Adapter contract for an independently approved JSON/HTTPS SMS provider:
 * POST { to, message, senderId, reference }
 * response { accepted: true, messageId: "<provider reference>" }.
 * No provider is assumed or embedded in business rules.
 */
export function smsConfiguration(env: NodeJS.ProcessEnv = process.env) {
  if (env.ADFLICK_SMS_ENABLED !== 'true' || env.ADFLICK_SMS_PROVIDER_APPROVED !== 'true') {
    throw new ServiceUnavailableException('SMS provider has not been approved and activated.');
  }
  const raw = env.ADFLICK_SMS_GATEWAY_URL ?? '';
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new ServiceUnavailableException('SMS provider endpoint configuration is invalid.'); }
  const local = env.NODE_ENV === 'test' && env.ADFLICK_SMS_INSECURE_LOOPBACK_TEST === 'true' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || (local && !['http:', 'https:'].includes(url.protocol)) ||
      !!url.username || !!url.password || !!url.hash ||
      !url.hostname || url.hostname.length > 253) {
    throw new ServiceUnavailableException('SMS gateway requires a valid protected HTTPS endpoint.');
  }
  const token = env.ADFLICK_SMS_GATEWAY_BEARER_TOKEN ?? '';
  const sender = env.ADFLICK_SMS_SENDER_ID?.trim() ?? '';
  const template = env.ADFLICK_SMS_OTP_TEMPLATE ?? '';
  if (token.length < 24 || token.includes('\r') || token.includes('\n') ||
      !/^[A-Za-z0-9]{3,16}$/.test(sender) ||
      template.length < 16 || template.length > 500 ||
      !template.includes('{code}') || !template.includes('{minutes}') ||
      /[\r\n]/.test(template)) {
    throw new ServiceUnavailableException('SMS gateway token, sender or approved template is missing.');
  }
  return { url: url.href, token, sender, template };
}

@Injectable()
export class SmsGatewayService {
  configurationReady() {
    try { smsConfiguration(); return true; } catch { return false; }
  }

  async sendOtp(to: string, code: string, expiresMinutes: number, reference: string) {
    const config = smsConfiguration();
    if (!/^\+[1-9]\d{7,14}$/.test(to) || !/^\d{6}$/.test(code) ||
        !Number.isInteger(expiresMinutes) || expiresMinutes < 2 || expiresMinutes > 15 ||
        !/^ph_[a-f0-9]{24}$/.test(reference)) {
      throw new ServiceUnavailableException('SMS OTP delivery validation failed.');
    }
    const message = config.template.replaceAll('{code}', code).replaceAll('{minutes}', String(expiresMinutes));
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + config.token },
        body: JSON.stringify({ to, message, senderId: config.sender, reference }),
        signal: AbortSignal.timeout(8_000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Gateway failed.');
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('accepted' in data) ||
          data.accepted !== true || !('messageId' in data) ||
          typeof data.messageId !== 'string' || data.messageId.length < 1 || data.messageId.length > 128) {
        throw new Error('Gateway did not confirm request acceptance.');
      }
    } catch {
      // Provider details/credentials/phone/code never leak through API or logs.
      throw new ServiceUnavailableException('Approved SMS gateway did not accept the verification message.');
    }
  }
}
